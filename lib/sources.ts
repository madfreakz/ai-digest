export interface SourceEntry {
  domain: string;
  tier: 0 | 1 | 2 | 3 | 4;
  paywalled: boolean;
  name: string;
  category: "media" | "vc_blog" | "company_blog" | "research" | "newsletter" | "wire" | "aggregator";
}

const SOURCE_REGISTRY: SourceEntry[] = [
  // ── Tier 0: Super tier (always preferred when available) ────────────────────
  { domain: "techcrunch.com",             tier: 0, paywalled: false, name: "TechCrunch",                category: "media" },

  // ── Tier 1: Major tech/business media (free) ─────────────────────────────
  { domain: "venturebeat.com",            tier: 1, paywalled: false, name: "VentureBeat",               category: "media" },
  { domain: "arstechnica.com",            tier: 1, paywalled: false, name: "Ars Technica",              category: "media" },
  { domain: "theverge.com",               tier: 1, paywalled: false, name: "The Verge",                 category: "media" },
  { domain: "reuters.com",                tier: 1, paywalled: false, name: "Reuters",                   category: "media" },
  { domain: "cnbc.com",                   tier: 1, paywalled: false, name: "CNBC",                      category: "media" },
  { domain: "fortune.com",                tier: 1, paywalled: false, name: "Fortune",                   category: "media" },
  { domain: "thenextweb.com",             tier: 1, paywalled: false, name: "The Next Web",              category: "media" },
  { domain: "axios.com",                  tier: 1, paywalled: false, name: "Axios",                     category: "media" },
  { domain: "semafor.com",                tier: 1, paywalled: false, name: "Semafor",                   category: "media" },
  { domain: "wired.com",                  tier: 1, paywalled: false, name: "WIRED",                     category: "media" },
  { domain: "the-decoder.com",            tier: 1, paywalled: false, name: "The Decoder",               category: "media" },
  { domain: "siliconangle.com",           tier: 1, paywalled: false, name: "SiliconANGLE",              category: "media" },
  { domain: "apnews.com",                 tier: 1, paywalled: false, name: "AP News",                   category: "media" },

  // ── Tier 1: VC blogs (primary sources for funding) ────────────────────────
  { domain: "a16z.com",                   tier: 1, paywalled: false, name: "Andreessen Horowitz",       category: "vc_blog" },
  { domain: "sequoiacap.com",             tier: 1, paywalled: false, name: "Sequoia Capital",           category: "vc_blog" },
  { domain: "benchmark.com",              tier: 1, paywalled: false, name: "Benchmark",                 category: "vc_blog" },
  { domain: "greylock.com",               tier: 1, paywalled: false, name: "Greylock",                  category: "vc_blog" },
  { domain: "khoslaventures.com",         tier: 1, paywalled: false, name: "Khosla Ventures",           category: "vc_blog" },
  { domain: "luxcapital.com",             tier: 1, paywalled: false, name: "Lux Capital",               category: "vc_blog" },
  { domain: "eclipse.vc",                 tier: 1, paywalled: false, name: "Eclipse Ventures",          category: "vc_blog" },
  { domain: "radical.vc",                 tier: 1, paywalled: false, name: "Radical Ventures",          category: "vc_blog" },
  { domain: "lsvp.com",                   tier: 1, paywalled: false, name: "Lightspeed",                category: "vc_blog" },
  { domain: "redpoint.com",               tier: 1, paywalled: false, name: "Redpoint Ventures",         category: "vc_blog" },
  { domain: "conviction.com",             tier: 1, paywalled: false, name: "Conviction Capital",        category: "vc_blog" },
  { domain: "nea.com",                    tier: 1, paywalled: false, name: "NEA",                       category: "vc_blog" },
  { domain: "indexventures.com",          tier: 1, paywalled: false, name: "Index Ventures",            category: "vc_blog" },
  { domain: "generalcatalyst.com",        tier: 1, paywalled: false, name: "General Catalyst",          category: "vc_blog" },
  { domain: "kleinerperkins.com",         tier: 1, paywalled: false, name: "Kleiner Perkins",           category: "vc_blog" },
  { domain: "insightpartners.com",        tier: 1, paywalled: false, name: "Insight Partners",          category: "vc_blog" },
  { domain: "dcvc.com",                   tier: 1, paywalled: false, name: "DCVC",                      category: "vc_blog" },
  { domain: "accel.com",                  tier: 1, paywalled: false, name: "Accel",                     category: "vc_blog" },
  { domain: "coatue.com",                 tier: 1, paywalled: false, name: "Coatue Management",         category: "vc_blog" },
  { domain: "iconiqcapital.com",          tier: 1, paywalled: false, name: "ICONIQ Growth",             category: "vc_blog" },
  { domain: "gv.com",                     tier: 1, paywalled: false, name: "GV",                        category: "vc_blog" },
  { domain: "capitalg.com",              tier: 1, paywalled: false, name: "CapitalG",                  category: "vc_blog" },
  { domain: "menlovc.com",                tier: 1, paywalled: false, name: "Menlo Ventures",            category: "vc_blog" },
  { domain: "salesforceventures.com",     tier: 1, paywalled: false, name: "Salesforce Ventures",       category: "vc_blog" },
  { domain: "eqtventures.com",            tier: 1, paywalled: false, name: "EQT Ventures",              category: "vc_blog" },
  { domain: "bvp.com",                    tier: 1, paywalled: false, name: "Bessemer Venture Partners",  category: "vc_blog" },
  { domain: "sparkcapital.com",           tier: 1, paywalled: false, name: "Spark Capital",             category: "vc_blog" },

  // ── Tier 1: Big Tech official blogs ───────────────────────────────────────
  { domain: "blog.google",                tier: 1, paywalled: false, name: "Google Blog",               category: "company_blog" },
  { domain: "blogs.nvidia.com",           tier: 1, paywalled: false, name: "NVIDIA Blog",               category: "company_blog" },
  { domain: "openai.com",                 tier: 1, paywalled: false, name: "OpenAI",                    category: "company_blog" },
  { domain: "anthropic.com",              tier: 1, paywalled: false, name: "Anthropic",                 category: "company_blog" },
  { domain: "deepmind.google",            tier: 1, paywalled: false, name: "Google DeepMind",           category: "company_blog" },
  { domain: "ai.meta.com",               tier: 1, paywalled: false, name: "Meta AI",                   category: "company_blog" },
  { domain: "mistral.ai",                 tier: 1, paywalled: false, name: "Mistral AI",                category: "company_blog" },

  // ── Tier 2: Credible but paywalled ────────────────────────────────────────
  { domain: "bloomberg.com",              tier: 2, paywalled: true,  name: "Bloomberg",                 category: "media" },
  { domain: "wsj.com",                    tier: 2, paywalled: true,  name: "Wall Street Journal",       category: "media" },
  { domain: "ft.com",                     tier: 2, paywalled: true,  name: "Financial Times",           category: "media" },
  { domain: "markets.ft.com",             tier: 2, paywalled: true,  name: "FT Markets",                category: "media" },
  { domain: "theinformation.com",         tier: 2, paywalled: true,  name: "The Information",           category: "media" },
  { domain: "nytimes.com",                tier: 2, paywalled: true,  name: "New York Times",            category: "media" },
  { domain: "businessinsider.com",        tier: 2, paywalled: true,  name: "Business Insider",          category: "media" },
  { domain: "markets.businessinsider.com", tier: 2, paywalled: true, name: "Business Insider Markets",  category: "media" },

  // ── Tier 3: Specialized verticals & niche (still valuable) ────────────────
  // AI/ML-focused
  { domain: "theaiinsider.tech",          tier: 3, paywalled: false, name: "The AI Insider",            category: "newsletter" },
  { domain: "marktechpost.com",           tier: 3, paywalled: false, name: "MarkTechPost",              category: "media" },

  // Robotics vertical
  { domain: "humanoidsdaily.com",         tier: 3, paywalled: false, name: "Humanoids Daily",           category: "newsletter" },
  { domain: "humanoidhub.ai",             tier: 3, paywalled: false, name: "HumanoidHub",               category: "newsletter" },
  { domain: "robotwale.com",              tier: 3, paywalled: false, name: "RobotWale",                 category: "newsletter" },

  // Industrial/infrastructure vertical
  { domain: "drivesncontrols.com",        tier: 3, paywalled: false, name: "Drives & Controls",         category: "media" },
  { domain: "datacenterknowledge.com",    tier: 3, paywalled: false, name: "Data Center Knowledge",     category: "media" },
  { domain: "datacentremagazine.com",     tier: 3, paywalled: false, name: "Data Centre Magazine",      category: "media" },

  // Defense/government
  { domain: "defensescoop.com",           tier: 3, paywalled: false, name: "DefenseScoop",              category: "media" },

  // Regional tech
  { domain: "betakit.com",                tier: 3, paywalled: false, name: "BetaKit",                   category: "media" },
  { domain: "tech.eu",                    tier: 3, paywalled: false, name: "Tech.eu",                   category: "media" },
  { domain: "uktech.news",               tier: 3, paywalled: false, name: "UKTN",                      category: "media" },
  { domain: "trendingtopics.eu",          tier: 3, paywalled: false, name: "Trending Topics",           category: "media" },

  // General tech
  { domain: "techtimes.com",              tier: 3, paywalled: false, name: "Tech Times",                category: "media" },
  { domain: "interestingengineering.com", tier: 3, paywalled: false, name: "Interesting Engineering",   category: "media" },
  { domain: "winbuzzer.com",              tier: 3, paywalled: false, name: "WinBuzzer",                 category: "media" },
  { domain: "observer.com",               tier: 3, paywalled: false, name: "Observer",                  category: "media" },
  { domain: "startupfortune.com",         tier: 3, paywalled: false, name: "Startup Fortune",           category: "media" },
  { domain: "techstartups.com",           tier: 3, paywalled: false, name: "Tech Startups",             category: "media" },

  // Wire services / press releases / aggregators
  { domain: "prnewswire.com",             tier: 3, paywalled: false, name: "PR Newswire",               category: "wire" },
  { domain: "accessnewswire.com",         tier: 3, paywalled: false, name: "Access Newswire",           category: "wire" },
  { domain: "finance.yahoo.com",          tier: 3, paywalled: false, name: "Yahoo Finance",             category: "aggregator" },
  { domain: "morningstar.com",            tier: 3, paywalled: false, name: "Morningstar",               category: "aggregator" },
  { domain: "investingnews.com",          tier: 3, paywalled: false, name: "Investing News",            category: "aggregator" },
  { domain: "stocktitan.net",             tier: 3, paywalled: false, name: "Stock Titan",               category: "wire" },

  // Developer / community platforms
  { domain: "huggingface.co",             tier: 3, paywalled: false, name: "Hugging Face",              category: "research" },
  { domain: "dev.to",                     tier: 3, paywalled: false, name: "DEV Community",             category: "research" },
];

const domainIndex = new Map<string, SourceEntry>();
for (const entry of SOURCE_REGISTRY) {
  domainIndex.set(entry.domain, entry);
}

const DEFAULT_ENTRY: Omit<SourceEntry, "domain" | "name"> = {
  tier: 4,
  paywalled: false,
  category: "media",
};

export function lookupSource(hostname: string): SourceEntry {
  const normalized = hostname.replace(/^www\./, "");
  const entry = domainIndex.get(normalized);
  if (entry) return entry;
  return { domain: normalized, name: normalized, ...DEFAULT_ENTRY };
}

export function getEffectivePriority(hostname: string): number {
  const source = lookupSource(hostname);
  if (source.paywalled) return source.tier + 0.5;
  return source.tier;
}

export { SOURCE_REGISTRY };
