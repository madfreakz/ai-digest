import type { z } from "zod";

export type LlmRole = "triage" | "scoring" | "synthesis";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_ROLE_MODELS: Record<LlmRole, string[]> = {
  triage: [
    "deepseek/deepseek-v4.1-flash",
    "google/gemini-2.5-flash-lite",
    "qwen/qwen3.8-flash",
  ],
  scoring: [
    "deepseek/deepseek-v4.1-flash",
    "qwen/qwen3.8-flash",
    "openai/gpt-5.6-luna",
    "google/gemini-3.5-flash-lite",
  ],
  synthesis: [
    "google/gemini-4-hydrogen",
    "openai/gpt-5.6-luna",
    "qwen/qwen3.7-plus",
    "google/gemini-3.5-flash-lite",
  ],
};

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function dedupeModels(models: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of models) {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function getRoleModels(role: LlmRole): string[] {
  if (role === "triage") {
    const primary = process.env.OPENROUTER_TRIAGE_MODEL;
    return dedupeModels([
      ...(primary ? [primary] : []),
      ...DEFAULT_ROLE_MODELS.triage,
    ]);
  }

  if (role === "scoring") {
    const primary = process.env.OPENROUTER_SCORING_MODEL;
    const customFallbacks = process.env.OPENROUTER_SCORING_FALLBACKS
      ? process.env.OPENROUTER_SCORING_FALLBACKS.split(",")
      : [];
    return dedupeModels([
      ...(primary ? [primary] : []),
      ...customFallbacks,
      ...DEFAULT_ROLE_MODELS.scoring,
    ]);
  }

  const primary = process.env.OPENROUTER_SYNTHESIS_MODEL;
  return dedupeModels([
    ...(primary ? [primary] : []),
    ...DEFAULT_ROLE_MODELS.synthesis,
  ]);
}

export function stripJsonFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface OpenRouterJsonOptions<T> {
  role: LlmRole;
  models?: string[];
  systemInstruction: string;
  prompt: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  temperature: number;
  maxTokens: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  fetchImpl?: FetchLike;
}

export interface OpenRouterJsonResult<T> {
  data: T;
  modelUsed: string;
  fallbackUsed: boolean;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export async function callOpenRouterJson<T>(
  opts: OpenRouterJsonOptions<T>,
): Promise<OpenRouterJsonResult<T>> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("[openrouter] OPENROUTER_API_KEY is not configured");
  }

  const models = opts.models && opts.models.length > 0 ? opts.models : getRoleModels(opts.role);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const baseDelayMs = opts.baseDelayMs ?? 3_000;

  let lastError: unknown;

  for (let modelIdx = 0; modelIdx < models.length; modelIdx++) {
    const model = models[modelIdx];
    let useJsonObjectFallback = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      const useJsonSchema = Boolean(opts.jsonSchema) && !useJsonObjectFallback;
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: opts.systemInstruction },
          { role: "user", content: opts.prompt },
        ],
        response_format: useJsonSchema
          ? {
              type: "json_schema",
              json_schema: {
                name: opts.jsonSchema!.name,
                strict: false,
                schema: opts.jsonSchema!.schema,
              },
            }
          : { type: "json_object" },
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
      };
      if (useJsonSchema) {
        body.provider = { require_parameters: true };
      }

      try {
        const res = await fetchImpl(OPENROUTER_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://frontier-ai-digest.vercel.app",
            "X-Title": "Frontier AI Digest",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if ((res.status === 400 || res.status === 422) && useJsonSchema && !useJsonObjectFallback) {
          useJsonObjectFallback = true;
          console.warn(`[openrouter] ${opts.role} (${model}) rejected json_schema (HTTP ${res.status}); retrying with json_object`);
          continue;
        }

        const payload = await res.json().catch(() => ({})) as Record<string, unknown>;
        if (!res.ok) {
          const errMsg = JSON.stringify(payload).slice(0, 240);
          lastError = new Error(`OpenRouter HTTP ${res.status} (${model}): ${errMsg}`);
          console.warn(`[openrouter] ${opts.role} (${model}) attempt ${attempt + 1}/2 failed: HTTP ${res.status}`);
          if (attempt === 0 && isTransientStatus(res.status)) {
            if (baseDelayMs > 0) await new Promise(r => setTimeout(r, baseDelayMs));
            continue;
          }
          break;
        }

        const choices = Array.isArray(payload.choices) ? payload.choices : [];
        const firstChoice = choices[0] as { message?: { content?: unknown } } | undefined;
        const rawContent = typeof firstChoice?.message?.content === "string"
          ? firstChoice.message.content
          : "";
        const cleaned = stripJsonFences(rawContent);

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(cleaned);
        } catch (parseErr) {
          lastError = new Error(
            `OpenRouter JSON parse failed (${model}): ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
          );
          console.warn(`[openrouter] ${opts.role} (${model}) returned invalid JSON:`, cleaned.slice(0, 140));
          if (attempt === 0) {
            if (baseDelayMs > 0) await new Promise(r => setTimeout(r, baseDelayMs));
            continue;
          }
          break;
        }

        const validated = opts.schema.safeParse(parsedJson);
        if (!validated.success) {
          lastError = new Error(`OpenRouter schema validation failed (${model}): ${validated.error.message}`);
          console.warn(`[openrouter] ${opts.role} (${model}) schema mismatch:`, validated.error.message.slice(0, 200));
          if (attempt === 0) {
            if (baseDelayMs > 0) await new Promise(r => setTimeout(r, baseDelayMs));
            continue;
          }
          break;
        }

        const usageRaw = payload.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
        const usedModel = typeof payload.model === "string" && payload.model.trim() ? payload.model : model;
        if (modelIdx > 0) {
          console.log(`[openrouter] ${opts.role} recovered via fallback model ${usedModel}`);
        }
        return {
          data: validated.data,
          modelUsed: usedModel,
          fallbackUsed: modelIdx > 0,
          usage: {
            promptTokens: usageRaw?.prompt_tokens ?? 0,
            completionTokens: usageRaw?.completion_tokens ?? 0,
          },
        };
      } catch (err) {
        lastError = err;
        console.warn(
          `[openrouter] ${opts.role} (${model}) attempt ${attempt + 1}/2 error:`,
          err instanceof Error ? err.message : String(err),
        );
        if (attempt === 0) {
          if (baseDelayMs > 0) await new Promise(r => setTimeout(r, baseDelayMs));
          continue;
        }
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`[openrouter] ${opts.role} failed across all models (${models.join(", ")})`);
}
