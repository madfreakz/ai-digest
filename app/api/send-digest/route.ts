import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { fetchRoboticsNews } from "@/lib/exa";
import { generateDigest, type DigestArticle } from "@/lib/summarize";

const CATEGORY_COLORS: Record<string, string> = {
  Funding: "#10b981",
  Product: "#3b82f6",
  "AI/Models": "#8b5cf6",
  Partnerships: "#f59e0b",
  Hiring: "#ec4899",
  General: "#6b7280",
};

function buildEmailHtml(digest: {
  articles: DigestArticle[];
  generatedAt: string;
}): string {
  const date = new Date(digest.generatedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const articleRows = digest.articles
    .map((a) => {
      const color = CATEGORY_COLORS[a.category] ?? "#6b7280";
      const meta = [
        a.source,
        a.companyTags.length > 0 ? a.companyTags.join(", ") : null,
      ].filter(Boolean).join(" · ");
      const imgBlock = a.ogImage
        ? `<a href="${a.url}" style="display:block;text-decoration:none;"><img src="${a.ogImage}" alt="" width="100%" style="display:block;width:100%;height:auto;max-height:240px;object-fit:cover;border-radius:6px 6px 0 0;" /></a>`
        : "";
      return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border-collapse:collapse;background:#0f172a;border-radius:8px;overflow:hidden;border:1px solid #1e293b;">
  <tr><td>
    ${imgBlock}
    <div style="padding:16px;">
      <div style="margin-bottom:10px;">
        <span style="background:${color}22;color:${color};font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;border:1px solid ${color}44;">${a.category}</span>
        <span style="color:#475569;font-size:11px;margin-left:8px;">${meta}</span>
      </div>
      <a href="${a.url}" style="display:block;color:#e2e8f0;font-size:16px;font-weight:600;text-decoration:none;line-height:1.4;margin-bottom:8px;">${a.title}</a>
      <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 10px;">${a.summary}</p>
      <div style="border-left:2px solid #f59e0b;padding-left:10px;">
        <p style="color:#64748b;font-size:12px;line-height:1.5;margin:0;font-style:italic;">${a.bdRelevance}</p>
      </div>
    </div>
  </td></tr>
</table>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Physical AI News</title>
  <style>
    body { margin:0; padding:0; background:#020817; -webkit-text-size-adjust:100%; }
    img { border:0; outline:none; text-decoration:none; }
    a { color:#93c5fd; }
    @media only screen and (max-width:600px) {
      .wrapper { padding: 16px 12px !important; }
      .article-title { font-size:15px !important; }
    }
  </style>
</head>
<body style="background:#020817;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#020817;">
    <tr><td align="center">
      <table class="wrapper" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;padding:32px 20px;">
        <tr><td>
          <!-- Header -->
          <div style="height:3px;background:linear-gradient(90deg,#1B3A6B,#2E5EA8,transparent);margin-bottom:32px;border-radius:2px;"></div>
          <h1 style="color:#f1f5f9;font-size:26px;font-weight:700;margin:0 0 6px;letter-spacing:-0.02em;">Physical AI News</h1>
          <p style="color:#475569;font-size:13px;margin:0 0 32px;">${date}</p>
          <!-- Stories -->
          ${articleRows}
          <!-- Footer -->
          <p style="color:#334155;font-size:11px;text-align:center;margin-top:8px;">© Mark Fok · Physical AI News · Powered by Exa + Claude</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const articles = await fetchRoboticsNews();
    if (articles.length === 0) {
      return NextResponse.json({ error: "No articles found" }, { status: 404 });
    }

    const digest = await generateDigest(articles);
    const html = buildEmailHtml(digest);

    const resend = new Resend(process.env.RESEND_API_KEY!);
    const date = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const { data, error } = await resend.emails.send({
      from: "Physical AI Daily <onboarding@resend.dev>",
      to: ["fokjenhong@gmail.com"],
      subject: `Physical AI Daily — ${date}`,
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
