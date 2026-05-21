// Single source of truth for "is KV/Upstash configured?" so the three callers
// (companies, summarize, beat-digests) can't drift apart.
export const KV_CONFIGURED = !!(process.env.KV_REST_API_URL ?? process.env.KV_URL);

// Index of discovered company names. Maintained by storeDiscoveredCompanies so
// getCompanyNames() can read a single KV key instead of scanning `discovered:*`
// (which was ~50 KV ops per Gemini scoring pass).
export const DISCOVERED_INDEX_KEY = "discovered:index";
