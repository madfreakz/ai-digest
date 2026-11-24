import { kv } from "@vercel/kv";
import { Resend } from "resend";
import { KV_CONFIGURED } from "./kv-config";
import { escapeHtml } from "./html";

const ALERT_COOLDOWN_SECONDS = 12 * 60 * 60;
const ALERT_FROM = "Frontier AI Digest <onboarding@resend.dev>";
const ALERT_TO = ["fokjenhong@gmail.com"];

// Rate-limited operational alert for cron failures and flash-lite fallbacks.
// Never throws so alerting cannot break the caller's own error/cache path.
export async function sendOpsAlert(
  slug: string,
  subject: string,
  bodyLines: string[],
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const kvKey = `ops:alert:${slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`;
  if (KV_CONFIGURED) {
    try {
      const alreadySent = await kv.get<string>(kvKey);
      if (alreadySent) return;
      await kv.setex(kvKey, ALERT_COOLDOWN_SECONDS, new Date().toISOString());
    } catch {
      // Proceed even if cooldown check fails
    }
  }

  try {
    const resend = new Resend(apiKey);
    const items = bodyLines
      .map(line => `<li style="margin:0 0 6px;">${escapeHtml(line)}</li>`)
      .join("");
    const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18140C;padding:20px;">
  <h2 style="margin:0 0 12px;font-size:18px;color:#1B3A6B;">${escapeHtml(subject)}</h2>
  <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;line-height:1.5;">${items}</ul>
  <p style="font-size:12px;color:#736B61;margin:0;">Check <a href="https://frontier-ai-digest.vercel.app/api/health">/api/health</a> for beat freshness.</p>
</body></html>`;

    const cleanSubject = subject.replace(/[\r\n]+/g, " ").trim().slice(0, 180);
    await resend.emails.send({
      from: ALERT_FROM,
      to: ALERT_TO,
      subject: `[AI Digest Ops] ${cleanSubject}`,
      html,
    });
  } catch (err) {
    console.warn("[alerts] Failed to send ops alert:", err instanceof Error ? err.message : String(err));
  }
}
