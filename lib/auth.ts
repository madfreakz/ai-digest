import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Constant-time Bearer token check shared by all protected cron/admin routes.
// Returns null when authorized, or a 500/401 NextResponse to return early.
export function requireCronAuth(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[auth] CRON_SECRET not configured — refusing request");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
