import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { requireCronAuth } from "@/lib/auth";
import { getArchiveIndex, getArchivedDigest, ptDateKey } from "@/lib/beat-digests";
import { buildWeeklyEmailHtml, generateWeeklyDigest, saveWeeklyDigest } from "@/lib/weekly";
import type { Digest } from "@/lib/summarize";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const skipEmail = url.searchParams.get("skipEmail") === "true";

  try {
    const index = await getArchiveIndex();
    const recentDates = index.slice(0, 7).map(e => e.date);
    const loaded = (await Promise.all(recentDates.map(d => getArchivedDigest(d))))
      .filter((d): d is Digest => Boolean(d && d.articles.length > 0));

    if (loaded.length === 0) {
      return NextResponse.json({ error: "No archived daily digests available yet" }, { status: 404 });
    }

    const weekEnding = ptDateKey(new Date().toISOString());
    const weekly = await generateWeeklyDigest(loaded, weekEnding);
    if (!weekly) {
      return NextResponse.json({ error: "Failed to synthesize weekly digest" }, { status: 500 });
    }

    await saveWeeklyDigest(weekly);
    revalidatePath("/weekly");
    revalidatePath("/archive");

    if (skipEmail) {
      return NextResponse.json({
        success: true,
        weekEnding: weekly.weekEnding,
        daysCovered: weekly.daysCovered,
        articleCount: weekly.articleCount,
        emailSent: false,
      });
    }

    const resend = new Resend(process.env.RESEND_API_KEY!);
    const subject = weekly.emailSubject.replace(/[\r\n]+/g, " ").trim().slice(0, 200)
      || `Frontier AI Digest Weekly (${weekEnding})`;
    const html = buildWeeklyEmailHtml(weekly);

    const { data, error } = await resend.emails.send({
      from: "Frontier AI Digest <onboarding@resend.dev>",
      to: ["fokjenhong@gmail.com"],
      subject: `Weekly: ${subject}`,
      html,
    });

    if (error) {
      console.error("[weekly-digest] Resend error:", error);
      return NextResponse.json({ error: "Weekly email send failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      weekEnding: weekly.weekEnding,
      emailId: data?.id,
      daysCovered: weekly.daysCovered,
      articleCount: weekly.articleCount,
    });
  } catch (err) {
    console.error("[weekly-digest] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
