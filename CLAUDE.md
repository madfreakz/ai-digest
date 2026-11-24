# Frontier AI Digest

Daily AI news digest (frontier-ai-digest.vercel.app). Solo repo, push to main.

## Obsidian Context (read before working)

**Always read:** `~/Documents/Obsidian Vault/Projects/Frontier AI Digest/Backlog.md`
If an issue is already tracked there, reference it instead of reinvestigating.

**For backend/pipeline work:** `~/Documents/Obsidian Vault/Projects/Frontier AI Digest/Engineering-Playbook.md`

**Before touching ANY Gemini call:** `~/Documents/Obsidian Vault/Knowledge/Engineering/gemini-production-rules.md` — the rules that apply to every Gemini app, not just this one (output-token budgets sized to worst-case output, thinking-budget floors per model tier, throw-don't-return-empty, fencing untrusted input).

**For recent changes:** `~/Documents/Obsidian Vault/Projects/Frontier AI Digest/Log.md` (first 80 lines, newest at top)

Present backlog highlights and ask what to work on.

## OpenRouter 3-Slot Routing & Flex (`:floor`)

- **Router (`lib/llm.ts`):** When `OPENROUTER_API_KEY` is set (live in Production & `.env.local`), triage (`deepseek/deepseek-v4.1-flash:floor`), scoring (`openai/gpt-5.4-nano:floor` + fallbacks), and synthesis (`google/gemini-4-hydrogen:floor`) route via OpenRouter (`~$0.52/mo` Flex, `~$1.03/mo` standard). Unsetting `OPENROUTER_API_KEY` restores `@google/genai` (`GOOGLE_API_KEY` / `GOOGLE_API_KEY_SYNTHESIS` remain intact for rollback).
- **Compatibility rules:** Omit `temperature` on `openai/gpt-5*` models (HTTP 404 under `require_parameters: true`); keep `reasoning: { effort: "low" }` + `16384` scoring `maxTokens` + `120_000ms` timeout; avoid `qwen/qwen3.8-flash` and `qwen/qwen3.7-plus` (empty JSON completions in structured mode).
- **Blind model benchmark:** `npm run eval:models` (`scripts/model-ab.ts`, `--all-beats`) tests candidates on real RSS articles with `$0` Exa spend.

## Known Pitfalls

- **Beat route:** `/api/beat?beat=X` (NOT `/api/cron/refresh-beat`); crons run `10:00-13:00 UTC` (off-peak DeepSeek + US overnight Flex trough) before `14:00 UTC` send-digest.
- **CRON_SECRET:** `.env.local` wraps value in quotes. Strip with `tr -d '"'`.
- **Vercel teamId:** `team_IZNKs5SRAVbEkqzi4Z9OglTO` (NOT "markfoks-projects")
- **Gemini rate limits (when falling back to direct Gemini):** Space beat refreshes 10s+ apart. 0 articles = wait 2 min, retry once.
- **Two "Recursive" companies:** Recursive Superintelligence (recursive.com, Socher, AI Labs) vs Ricursive Intelligence (ricursive.ai, Goldie, AI Infrastructure). Different companies.
- **Don't reinvestigate Backlog items.** Reference them, don't rediscover root causes.

## Deploy Rules

- Deploy via `git push` (not `vercel --prod`). Stage specific files (not `git add -A`).
- Only refresh beats if changes touch `lib/summarize.ts`, `lib/llm.ts`, `lib/exa.ts`, `lib/rss.ts`, `lib/filters.ts`, `lib/companies.ts`, `lib/beat-digests.ts`, or the beat API route. Ask which beat(s). Default to one.
- Minimize paid Exa/LLM API calls (`npm run eval:models` uses RSS only for `$0` Exa spend).
