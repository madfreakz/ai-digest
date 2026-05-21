# Frontier AI Digest

Daily AI news digest (frontier-ai-digest.vercel.app). Solo repo, push to main.

## Obsidian Context (read before working)

**Always read:** `~/Documents/Obsidian Vault/Projects/Frontier AI Digest/Backlog.md`
If an issue is already tracked there, reference it instead of reinvestigating.

**For backend/pipeline work:** `~/Documents/Obsidian Vault/Projects/Frontier AI Digest/Engineering-Playbook.md`

**For recent changes:** `~/Documents/Obsidian Vault/Projects/Frontier AI Digest/Log.md` (last 80 lines)

Present backlog highlights and ask what to work on.

## Known Pitfalls

- **Beat route:** `/api/beat?beat=X` (NOT `/api/cron/refresh-beat`)
- **CRON_SECRET:** `.env.local` wraps value in quotes. Strip with `tr -d '"'`.
- **Vercel teamId:** `team_IZNKs5SRAVbEkqzi4Z9OglTO` (NOT "markfoks-projects")
- **Gemini rate limits:** Space beat refreshes 10s+ apart. 0 articles = wait 2 min, retry once.
- **Two "Recursive" companies:** Recursive Superintelligence (recursive.com, Socher, AI Labs) vs Ricursive Intelligence (ricursive.ai, Goldie, AI Infrastructure). Different companies.
- **Don't reinvestigate Backlog items.** Reference them, don't rediscover root causes.

## Deploy Rules

- Deploy via `git push` (not `vercel --prod`). Stage specific files (not `git add -A`).
- Only refresh beats if changes touch `lib/summarize.ts`, `lib/exa.ts`, `lib/companies.ts`, `lib/beat-digests.ts`, or the beat API route. Ask which beat(s). Default to one.
- Minimize API calls. Each beat refresh costs ~$0.16 (Gemini + Exa).
