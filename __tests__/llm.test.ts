import { test, describe } from "node:test";
import assert from "node:assert";
import { z } from "zod";
import { callOpenRouterJson, getRoleModels, stripJsonFences } from "../lib/llm";
import { summarizeBeat } from "../lib/summarize";
import type { ExaArticle } from "../lib/exa";

describe("getRoleModels", () => {
  test("returns default 3-slot models and honors env overrides without duplicates", () => {
    const prevTriage = process.env.OPENROUTER_TRIAGE_MODEL;
    const prevScoring = process.env.OPENROUTER_SCORING_MODEL;
    const prevFallbacks = process.env.OPENROUTER_SCORING_FALLBACKS;
    const prevSynth = process.env.OPENROUTER_SYNTHESIS_MODEL;

    try {
      delete process.env.OPENROUTER_TRIAGE_MODEL;
      delete process.env.OPENROUTER_SCORING_MODEL;
      delete process.env.OPENROUTER_SCORING_FALLBACKS;
      delete process.env.OPENROUTER_SYNTHESIS_MODEL;

      assert.equal(getRoleModels("triage")[0], "deepseek/deepseek-v4.1-flash");
      assert.equal(getRoleModels("scoring")[0], "deepseek/deepseek-v4.1-flash");
      assert.equal(getRoleModels("synthesis")[0], "google/gemini-4-hydrogen");

      process.env.OPENROUTER_SCORING_MODEL = "qwen/qwen3.8-flash";
      process.env.OPENROUTER_SCORING_FALLBACKS = "openai/gpt-5.6-luna, qwen/qwen3.8-flash";
      const scoring = getRoleModels("scoring");
      assert.equal(scoring[0], "qwen/qwen3.8-flash");
      assert.equal(scoring[1], "openai/gpt-5.6-luna");
      assert.equal(scoring.filter(m => m === "qwen/qwen3.8-flash").length, 1);
    } finally {
      if (prevTriage === undefined) delete process.env.OPENROUTER_TRIAGE_MODEL;
      else process.env.OPENROUTER_TRIAGE_MODEL = prevTriage;
      if (prevScoring === undefined) delete process.env.OPENROUTER_SCORING_MODEL;
      else process.env.OPENROUTER_SCORING_MODEL = prevScoring;
      if (prevFallbacks === undefined) delete process.env.OPENROUTER_SCORING_FALLBACKS;
      else process.env.OPENROUTER_SCORING_FALLBACKS = prevFallbacks;
      if (prevSynth === undefined) delete process.env.OPENROUTER_SYNTHESIS_MODEL;
      else process.env.OPENROUTER_SYNTHESIS_MODEL = prevSynth;
    }
  });
});

describe("stripJsonFences", () => {
  test("strips markdown json code fences", () => {
    assert.equal(stripJsonFences("```json\n{\"a\":1}\n```"), "{\"a\":1}");
    assert.equal(stripJsonFences("{\"a\":1}"), "{\"a\":1}");
  });
});

