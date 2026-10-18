import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";

export const dynamic = "force-dynamic";
import { buildEmailHtml } from "@/lib/email";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[auth] CRON_SECRET not configured — refusing request");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const skipEmail = url.searchParams.get("skipEmail") === "true";

  try {
    // Bust stale synthesis cache so fresh content gets a fresh synthesis
    if (skipEmail) {
      try {
        const { kv } = await import("@vercel/kv");
        await kv.del("digest:synthesis");
      } catch {}
    }

    const { aggregateDigestFromBeats, publishFinalDigest, getBeatFreshness } = await import("@/lib/beat-digests");
    const digest = await aggregateDigestFromBeats();
    if (!digest || digest.articles.length === 0) {
      console.error("[send-digest] No articles in digest — check beat caches or KV provisioning");
      return NextResponse.json({ error: "No digest available — run /api/beat first" }, { status: 404 });
    }
    console.log(`[send-digest] Digest ready: ${digest.articles.length} articles, sending email...`);

    // Publish to stable KV key so the page only changes when this cron runs
    await publishFinalDigest(digest);
    revalidatePath("/");

    if (skipEmail) {
      return NextResponse.json({ success: true, published: true, emailSent: false, articleCount: digest.articles.length });
    }

    const staleBeats = (await getBeatFreshness()).filter(f => f.stale).map(f => f.beat);
    const html = buildEmailHtml(digest, staleBeats);

    const resend = new Resend(process.env.RESEND_API_KEY!);
    const date   = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    // emailSubject is model-generated from web-derived content. It becomes an
    // email header (not HTML-escaped body), so collapse any CR/LF (header
    // injection) and cap the length before handing it to Resend.
    const rawSubject = digest.synthesis?.emailSubject ?? `Frontier AI Digest — ${date}`;
    const subject = rawSubject.replace(/[\r\n]+/g, " ").trim().slice(0, 200)
      || `Frontier AI Digest — ${date}`;

    const { data, error } = await resend.emails.send({
      from:    "Frontier AI Digest <onboarding@resend.dev>",
      to:      ["fokjenhong@gmail.com"],
      subject,
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
