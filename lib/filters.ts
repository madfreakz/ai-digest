import { COMPANIES } from "./companies";

export interface FilterableArticle {
  title: string;
  text?: string;
  source?: string;
  url?: string;
}

const TRACKED_NAMES_LOWER = COMPANIES
  .map(c => c.name.trim())
  .filter(name => name.length >= 3)
  .map(name => ({
    name,
    regex: new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
  }));

function mentionsTrackedCompany(title: string): boolean {
  return TRACKED_NAMES_LOWER.some(entry => entry.regex.test(title));
}

const ROUNDUP_RE = /\b(weekly|monthly|daily)\s+(brief|roundup|recap|digest)\b|\bthis week in\b/i;
const MEDIA_CENTER_RE = /^(news|press|media center)\s*[:|\-]/i;

const SINGLE_HIT_EXCLUDED_TITLE: Array<{ reason: string; re: RegExp }> = [
  {
    reason: "healthcare",
    re: /\b(healthcare|patient|patients|nursemagic|hospital|clinical trial|telehealth|ehr|pharma|medtech)\b/i,
  },
  {
    reason: "cybersecurity",
    re: /\b(cybersecurity|ransomware|malware|endpoint security|siem|soc analyst|appsec|devsecops|supply[- ]chain security)\b/i,
  },
  {
    reason: "defense",
    re: /\b(military drone|weapons system|pentagon contract|defense contractor)\b/i,
  },
  {
    reason: "crypto",
    re: /\b(cryptocurrency|blockchain|web3|defi|nft|memecoin|token sale)\b/i,
  },
  {
    reason: "insurance",
    re: /\binsurance claims?\b/i,
  },
  {
    reason: "adtech",
    re: /\badtech\b/i,
  },
];

const MULTI_HIT_TERMS: Array<{ category: string; re: RegExp }> = [
  { category: "healthcare", re: /\b(patient|clinical|hospital|healthcare|ehr|hipaa|medical)\b/i },
  { category: "cybersecurity", re: /\b(cybersecurity|vulnerability|ransomware|malware|threat detection|ciso)\b/i },
  { category: "defense", re: /\b(military|pentagon|defense department|weaponry|battlefield)\b/i },
  { category: "crypto", re: /\b(blockchain|crypto|web3|defi|stablecoin|token)\b/i },
  { category: "insurance", re: /\b(insurance|underwriting|policyholder|claims processing)\b/i },
  { category: "adtech", re: /\b(adtech|programmatic advertising|ad spend)\b/i },
];

export function isExcludedContent(article: FilterableArticle): { excluded: boolean; reason?: string } {
  const title = (article.title ?? "").trim();
  const source = (article.source ?? "").trim();
  let hostname = source;
  if (article.url) {
    try {
      hostname = new URL(article.url).hostname.replace(/^www\./, "");
    } catch {
      // Keep source string when URL is absent or invalid
    }
  }

  if (/^ir\./i.test(hostname) || /^ir\./i.test(source)) {
    return { excluded: true, reason: "investor-relations subdomain" };
  }
  if (ROUNDUP_RE.test(title)) {
    return { excluded: true, reason: "periodic roundup" };
  }
  if (MEDIA_CENTER_RE.test(title)) {
    return { excluded: true, reason: "generic media-center page" };
  }

  // Keep stories whose headline explicitly names a tracked frontier company.
  if (mentionsTrackedCompany(title)) {
    return { excluded: false };
  }

  for (const rule of SINGLE_HIT_EXCLUDED_TITLE) {
    if (rule.re.test(title)) {
      return { excluded: true, reason: `excluded industry (${rule.reason})` };
    }
  }

  const combined = `${title} ${article.text ?? ""}`;
  for (const group of MULTI_HIT_TERMS) {
    const matches = combined.match(new RegExp(group.re.source, "gi"));
    if (matches && new Set(matches.map(m => m.toLowerCase())).size >= 2) {
      return { excluded: true, reason: `excluded industry excerpt (${group.category})` };
    }
  }

  return { excluded: false };
}

export function filterNoisyArticles<T extends FilterableArticle>(
  articles: T[],
): { kept: T[]; dropped: Array<{ title: string; reason: string }> } {
  const kept: T[] = [];
  const dropped: Array<{ title: string; reason: string }> = [];
  for (const article of articles) {
    const verdict = isExcludedContent(article);
    if (verdict.excluded) {
      dropped.push({ title: article.title, reason: verdict.reason ?? "excluded" });
    } else {
      kept.push(article);
    }
  }
  return { kept, dropped };
}

const BANNED_HEDGES_RE = /\b(could|potentially|may|might|significant|significantly)\b/i;
const BANNED_CLICHES_RE = /(competitive pressure|new frontier|pivotal shift|signals a growing trend|for bd professionals|opens partnership avenues|creates a new competitive (?:offering|threat))/i;

export function cleanSoWhat(text: string): string {
  return text
    .trim()
    .replace(/^for\s+bd\s+(?:professionals|teams)\s*[,:\-]\s*/i, "")
    .trim();
}

export function lintSoWhat(text: string): { ok: boolean; wordCount: number; issues: string[] } {
  const cleaned = cleanSoWhat(text);
  const wordCount = cleaned ? cleaned.split(/\s+/).length : 0;
  const issues: string[] = [];

  if (wordCount === 0) {
    issues.push("empty");
  } else if (wordCount > 28) {
    issues.push(`too long (${wordCount} words)`);
  }

  const hedge = cleaned.match(BANNED_HEDGES_RE);
  if (hedge) {
    issues.push(`hedge word "${hedge[0].toLowerCase()}"`);
  }

  const cliche = cleaned.match(BANNED_CLICHES_RE);
  if (cliche) {
    issues.push(`cliche "${cliche[0].toLowerCase()}"`);
  }

  return { ok: issues.length === 0, wordCount, issues };
}