describe("callOpenRouterJson", () => {
  const schema = z.object({ ok: z.boolean(), note: z.string() });

  test("parses fenced JSON, falls back from json_schema 400 to json_object, and fails over across models", async () => {
    const prevKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "sk-or-test-key";

    try {
      const seenFormats: Array<string> = [];
      const seenModels: Array<string> = [];

      const res = await callOpenRouterJson({
        role: "scoring",
        models: ["model-a", "model-b"],
        systemInstruction: "sys",
        prompt: "usr",
        schema,
        jsonSchema: { name: "test_schema", schema: { type: "object" } },
        temperature: 0.1,
        maxTokens: 256,
        baseDelayMs: 0,
        fetchImpl: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as any;
          seenModels.push(body.model);
          seenFormats.push(body.response_format?.type);

          if (body.model === "model-a" && body.response_format?.type === "json_schema") {
            return new Response(JSON.stringify({ error: "unsupported json_schema" }), { status: 400 });
          }
          if (body.model === "model-a") {
            return new Response(JSON.stringify({ error: "overloaded" }), { status: 503 });
          }
          return new Response(
            JSON.stringify({
              model: "model-b",
              choices: [{ message: { content: "```json\n{\"ok\":true,\"note\":\"clean\"}\n```" } }],
              usage: { prompt_tokens: 120, completion_tokens: 24 },
            }),
            { status: 200 },
          );
        },
      });

      assert.deepEqual(res.data, { ok: true, note: "clean" });
      assert.equal(res.modelUsed, "model-b");
      assert.equal(res.fallbackUsed, true);
      assert.equal(res.usage.promptTokens, 120);
      assert.equal(seenModels[0], "model-a");
      assert.equal(seenFormats[0], "json_schema");
      assert.equal(seenFormats[1], "json_object");
      assert.ok(seenModels.includes("model-b"));
    } finally {
      if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = prevKey;
    }
  });

  test("throws when all candidate models fail", async () => {
    const prevKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "sk-or-test-key";
    try {
      await assert.rejects(
        () =>
          callOpenRouterJson({
            role: "scoring",
            models: ["model-a", "model-b"],
            systemInstruction: "sys",
            prompt: "usr",
            schema,
            temperature: 0.1,
            maxTokens: 256,
            baseDelayMs: 0,
            fetchImpl: async () => new Response(JSON.stringify({ error: "down" }), { status: 503 }),
          }),
        /HTTP 503/,
      );
    } finally {
      if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = prevKey;
    }
  });
});

describe("summarizeBeat via OpenRouter", () => {
  test("routes scoring through OpenRouter when ai is null and OPENROUTER_API_KEY is set", async () => {
    const prevKey = process.env.OPENROUTER_API_KEY;
    const prevModel = process.env.OPENROUTER_SCORING_MODEL;
    const prevFetch = globalThis.fetch;

    process.env.OPENROUTER_API_KEY = "sk-or-test-key";
    process.env.OPENROUTER_SCORING_MODEL = "deepseek/deepseek-v4.1-flash";

    const article: ExaArticle = {
      title: "OpenAI launches new inference router",
      url: "https://openai.com/index/router",
      publishedAt: new Date().toISOString(),
      text: "OpenAI released a new model router lowering inference costs.",
      source: "openai.com",
      ogImage: null,
      beatHint: "AI Labs",
    };

    try {
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            model: "deepseek/deepseek-v4.1-flash",
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    articles: [
                      {
                        title: article.title,
                        url: article.url,
                        source: "openai.com",
                        beat: "AI Labs",
                        category: "Product",
                        companyTags: ["OpenAI"],
                        summary: "OpenAI released a new router. It cuts inference latency.",
                        bdRelevance: "Bundled routing squeezes standalone LLM gateway startups.",
                        relevanceScore: 9,
                        impactScore: 8,
                        impactReason: "Shifts routing layer economics.",
                        dealSignal: true,
                        dealSignalType: "product_launch",
                        excludedIndustry: false,
                        storyId: "openai-router",
                      },
                    ],
                    discoveredCompanies: [],
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 500, completion_tokens: 150 },
          }),
          { status: 200 },
        )) as typeof fetch;

      const res = await summarizeBeat("AI Labs", [article], null, "ignored", { baseDelayMs: 0 });
      assert.equal(res.articles.length, 1);
      assert.equal(res.modelUsed, "deepseek/deepseek-v4.1-flash");
      assert.equal(res.fallbackUsed, false);
      assert.equal(res.articles[0].companyTags[0], "OpenAI");
    } finally {
      globalThis.fetch = prevFetch;
      if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = prevKey;
      if (prevModel === undefined) delete process.env.OPENROUTER_SCORING_MODEL;
      else process.env.OPENROUTER_SCORING_MODEL = prevModel;
    }
  });
});
