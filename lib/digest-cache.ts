import { unstable_cache } from "next/cache";
import { fetchAllNews } from "./exa";
import { generateDigest } from "./summarize";
import type { Digest } from "./summarize";

export const DIGEST_TAG = "digest";

export const getDigest = unstable_cache(
  async (): Promise<Digest | null> => {
    const articles = await fetchAllNews();
    if (articles.length === 0) return null;
    const digest = await generateDigest(articles);
    return digest.articles.length > 0 ? digest : null;
  },
  [DIGEST_TAG],
  { revalidate: 48 * 60 * 60, tags: [DIGEST_TAG] }
);
