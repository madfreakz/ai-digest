// Reads the Jev shadow log from KV and writes a markdown disagreement report.
// Usage: npm run jev:report  (reads KV_REST_API_URL + KV_REST_API_TOKEN from .env.local)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { kv } from "@vercel/kv";
import { buildShadowReport, type ShadowRecord } from "../lib/jev-shadow";

async function main() {
  const keys = await kv.keys("jev-shadow:*");
  if (keys.length === 0) {
    console.log("No jev-shadow records in KV yet.");
    return;
  }
  const records = (await Promise.all(keys.map(k => kv.get<ShadowRecord>(k)))).filter(Boolean) as ShadowRecord[];
  const outDir = join(process.cwd(), "scripts", "out");
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `jev-shadow-${new Date().toISOString().slice(0, 10)}.md`);
  writeFileSync(file, buildShadowReport(records));
  console.log(`${records.length} records -> ${file}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
