import type { Digest, DigestArticle } from "./summarize";
import { getSynthesisHero } from "./summarize";
import type { Beat } from "./companies";
import { escapeHtml } from "./html";
import { displayTitle } from "./format";

// The 7am email. Kept to what every client renders, Outlook for Windows
// included: tables for layout, solid 6-digit hex colors (no 8-digit alpha, no
// gradients), no flexbox. Contrast figures are text on its own background.

// ── Theme ─────────────────────────────────────────────────────────────────────
const PAGE_BG   = "#FAF8F4";
const CARD_BG   = "#FFFFFF";
const BORDER    = "#DED8CC";
const TEXT_HIGH = "#18140C";
const TEXT_MID  = "#585048";
const TEXT_LOW  = "#7A7268";  // 4.7:1 on white
const ACCENT    = "#1B3A6B";
const FOOTER_CLR = "#736B61"; // 4.9:1 on PAGE_BG (was #A8A098, 2.4:1)

// Pill text is the color itself on a 9% tint of it: every pair is 4.8:1 or
// better (the old category colors ran 2.0 to 3.8:1).
const BEAT_COLORS: Record<Beat, string> = {
  "Physical AI":       "#1B3A6B", // 9.5:1
  "AI Infrastructure": "#0369a1", // 5.2:1
  "AI Labs":           "#6d28d9", // 6.1:1
  "Vertical AI":       "#065f46", // 6.6:1
};

const CATEGORY_COLORS: Record<string, string> = {
  Funding:      "#047857", // 4.8:1
  Product:      "#1d4ed8", // 5.8:1
  "AI/Models":  "#7e22ce", // 6.0:1
  Partnerships: "#92400e", // 6.1:1
  Hiring:       "#be185d", // 5.2:1
  General:      "#4b5563", // 6.6:1
};

// Blend a color over white into a solid hex: 8-digit hex is dropped by Outlook.
function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(alpha * c + (1 - alpha) * 255).toString(16).padStart(2, "0");
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

