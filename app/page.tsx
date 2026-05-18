import DigestClient from "@/components/DigestClient";
import DigestLoader from "@/components/DigestLoader";
import { MOCK_DIGEST } from "@/lib/mock-digest";
import type { Digest } from "@/lib/summarize";

export const dynamic = "force-dynamic";

function todayKey(): string {
  return `digest:v3:${new Date().toISOString().split("T")[0]}`;
}

async function kvRead(): Promise<Digest | null> {
  try {
    const { kv } = await import("@vercel/kv");
    const val = await kv.get<Digest>(todayKey());
    return val && (val as Digest).articles?.length > 0 ? val : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  if (process.env.NODE_ENV === "development") {
    return <DigestClient digest={MOCK_DIGEST} />;
  }

  // Page only reads from KV — never runs generation inline (would timeout)
  const digest = await kvRead();
  if (digest) return <DigestClient digest={digest} />;

  // KV empty: render shell immediately, client-side component fetches /api/digest
  return <DigestLoader />;
}
