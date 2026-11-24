import { readFileSync } from "node:fs";
import { isExcludedContent, lintSoWhat } from "../lib/filters";
import { MOCK_DIGEST } from "../lib/mock-digest";
import { isFutureDated } from "../lib/summarize";
import type { Digest } from "../lib/summarize";
import { normalizeUrl } from "../lib/exa";

function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

interface EvalRow {
  title: string;
  url: string;
  source: string;
  beat: string;
  bdRelevance: string;
  publishedAt?: string;
  hasLogoOrImg?: boolean;
}

function scoreRows(label: string, rows: EvalRow[]): void {
  const byBeat: Record<string, number> = {};
  const soWhatIssues: Array<{ title: string; issues: string[] }> = [];
  const excludedLeaks: Array<{ title: string; reason: string }> = [];
  let totalWords = 0;
  let maxWords = 0;
  let futureCount = 0;
  let imgCount = 0;

  for (const r of rows) {
    byBeat[r.beat] = (byBeat[r.beat] ?? 0) + 1;
    const lint = lintSoWhat(r.bdRelevance);
    totalWords += lint.wordCount;
    if (lint.wordCount > maxWords) maxWords = lint.wordCount;
    if (!lint.ok) soWhatIssues.push({ title: r.title, issues: lint.issues });

    const excl = isExcludedContent({ title: r.title, source: r.source, url: r.url });
    if (excl.excluded) excludedLeaks.push({ title: r.title, reason: excl.reason ?? "excluded" });

    if (r.publishedAt && isFutureDated({ publishedAt: r.publishedAt } as any)) futureCount++;
    if (r.hasLogoOrImg) imgCount++;
  }

  const wordSets = rows.map(r => titleWords(r.title));
  const nearDupes: Array<[string, string]> = [];
  const seenNorm = new Set<string>();
  let urlDupes = 0;
  for (let i = 0; i < rows.length; i++) {
    const n = normalizeUrl(rows[i].url);
    if (seenNorm.has(n)) urlDupes++;
    seenNorm.add(n);
    for (let j = i + 1; j < rows.length; j++) {
      if (jaccard(wordSets[i], wordSets[j]) >= 0.55) {
        nearDupes.push([rows[i].title, rows[j].title]);
      }
    }
  }

  console.log(`\n=== Frontier AI Digest Eval: ${label} ===`);
  console.log(`Articles: ${rows.length} | By beat: ${JSON.stringify(byBeat)}`);
  console.log(`So What avg words: ${(rows.length ? totalWords / rows.length : 0).toFixed(1)} (max ${maxWords}) | Lint issues: ${soWhatIssues.length}`);
  for (const item of soWhatIssues.slice(0, 8)) {
    console.log(`  - [lint] ${item.title.slice(0, 60)} => ${item.issues.join(", ")}`);
  }
  console.log(`Excluded-industry / noise leaks: ${excludedLeaks.length}`);
  for (const leak of excludedLeaks) {
    console.log(`  - [leak] (${leak.reason}) ${leak.title}`);
  }
  console.log(`Exact URL dupes: ${urlDupes} | Near-duplicate title pairs: ${nearDupes.length} | Future-dated: ${futureCount}`);
  for (const [a, b] of nearDupes) {
    console.log(`  - [dupe] "${a.slice(0, 45)}" <-> "${b.slice(0, 45)}"`);
  }
  if (rows.some(r => r.hasLogoOrImg !== undefined)) {
    console.log(`Cards with logo/image: ${imgCount}/${rows.length}`);
  }
}

async function fetchLiveRows(): Promise<EvalRow[]> {
  const res = await fetch("https://frontier-ai-digest.vercel.app");
  if (!res.ok) throw new Error(`Live fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  const rows: EvalRow[] = [];

  const decode = (s: string) =>
    s.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  const leadMatch = html.match(/<article class="lead-story">[\s\S]*?<h1 class="lead-title"><a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a><\/h1>[\s\S]*?<p class="story-meta">([\s\S]*?)<\/p>[\s\S]*?<div class="so-what"><span[^>]*>So What\?<\/span><p>([\s\S]*?)<\/p><\/div>/);
  if (leadMatch) {
    const metaText = decode(leadMatch[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    rows.push({
      title: decode(leadMatch[2]),
      url: leadMatch[1],
      source: metaText.split("·")[0]?.trim() ?? "unknown",
      beat: "Lead",
      bdRelevance: decode(leadMatch[4]),
    });
  }

  const sectionRe = /<section[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g;
  let secMatch: RegExpExecArray | null;
  while ((secMatch = sectionRe.exec(html)) !== null) {
    const beat = secMatch[1];
    const body = secMatch[2];
    const cardRe = /<article class="news-card">([\s\S]*?)<\/article>/g;
    let cardMatch: RegExpExecArray | null;
    while ((cardMatch = cardRe.exec(body)) !== null) {
      const card = cardMatch[1];
      const titleM = card.match(/<h3 class="card-title"><a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a><\/h3>/);
      const metaM = card.match(/<p class="story-meta">([\s\S]*?)<\/p>/);
      const soWhatM = card.match(/<div class="so-what"><span[^>]*>So What\?<\/span><p>([\s\S]*?)<\/p><\/div>/);
      if (!titleM) continue;
      const metaParts = metaM ? decode(metaM[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).replace(/^New\s+/i, "") : "";
      rows.push({
        title: decode(titleM[2]),
        url: titleM[1],
        source: metaParts.split("·")[0]?.trim() ?? "unknown",
        beat,
        bdRelevance: soWhatM ? decode(soWhatM[1]) : "",
        hasLogoOrImg: /class="card-thumb/.test(card),
      });
    }
  }
  return rows;
}

async function main() {
  const arg = process.argv[2];
  if (arg === "--live") {
    const rows = await fetchLiveRows();
    scoreRows("LIVE production (frontier-ai-digest.vercel.app)", rows);
    return;
  }

  const digest: Digest = arg
    ? (JSON.parse(readFileSync(arg, "utf8")) as Digest)
    : MOCK_DIGEST;
  const rows: EvalRow[] = digest.articles.map(a => ({
    title: a.title,
    url: a.url,
    source: a.source,
    beat: a.beat,
    bdRelevance: a.bdRelevance,
    publishedAt: a.publishedAt,
    hasLogoOrImg: Boolean(a.companyLogoUrl || a.ogImage),
  }));
  scoreRows(arg ? arg : "MOCK_DIGEST", rows);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