function isHttpUrl(raw: string | null): raw is string {
  if (!raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ── Email builder ─────────────────────────────────────────────────────────────
function pill(label: string, color: string): string {
  return `<span style="display:inline-block;margin:0 6px 4px 0;background:${tint(color, 0x18 / 255)};color:${color};font-size:12px;font-weight:600;padding:2px 7px;border-radius:4px;border:1px solid ${tint(color, 0x33 / 255)};white-space:nowrap;">${escapeHtml(label)}</span>`;
}

function featuredBlock(a: DigestArticle): string {
  const beatColor = BEAT_COLORS[a.beat] ?? ACCENT;
  const catColor  = CATEGORY_COLORS[a.category] ?? CATEGORY_COLORS.General;
  const url       = escapeHtml(a.url);
  const title     = escapeHtml(displayTitle(a.title));
  const summary   = escapeHtml(a.summary);
  const bdRel     = escapeHtml(a.bdRelevance);
  const imgBlock  = isHttpUrl(a.ogImage)
    ? `<a href="${url}" style="display:block;text-decoration:none;"><img src="${escapeHtml(a.ogImage)}" alt="" width="100%" style="display:block;width:100%;height:auto;max-height:220px;object-fit:cover;" /></a>`
    : "";

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-collapse:collapse;background:${CARD_BG};border-radius:8px;overflow:hidden;border:1px solid ${BORDER};">
  <tr><td>
    ${imgBlock}
    <div style="padding:18px 20px;">
      <div style="margin-bottom:6px;">${pill(a.beat, beatColor)}${pill(a.category, catColor)}</div>
      <a href="${url}" style="display:block;color:${TEXT_HIGH};font-size:18px;font-weight:600;text-decoration:none;line-height:1.35;margin-bottom:10px;">${title}</a>
      <p style="color:${TEXT_MID};font-size:14px;line-height:1.6;margin:0 0 12px;">${summary}</p>
      <div style="border-left:2px solid ${beatColor};padding-left:10px;">
        <p style="color:${TEXT_MID};font-size:13px;line-height:1.55;margin:0;font-style:italic;">${bdRel}</p>
      </div>
    </div>
  </td></tr>
</table>`;
}

function quickHitRow(a: DigestArticle, last: boolean): string {
  const beatColor = BEAT_COLORS[a.beat] ?? ACCENT;
  const borderStyle = last ? "none" : `1px solid ${BORDER}`;
  const url = escapeHtml(a.url);
  const title = escapeHtml(displayTitle(a.title));
  const summaryLead = escapeHtml(a.summary.split(". ")[0]);
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:0;border-collapse:collapse;">
  <tr><td style="padding:12px 0;border-bottom:${borderStyle};">
    <div style="margin-bottom:2px;">${pill(a.beat, beatColor)}</div>
    <a href="${url}" style="display:block;color:${TEXT_HIGH};font-size:15px;font-weight:500;text-decoration:none;line-height:1.4;margin-bottom:4px;">${title}</a>
    <p style="color:${TEXT_LOW};font-size:13px;line-height:1.5;margin:0;">${summaryLead}.</p>
  </td></tr>
</table>`;
}

// Renders only when a beat is overdue (see getBeatFreshness). On normal days
// staleBeats is empty and the banner is absent.
function staleWarningBanner(staleBeats: string[]): string {
  if (staleBeats.length === 0) return "";
  const list = staleBeats.map(escapeHtml).join(", ");
  const plural = staleBeats.length > 1 ? "those beats" : "that beat";
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border-collapse:collapse;">
  <tr><td style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:6px;padding:10px 14px;">
    <p style="color:#92400E;font-size:13px;line-height:1.55;margin:0;">⚠️ Some beats didn't refresh in time: <strong>${list}</strong>. Today's digest may be missing recent stories from ${plural}.</p>
  </td></tr>
</table>`;
}

export function buildEmailHtml(digest: Digest, staleBeats: string[] = []): string {
  const date = new Date(digest.generatedAt).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Los_Angeles",
  });

  const sorted = [...digest.articles];

  const featured = getSynthesisHero(digest) ?? sorted[0];
  const quickHits = sorted.filter(a => a !== featured).slice(0, 9);

  const thesisBlock = digest.synthesis?.thesis
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-collapse:collapse;">
  <tr><td style="background:${tint(ACCENT, 0x0D / 255)};border-left:3px solid ${ACCENT};border-radius:0 4px 4px 0;padding:12px 16px;">
    <p style="color:${TEXT_MID};font-size:14px;line-height:1.65;margin:0;font-style:italic;">${escapeHtml(digest.synthesis.thesis)}</p>
  </td></tr>
</table>`
    : "";

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

          <!-- Masthead rule: a solid table cell, since Outlook drops gradients and empty divs -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-collapse:collapse;">
            <tr><td height="3" bgcolor="${ACCENT}" style="height:3px;line-height:3px;font-size:0;background:${ACCENT};">&nbsp;</td></tr>
          </table>

          <!-- Header -->
          <h1 style="color:${TEXT_HIGH};font-size:24px;font-weight:700;margin:0 0 4px;letter-spacing:-0.02em;">Frontier AI Digest</h1>
          <p style="color:${TEXT_LOW};font-size:13px;margin:0 0 28px;">${date}</p>

          <!-- Stale-beat warning (renders only when a beat is overdue) -->
          ${staleWarningBanner(staleBeats)}

          <!-- Editor's thesis -->
          ${thesisBlock}

          <!-- Featured story -->
          ${featuredBlock(featured)}

          <!-- Quick Hits label -->
          <p style="color:${TEXT_HIGH};font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 4px;">Quick Hits</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td height="1" bgcolor="${BORDER}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr></table>

          <!-- Quick Hits rows -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:8px;margin-bottom:28px;border-collapse:separate;">
            <tr><td style="padding:0 16px;">
              ${quickHitRows}
            </td></tr>
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr><td align="center">
              <a href="https://frontier-ai-digest.vercel.app" style="display:inline-block;background:${ACCENT};color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:6px;letter-spacing:0.01em;">View full digest →</a>
            </td></tr>
          </table>

          <!-- Footer -->
          <p style="color:${FOOTER_CLR};font-size:12px;text-align:center;margin:0;">© Mark Fok · Frontier AI Digest · Powered by Exa + Gemini</p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
