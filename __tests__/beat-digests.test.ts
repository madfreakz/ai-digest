import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import * as beatDigests from "@/lib/beat-digests";
import { kv } from "@vercel/kv";

jest.mock("@vercel/kv");
jest.mock("@/lib/exa");
jest.mock("@/lib/summarize");

const mockKv = kv as jest.Mocked<typeof kv>;

const mockArticles = [
  {
    title: "Test Article 1",
    url: "https://example.com/1",
    publishedAt: "2025-05-18T10:00:00Z",
    text: "Test content",
    source: "example.com",
    ogImage: null,
    beat: "Physical AI" as const,
    category: "Funding" as const,
    companyTags: ["Company1"],
    summary: "Test summary",
    bdRelevance: "Test relevance",
    relevanceScore: 8,
    impactScore: 7,
    impactReason: "Test reason",
    dealSignal: true,
    dealSignalType: "funding_round" as const,
  },
];

describe("beat-digests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("cacheBeatArticles", () => {
    it("should cache articles for a beat with correct TTL", async () => {
      mockKv.setex = jest.fn().mockResolvedValue("OK");

      await beatDigests.cacheBeatArticles("Physical AI");

      expect(mockKv.setex).toHaveBeenCalled();
      const calls = (mockKv.setex as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain("beat:Physical AI:articles");
      expect(calls[0][1]).toBe(6 * 60 * 60); // 6 hour TTL
    });

    it("should handle beat cache errors gracefully", async () => {
      mockKv.setex = jest.fn().mockRejectedValue(new Error("KV Error"));

      const result = await beatDigests.cacheBeatArticles("Physical AI");

      expect(result).toEqual([]);
    });
  });

  describe("getBeatArticles", () => {
    it("should return cached articles if beat cache exists", async () => {
      const cached = JSON.stringify(mockArticles);
      mockKv.get = jest.fn().mockResolvedValue(cached);

      const result = await beatDigests.getBeatArticles("Physical AI");

      expect(result).toEqual(mockArticles);
      expect(mockKv.get).toHaveBeenCalledWith(expect.stringContaining("beat:Physical AI:articles"));
    });

    it("should return empty array if cache miss and fetch fails", async () => {
      mockKv.get = jest.fn().mockResolvedValue(null);
      mockKv.setex = jest.fn().mockRejectedValue(new Error("Cache error"));

      const result = await beatDigests.getBeatArticles("Physical AI");

      expect(result).toEqual([]);
    });

    it("should handle cache read timeout gracefully", async () => {
      mockKv.get = jest.fn().mockRejectedValue(new Error("Timeout"));
      mockKv.setex = jest.fn().mockResolvedValue("OK");

      const result = await beatDigests.getBeatArticles("Physical AI");

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("aggregateDigestFromBeats", () => {
    it("should return aggregated digest from all beat caches", async () => {
      const digest = { articles: mockArticles, generatedAt: new Date().toISOString() };
      mockKv.get = jest.fn()
        .mockResolvedValueOnce(JSON.stringify(digest))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await beatDigests.aggregateDigestFromBeats();

      expect(result.articles).toBeDefined();
      expect(Array.isArray(result.articles)).toBe(true);
    });

    it("should return cached digest if aggregator cache is valid", async () => {
      const cachedDigest = { articles: mockArticles, generatedAt: new Date().toISOString() };
      mockKv.get = jest
        .fn()
        .mockResolvedValueOnce(JSON.stringify(cachedDigest)); // First call is aggregator cache

      const result = await beatDigests.aggregateDigestFromBeats();

      expect(result.articles).toEqual(mockArticles);
      expect((mockKv.get as jest.Mock).mock.calls.length).toBe(1); // Only called for aggregator
    });

    it("should return partial digest if some beat caches fail", async () => {
      mockKv.get = jest.fn()
        .mockResolvedValueOnce(null); // Aggregator cache miss

      mockKv.setex = jest.fn().mockResolvedValue("OK");

      const result = await beatDigests.aggregateDigestFromBeats();

      expect(Array.isArray(result.articles)).toBe(true);
    });

    it("should cache aggregated digest with 1 hour TTL", async () => {
      mockKv.get = jest.fn().mockResolvedValue(null);
      mockKv.setex = jest.fn().mockResolvedValue("OK");

      await beatDigests.aggregateDigestFromBeats();

      const setexCalls = (mockKv.setex as jest.Mock).mock.calls;
      const aggregatorCacheCall = setexCalls.find(call => call[0].includes("digest:aggregated"));
      expect(aggregatorCacheCall).toBeDefined();
      expect(aggregatorCacheCall[1]).toBe(1 * 60 * 60); // 1 hour TTL
    });
  });

  describe("Error resilience", () => {
    it("should handle concurrent getBeatArticles calls", async () => {
      mockKv.get = jest.fn().mockResolvedValue(null);
      mockKv.setex = jest.fn().mockResolvedValue("OK");

      const promises = [
        beatDigests.getBeatArticles("Physical AI"),
        beatDigests.getBeatArticles("Physical AI"),
      ];

      const results = await Promise.all(promises);

      expect(results.length).toBe(2);
      expect(Array.isArray(results[0])).toBe(true);
      expect(Array.isArray(results[1])).toBe(true);
    });
  });
});
