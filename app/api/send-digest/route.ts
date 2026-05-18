import { NextResponse } from "next/server";
import { Resend } from "resend";
import type { DigestArticle } from "@/lib/summarize";
import type { Beat } from "@/lib/companies";

// ── Theme ─────────────────────────────────────────────────────────────────────
const PAGE_BG   = "#FAF8F4";
const CARD_BG   = "#FFFFFF";
const BORDER    = "#DED8CC";
const TEXT_HIGH = "#18140C";
const TEXT_MID  = "#585048";
const TEXT_LOW  = "#7A7268";
const ACCENT    = "#1B3A6B";
const FOOTER_CLR = "#A8A098";

const BEAT_COLORS: Record<Beat, string> = {
  "Physical AI":       "#1B3A6B",
  "AI Infrastructure": "#0369a1",
  "AI Labs":           "#7c3aed",
  "Vertical AI":       "#065f46",
};

const CATEGORY_COLORS: Record<string, string> = {
  Funding:      "#10b981",
  Product:      "#3b82f6",
  "AI/Models":  "#8b5cf6",
  Partnerships: "#f59e0b",
  Hiring:       "#ec4899",
  General:      "#6b7280",
};

// ── Email builder ─────────────────────────────────────────────────────────────
function pill(label: string, color: string): string {
  return `<span style="background:${color}18;color:${color};font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;border:1px solid ${color}33;white-space:nowrap;">${label}</span>`;
}

function featuredBlock(a: DigestArticle): string {
  const beatColor = BEAT_COLORS[a.beat] ?? ACCENT;
  const catColor  = CATEGORY_COLORS[a.category] ?? "#6b7280";
  const imgBlock  = a.ogImage
    ? `<a href="${a.url}" style="display:block;text-decoration:none;"><img src="${a.ogImage}" alt="" width="100%" style="display:block;width:100%;height:auto;max-height:220px;object-fit:cover;" /></a>`
    : "";

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-collapse:collapse;background:${CARD_BG};border-radius:8px;overflow:hidden;border:1px solid ${BORDER};">
  <tr><td>
    ${imgBlock}
    <div style="padding:18px 20px;">
      <div style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap;">
        ${pill(a.beat, beatColor)}
        ${pill(a.category, catColor)}
      </div>
      <a href="${a.url}" style="display:block;color:${TEXT_HIGH};font-size:18px;font-weight:600;text-decoration:none;line-height:1.35;margin-bottom:10px;">${a.title}</a>
      <p style="color:${TEXT_MID};font-size:13px;line-height:1.65;margin:0 0 12px;">${a.summary}</p>
      <div style="border-left:2px solid ${beatColor};padding-left:10px;">
        <p style="color:${TEXT_LOW};font-size:12px;line-height:1.55;margin:0;font-style:italic;">${a.bdRelevance}</p>
      </div>
    </div>
  </td></tr>
</table>`;
}

function quickHitRow(a: DigestArticle, last: boolean): string {
  const beatColor = BEAT_COLORS[a.beat] ?? ACCENT;
  const borderStyle = last ? "none" : `1px solid ${BORDER}`;
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:0;border-collapse:collapse;">
  <tr><td style="padding:12px 0;border-bottom:${borderStyle};">
    <div style="margin-bottom:5px;">${pill(a.beat, beatColor)}</div>
    <a href="${a.url}" style="display:block;color:${TEXT_HIGH};font-size:14px;font-weight:500;text-decoration:none;line-height:1.4;margin-bottom:4px;">${a.title}</a>
    <p style="color:${TEXT_LOW};font-size:12px;line-height:1.5;margin:0;">${a.summary.split(". ")[0]}.</p>
  </td></tr>
</table>`;
}

function buildEmailHtml(digest: { articles: DigestArticle[]; generatedAt: string }): string {
  const date = new Date(digest.generatedAt).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const sorted = [...digest.articles]; // already sorted by dealSignal + composite score

  // Featured: highest relevance deal-signal article, else top article
  const featured = sorted.find(a => a.dealSignal) ?? sorted[0];
  const quickHits = sorted.filter(a => a !== featured).slice(0, 9);

  if (!featured) return "<p>No articles today.</p>";

  const quickHitRows = quickHits.map((a, i) => quickHitRow(a, i === quickHits.length - 1)).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Frontier AI Digest</title>
  <style>
    body { margin:0; padding:0; background:${PAGE_BG}; -webkit-text-size-adjust:100%; }
    img  { border:0; outline:none; text-decoration:none; }
    a    { color:${ACCENT}; }
    @media only screen and (max-width:600px) {
      .wrapper { padding: 16px 12px !important; }
    }
  </style>
</head>
<body style="background:${PAGE_BG};margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG};">
    <tr><td align="center">
      <table class="wrapper" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;padding:28px 20px;">
        <tr><td>

          <!-- Masthead rule -->
          <div style="height:3px;background:linear-gradient(90deg,${ACCENT},#2E5EA8,transparent);margin-bottom:24px;border-radius:2px;"></div>

          <!-- Header -->
          <h1 style="color:${TEXT_HIGH};font-size:24px;font-weight:700;margin:0 0 4px;letter-spacing:-0.02em;">Frontier AI Digest</h1>
          <p style="color:${TEXT_LOW};font-size:12px;margin:0 0 28px;">${date}</p>

          <!-- Featured story -->
          ${featuredBlock(featured)}

          <!-- Quick Hits label -->
          <p style="color:${TEXT_HIGH};font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 4px;">Quick Hits</p>
          <div style="height:1px;background:${BORDER};margin-bottom:0;"></div>

          <!-- Quick Hits rows -->
          <div style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px;padding:0 16px;margin-bottom:28px;">
            ${quickHitRows}
          </div>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td align="center">
              <a href="https://frontier-ai-digest.vercel.app" style="display:inline-block;background:${ACCENT};color:#FFFFFF;font-size:13px;font-weight:600;text-decoration:none;padding:11px 28px;border-radius:6px;letter-spacing:0.01em;">View full digest →</a>
            </td></tr>
          </table>

          <!-- Footer -->
          <p style="color:${FOOTER_CLR};font-size:11px;text-align:center;margin:0;">© Mark Fok · Frontier AI Digest · Powered by Exa + Claude</p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function GET() {
  try {
    const { getDigest } = await import("@/lib/digest-cache");
    const digest = await getDigest();
    if (!digest) {
      return NextResponse.json({ error: "No digest in KV — run /api/digest first" }, { status: 404 });
    }

    const html = buildEmailHtml(digest);

    const resend = new Resend(process.env.RESEND_API_KEY!);
    const date   = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const { data, error } = await resend.emails.send({
      from:    "Frontier AI Digest <onboarding@resend.dev>",
      to:      ["fokjenhong@gmail.com", "sueannlau568@gmail.com"],
      subject: `Frontier AI Digest — ${date}`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: "Email send failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, emailId: data?.id });
  } catch (err) {
    console.error("Send-digest error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
