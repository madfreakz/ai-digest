import { kv } from "@vercel/kv";
import { KV_CONFIGURED, DISCOVERED_INDEX_KEY } from "./kv-config";

export type Beat = "Physical AI" | "AI Infrastructure" | "AI Labs" | "Vertical AI";

export type DealSignalType =
  | "funding_round"
  | "partnership_announced"
  | "customer_win"
  | "hiring_signal"
  | "positioning_shift"
  | "competitive_move"
  | "product_launch";

export type DealVector =
  | "potential_customer"
  | "strategic_partner"
  | "competitive_threat"
  | "technology_dependency"
  | "acquisition_target";

export interface TrackedCompany {
  name: string;
  beat: Beat;
  tier: 1 | 2 | 3;
  dealVector: DealVector[];
  vcBacked: string[];
  addedAt: string;
  domain?: string;
}

export interface DiscoveredCompany {
  name: string;
  domain: string;
  beat: Beat;
  firstSeen: string;
  lastSeen: string;
  count: number;
}

// Names Gemini keeps rediscovering that the user has explicitly dismissed.
// Filtered out of both the discoveredCompanies pipeline and tag matching.
export const DISCOVERY_BLOCKLIST = new Set<string>([
  "sigma computing",
]);

export function isBlockedDiscovery(name: string): boolean {
  return DISCOVERY_BLOCKLIST.has(name.toLowerCase().trim());
}

// Domain aliases for companies that appear as article tags but may not be in the COMPANIES list,
// or whose names differ from their domain. Used by logo pre-caching and live Clearbit lookup.
export const DOMAIN_ALIASES: Record<string, string> = {
  "google": "google.com",
  "meta": "meta.com",
  "microsoft": "microsoft.com",
  "nvidia": "nvidia.com",
  "amazon": "amazon.com",
  "apple": "apple.com",
  "stability ai": "stability.ai",
  "hugging face": "huggingface.co",
  "databricks": "databricks.com",
  "scale ai": "scale.com",
  "inflection": "inflection.ai",
  "adept": "adept.ai",
  "character ai": "character.ai",
  "perplexity": "perplexity.ai",
  "runway": "runwayml.com",
  "midjourney": "midjourney.com",
  "ricursive intelligence": "ricursive.ai",
  "recursive superintelligence": "recursive.com",
  "sunday robotics": "sundayrobotics.com",
  "zipline": "flyzipline.com",
  "deep robotics": "deeprobotics.cn",
  "xpeng robotics": "xpeng.com",
  "may mobility": "maymobility.com",
  "locus robotics": "locusrobotics.com",
  "kind humanoid": "kindhumanoid.com",
  "etched": "etched.com",
  "parallel": "parallel.ai",
  "san francisco compute": "sfcompute.com",
  "fal": "fal.ai",
  "lancedb": "lancedb.com",
  "cleanlab": "cleanlab.ai",
  "twelve labs": "twelvelabs.io",
  "contextual ai": "contextual.ai",
  "goodfire": "goodfire.ai",
  "matter intelligence": "matterintelligence.com",
  "dust": "dust.tt",
  "gamma": "gamma.app",
  "profound": "profound.co",
  "factory": "factory.ai",
  "cline": "cline.bot",
  "11x": "11x.ai",
  "vapi": "vapi.ai",
};

export const COMPANIES: TrackedCompany[] = [
  // ── Physical AI — tier 1 ──────────────────────────────────────────────────
  { name: "Physical Intelligence", beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "technology_dependency"], vcBacked: ["Sequoia", "Lux Capital"],           addedAt: "2024-01-01", domain: "physicalintelligence.com" },
  { name: "Figure AI",             beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["Microsoft", "Bezos Expeditions"],  addedAt: "2024-01-01", domain: "figure.ai" },
  { name: "1X Technologies",       beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["OpenAI", "EQT Ventures"],          addedAt: "2024-01-01", domain: "1xtechnologies.com" },
  { name: "Boston Dynamics",       beat: "Physical AI", tier: 1, dealVector: ["potential_customer", "competitive_threat"],    vcBacked: ["Hyundai"],                         addedAt: "2024-01-01", domain: "bostondynamics.com" },
  { name: "Agility Robotics",      beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["Amazon", "DCVC"],                  addedAt: "2024-01-01", domain: "agilityrobotics.com" },
  { name: "Tesla",                 beat: "Physical AI", tier: 1, dealVector: ["competitive_threat", "potential_customer"],    vcBacked: [],                                  addedAt: "2024-01-01", domain: "tesla.com" },
  { name: "Apptronik",             beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["Google"],                          addedAt: "2024-01-01", domain: "apptronik.com" },
  { name: "Unitree",               beat: "Physical AI", tier: 1, dealVector: ["competitive_threat", "potential_customer"],    vcBacked: [],                                  addedAt: "2024-01-01", domain: "unitree.com" },
  { name: "Sanctuary AI",          beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["SoftBank"],                        addedAt: "2024-01-01", domain: "sanctuaryai.com" },
  { name: "Covariant",             beat: "Physical AI", tier: 1, dealVector: ["technology_dependency", "strategic_partner"],  vcBacked: ["Bessemer", "Radical Ventures"],    addedAt: "2024-01-01", domain: "covariant.ai" },
  { name: "Genesis AI",            beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["Eclipse Ventures", "Khosla Ventures"], addedAt: "2024-01-01" },
  { name: "Mind Robotics",         beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["Andreessen Horowitz", "Accel"],    addedAt: "2024-01-01" },
  { name: "Bedrock Robotics",      beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["Eclipse Ventures"],                addedAt: "2024-01-01" },
  { name: "Generalist AI",         beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: [],                                  addedAt: "2024-01-01" },
  { name: "Skild AI",              beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["SoftBank", "NVIDIA"],              addedAt: "2024-01-01", domain: "skild.ai" },
  { name: "Intrinsic",             beat: "Physical AI", tier: 1, dealVector: ["technology_dependency", "strategic_partner"],  vcBacked: ["Google"],                          addedAt: "2024-01-01", domain: "intrinsic.ai" },
  { name: "Waymo",                 beat: "Physical AI", tier: 1, dealVector: ["competitive_threat", "strategic_partner"],     vcBacked: ["Alphabet"],                        addedAt: "2026-05-18", domain: "waymo.com" },
  { name: "Wayve",                 beat: "Physical AI", tier: 1, dealVector: ["technology_dependency", "strategic_partner"],  vcBacked: ["Eclipse Ventures", "NVIDIA"],      addedAt: "2026-05-18", domain: "wayve.ai" },
  { name: "Applied Intuition",     beat: "Physical AI", tier: 1, dealVector: ["technology_dependency", "strategic_partner"],  vcBacked: ["Lux Capital"],                     addedAt: "2026-05-18", domain: "appliedintuition.com" },
  { name: "Waabi",                 beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["Radical Ventures"],                addedAt: "2026-05-18", domain: "waabi.ai" },
  { name: "Aurora Innovation",     beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["Sequoia"],                         addedAt: "2026-05-18", domain: "aurora.tech" },
  { name: "Pony.ai",               beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["SoftBank", "Toyota"],              addedAt: "2026-05-18", domain: "pony.ai" },
  { name: "WeRide",                beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["NVIDIA", "Bosch"],                 addedAt: "2026-05-18", domain: "weride.ai" },
  { name: "World Labs",            beat: "Physical AI", tier: 1, dealVector: ["technology_dependency", "strategic_partner"],  vcBacked: ["a16z", "Sequoia"],                 addedAt: "2026-05-18", domain: "worldlabs.ai" },
  // Physical AI — tier 2–3
  { name: "Flexiv",            beat: "Physical AI", tier: 2, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: [],                    addedAt: "2024-01-01" },
  { name: "Fourier Intelligence", beat: "Physical AI", tier: 2, dealVector: ["competitive_threat", "potential_customer"], vcBacked: [],                    addedAt: "2024-01-01" },
  { name: "Machina Labs",      beat: "Physical AI", tier: 2, dealVector: ["potential_customer", "strategic_partner"],     vcBacked: [],                    addedAt: "2024-01-01" },
  { name: "Bright Machines",   beat: "Physical AI", tier: 2, dealVector: ["potential_customer"],                         vcBacked: [],                    addedAt: "2024-01-01" },
  { name: "Symbotic",          beat: "Physical AI", tier: 2, dealVector: ["potential_customer", "competitive_threat"],   vcBacked: [],                    addedAt: "2024-01-01" },
  { name: "Nuro",              beat: "Physical AI", tier: 2, dealVector: ["potential_customer", "strategic_partner"],    vcBacked: ["GV", "NVIDIA"],      addedAt: "2026-05-18", domain: "nuro.ai" },
  { name: "Foxglove",          beat: "Physical AI", tier: 2, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Eclipse Ventures"],  addedAt: "2026-05-18", domain: "foxglove.dev" },
  { name: "Sarcos",            beat: "Physical AI", tier: 3, dealVector: ["strategic_partner"],                         vcBacked: [],                    addedAt: "2024-01-01" },
  // Physical AI — new additions (2026-05-21)
  { name: "Sunday Robotics",  beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: [],                    addedAt: "2026-05-21", domain: "sundayrobotics.com" },
  { name: "Zipline",          beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: [],                    addedAt: "2026-05-21", domain: "flyzipline.com" },
  { name: "DEEP Robotics",    beat: "Physical AI", tier: 2, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: [],                    addedAt: "2026-05-21", domain: "deeprobotics.cn" },
  { name: "XPENG Robotics",   beat: "Physical AI", tier: 2, dealVector: ["competitive_threat", "potential_customer"],   vcBacked: [],                    addedAt: "2026-05-21", domain: "xpeng.com" },
  { name: "May Mobility",     beat: "Physical AI", tier: 2, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: [],                    addedAt: "2026-05-21", domain: "maymobility.com" },
  { name: "Locus Robotics",   beat: "Physical AI", tier: 2, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: [],                    addedAt: "2026-05-21", domain: "locusrobotics.com" },
  { name: "Kind Humanoid",    beat: "Physical AI", tier: 2, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: [],                    addedAt: "2026-05-21", domain: "kindhumanoid.com" },
  { name: "HyperShell",       beat: "Physical AI", tier: 3, dealVector: ["strategic_partner"],                           vcBacked: [],                    addedAt: "2026-05-21" },
  { name: "NanoClaw",         beat: "Physical AI", tier: 3, dealVector: ["strategic_partner"],                           vcBacked: [],                    addedAt: "2026-05-21" },

  // ── AI Infrastructure — tier 1 ────────────────────────────────────────────
  { name: "Exa",               beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Lightspeed"],                        addedAt: "2024-01-01", domain: "exa.ai" },
  { name: "Anyscale",          beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["a16z", "NEA"],                       addedAt: "2024-01-01", domain: "anyscale.com" },
  { name: "Modal",             beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Redpoint"],                          addedAt: "2024-01-01", domain: "modal.com" },
  { name: "Replicate",         beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["a16z"],                              addedAt: "2024-01-01", domain: "replicate.com" },
  { name: "Together AI",       beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "competitive_threat"], vcBacked: ["Salesforce Ventures"],              addedAt: "2024-01-01", domain: "together.ai" },
  { name: "Weights & Biases",  beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["GV", "Insight Partners"],            addedAt: "2024-01-01", domain: "wandb.com" },
  { name: "LangChain",         beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Sequoia"],                           addedAt: "2024-01-01", domain: "langchain.com" },
  { name: "Weaviate",          beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Index Ventures"],                    addedAt: "2024-01-01", domain: "weaviate.io" },
  { name: "Pinecone",          beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "competitive_threat"], vcBacked: ["Andreessen Horowitz"],              addedAt: "2024-01-01", domain: "pinecone.io" },
  { name: "Parallel Web Systems", beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: [],                                addedAt: "2024-01-01" },
  { name: "Firecrawl",         beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: [],                                    addedAt: "2024-01-01", domain: "firecrawl.dev" },
  { name: "OpenRouter",        beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["a16z", "Menlo Ventures"],            addedAt: "2024-01-01", domain: "openrouter.ai" },
  { name: "CoreWeave",         beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["NVIDIA"],                            addedAt: "2026-05-18", domain: "coreweave.com" },
  { name: "Groq",              beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "competitive_threat"], vcBacked: ["a16z"],                             addedAt: "2026-05-18", domain: "groq.com" },
  { name: "Cerebras",          beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "competitive_threat"], vcBacked: ["Benchmark"],                        addedAt: "2026-05-18", domain: "cerebras.net" },
  { name: "Fireworks AI",      beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Benchmark"],                         addedAt: "2026-05-18", domain: "fireworks.ai" },
  { name: "Lambda",            beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Andreessen Horowitz"],               addedAt: "2026-05-18", domain: "lambdalabs.com" },
  { name: "Crusoe",            beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Radical Ventures"],                  addedAt: "2026-05-18", domain: "crusoe.ai" },
  { name: "Hugging Face",      beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Lux Capital", "Salesforce Ventures"], addedAt: "2026-05-18", domain: "huggingface.co" },
  { name: "Baseten",           beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Conviction Capital"],                addedAt: "2026-05-18", domain: "baseten.co" },
  { name: "Cartesia",          beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Conviction Capital", "NVIDIA"],      addedAt: "2026-05-18", domain: "cartesia.ai" },
  { name: "Modular",           beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "competitive_threat"], vcBacked: ["General Catalyst"],                 addedAt: "2026-05-18", domain: "modular.com" },
  // AI Infrastructure — tier 2–3
  { name: "Helicone",    beat: "AI Infrastructure", tier: 2, dealVector: ["technology_dependency"],                         vcBacked: [], addedAt: "2024-01-01" },
  { name: "Braintrust",  beat: "AI Infrastructure", tier: 2, dealVector: ["technology_dependency", "strategic_partner"],   vcBacked: [], addedAt: "2024-01-01" },
  { name: "Arize AI",    beat: "AI Infrastructure", tier: 2, dealVector: ["technology_dependency"],                         vcBacked: [], addedAt: "2024-01-01" },
  { name: "LlamaIndex",  beat: "AI Infrastructure", tier: 2, dealVector: ["technology_dependency"],                         vcBacked: [], addedAt: "2024-01-01" },
  { name: "Unstructured", beat: "AI Infrastructure", tier: 3, dealVector: ["technology_dependency"],                        vcBacked: [], addedAt: "2024-01-01" },
  // AI Infrastructure — new additions (2026-05-21)
  { name: "Ricursive Intelligence", beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: [],                addedAt: "2026-05-21", domain: "ricursive.ai" },
  { name: "Etched",                beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: [],                  addedAt: "2026-05-21", domain: "etched.com" },
  { name: "Parallel",              beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: [],                  addedAt: "2026-05-21", domain: "parallel.ai" },
  { name: "San Francisco Compute", beat: "AI Infrastructure", tier: 2, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: [],                  addedAt: "2026-05-21", domain: "sfcompute.com" },
  { name: "fal",                   beat: "AI Infrastructure", tier: 2, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: [],                  addedAt: "2026-05-21", domain: "fal.ai" },
  { name: "LanceDB",              beat: "AI Infrastructure", tier: 2, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: [],                  addedAt: "2026-05-21", domain: "lancedb.com" },
  { name: "Cleanlab",             beat: "AI Infrastructure", tier: 2, dealVector: ["technology_dependency"],                      vcBacked: [],                  addedAt: "2026-05-21", domain: "cleanlab.ai" },

  // ── AI Labs — tier 1 ──────────────────────────────────────────────────────
  { name: "Anthropic",       beat: "AI Labs", tier: 1, dealVector: ["strategic_partner", "technology_dependency"], vcBacked: ["Google", "Spark Capital"],       addedAt: "2024-01-01", domain: "anthropic.com" },
  { name: "OpenAI",          beat: "AI Labs", tier: 1, dealVector: ["competitive_threat", "technology_dependency"], vcBacked: ["Microsoft"],                    addedAt: "2024-01-01", domain: "openai.com" },
  { name: "Google DeepMind", beat: "AI Labs", tier: 1, dealVector: ["competitive_threat", "strategic_partner"],    vcBacked: ["Google"],                        addedAt: "2024-01-01", domain: "deepmind.google" },
  { name: "Meta AI",         beat: "AI Labs", tier: 1, dealVector: ["competitive_threat", "technology_dependency"], vcBacked: ["Meta"],                         addedAt: "2024-01-01", domain: "meta.com" },
  { name: "Mistral",         beat: "AI Labs", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Andreessen Horowitz", "Lightspeed"], addedAt: "2024-01-01", domain: "mistral.ai" },
  { name: "xAI",             beat: "AI Labs", tier: 1, dealVector: ["competitive_threat", "strategic_partner"],    vcBacked: [],                                addedAt: "2024-01-01", domain: "x.ai" },
  { name: "Cohere",          beat: "AI Labs", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["NVIDIA", "Salesforce Ventures"],  addedAt: "2024-01-01", domain: "cohere.ai" },
  // Big Tech — massive AI balance sheets and ecosystem influence
  { name: "NVIDIA",          beat: "AI Labs", tier: 1, dealVector: ["technology_dependency", "competitive_threat"], vcBacked: [],                               addedAt: "2026-05-18", domain: "nvidia.com" },
  { name: "Microsoft",       beat: "AI Labs", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],    vcBacked: [],                                addedAt: "2026-05-18", domain: "microsoft.com" },
  { name: "Apple",           beat: "AI Labs", tier: 1, dealVector: ["competitive_threat", "potential_customer"],   vcBacked: [],                                addedAt: "2026-05-18", domain: "apple.com" },
  { name: "Amazon",          beat: "AI Labs", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: [],                                addedAt: "2026-05-18", domain: "amazon.com" },
  // AI Labs — tier 2–3
  { name: "AI21 Labs",    beat: "AI Labs", tier: 2, dealVector: ["technology_dependency"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Inflection AI", beat: "AI Labs", tier: 2, dealVector: ["competitive_threat"],  vcBacked: [], addedAt: "2024-01-01" },
  { name: "Aleph Alpha",  beat: "AI Labs", tier: 2, dealVector: ["strategic_partner"],    vcBacked: [], addedAt: "2024-01-01" },
  { name: "Reka",         beat: "AI Labs", tier: 3, dealVector: ["technology_dependency"], vcBacked: [], addedAt: "2024-01-01" },
  // AI Labs — new additions (2026-05-21)
  { name: "Recursive Superintelligence", beat: "AI Labs", tier: 1, dealVector: ["strategic_partner", "competitive_threat"], vcBacked: ["GV", "Greycroft"], addedAt: "2026-05-21", domain: "recursive.com" },
  { name: "Twelve Labs",    beat: "AI Labs", tier: 2, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: [],  addedAt: "2026-05-21", domain: "twelvelabs.io" },
  { name: "Contextual AI",  beat: "AI Labs", tier: 2, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: [],  addedAt: "2026-05-21", domain: "contextual.ai" },
  { name: "Goodfire",       beat: "AI Labs", tier: 2, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: [],  addedAt: "2026-05-21", domain: "goodfire.ai" },
  { name: "Matter Intelligence", beat: "AI Labs", tier: 2, dealVector: ["technology_dependency"],                 vcBacked: [],  addedAt: "2026-05-21" },

  // ── Vertical AI — tier 1 ──────────────────────────────────────────────────
  { name: "Harvey",      beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],  vcBacked: ["Sequoia", "OpenAI"],                    addedAt: "2024-01-01", domain: "harvey.ai" },
  { name: "Rogo",        beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],  vcBacked: ["a16z"],                                 addedAt: "2024-01-01", domain: "rogolegal.com" },
  { name: "Sierra",      beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: ["Sequoia"],                              addedAt: "2024-01-01", domain: "sierrallm.com" },
  { name: "Decagon",     beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: ["a16z"],                                 addedAt: "2024-01-01", domain: "decagon.ai" },
  { name: "Glean",       beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],  vcBacked: ["Sequoia", "Coatue"],                    addedAt: "2024-01-01", domain: "glean.com" },
  { name: "Writer",      beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: ["ICONIQ Growth"],                        addedAt: "2024-01-01", domain: "writer.com" },
  { name: "Moveworks",   beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: ["Kleiner Perkins", "ICONIQ Growth"],     addedAt: "2024-01-01", domain: "moveworks.com" },
  { name: "Cognigy",     beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: [],                                       addedAt: "2024-01-01", domain: "cognigy.com" },
  { name: "Cursor",      beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: ["Accel", "Coatue", "NVIDIA"],            addedAt: "2026-05-18", domain: "cursor.com" },
  { name: "Lovable",     beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: ["CapitalG", "Khosla Ventures", "NVIDIA"], addedAt: "2026-05-18", domain: "lovable.dev" },
  { name: "Vercel",      beat: "Vertical AI", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Accel", "GV", "General Catalyst"],    addedAt: "2026-05-18", domain: "vercel.com" },
  { name: "Replit",      beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: ["Andreessen Horowitz", "GV"],             addedAt: "2026-05-18", domain: "replit.com" },
  { name: "Windsurf",    beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: ["General Catalyst", "Kleiner Perkins"],  addedAt: "2026-05-18", domain: "windsurf.com" },
  { name: "ElevenLabs",  beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],  vcBacked: ["a16z"],                                 addedAt: "2026-05-18", domain: "elevenlabs.io" },
  { name: "Cognition",   beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: ["Lux Capital", "Khosla Ventures"],       addedAt: "2026-05-18", domain: "cognition.ai" },
  { name: "Hebbia",      beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],  vcBacked: ["Radical Ventures"],                     addedAt: "2026-05-18", domain: "hebbia.ai" },
  // Vertical AI — tier 2–3
  { name: "Ironclad AI", beat: "Vertical AI", tier: 2, dealVector: ["potential_customer", "strategic_partner"], vcBacked: [],                                 addedAt: "2024-01-01" },
  { name: "Cresta",      beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "competitive_threat"], vcBacked: ["Greylock"],                        addedAt: "2024-01-01" },
  { name: "Observe.AI",  beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "competitive_threat"], vcBacked: [],                                 addedAt: "2024-01-01" },
  { name: "HeyGen",      beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "potential_customer"], vcBacked: ["Benchmark", "NVIDIA"],            addedAt: "2026-05-18", domain: "heygen.com" },
  { name: "Mercor",      beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "potential_customer"], vcBacked: ["Benchmark"],                       addedAt: "2026-05-18", domain: "mercor.com" },
  { name: "Reducto",     beat: "Vertical AI", tier: 2, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Benchmark"],                   addedAt: "2026-05-18", domain: "reducto.ai" },
  { name: "Bolt.new",    beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "competitive_threat"], vcBacked: ["GV", "Conviction Capital", "Greylock"], addedAt: "2026-05-18", domain: "bolt.new" },
  { name: "Forethought", beat: "Vertical AI", tier: 3, dealVector: ["competitive_threat"],                      vcBacked: [],                                 addedAt: "2024-01-01" },
  // Vertical AI — new additions (2026-05-21)
  { name: "Dust",        beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"], vcBacked: ["a16z"],                            addedAt: "2026-05-21", domain: "dust.tt" },
  { name: "Gamma",       beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"], vcBacked: [],                                 addedAt: "2026-05-21", domain: "gamma.app" },
  { name: "Profound",    beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "potential_customer"], vcBacked: [],                                 addedAt: "2026-05-21", domain: "profound.co" },
  { name: "Factory",     beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "competitive_threat"], vcBacked: [],                                 addedAt: "2026-05-21", domain: "factory.ai" },
  { name: "Cline",       beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "competitive_threat"], vcBacked: [],                                 addedAt: "2026-05-21", domain: "cline.bot" },
  { name: "11x",         beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "competitive_threat"], vcBacked: [],                                 addedAt: "2026-05-21", domain: "11x.ai" },
  { name: "Vapi",        beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "potential_customer"], vcBacked: [],                                 addedAt: "2026-05-21", domain: "vapi.ai" },
  // Vertical AI — new additions (2026-05-22)
  { name: "Pallet",      beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"], vcBacked: ["General Catalyst", "Bain Capital Ventures", "Bessemer", "Activant Capital"], addedAt: "2026-05-22", domain: "pallet.com" },
];

export function getStaticCompanyNames(beat?: Beat): string[] {
  return (beat ? COMPANIES.filter(c => c.beat === beat) : COMPANIES).map(c => c.name);
}

export async function getCompanyNames(beat?: Beat): Promise<string[]> {
  const staticNames = getStaticCompanyNames(beat);
  if (!KV_CONFIGURED) return staticNames;
  try {
    // Fast path: read a single index key maintained by storeDiscoveredCompanies.
    const indexed = await kv.get<string[]>(DISCOVERED_INDEX_KEY);
    if (indexed && indexed.length > 0) {
      return [...new Set([...staticNames, ...indexed])];
    }
    // Cold path (index missing or empty): rebuild it by scanning, write it back.
    const keys = await kv.keys("discovered:*");
    const relevantKeys = keys.filter(k => k !== DISCOVERED_INDEX_KEY);
    if (relevantKeys.length === 0) return staticNames;
    const discovered = await Promise.all(relevantKeys.map(k => kv.get<DiscoveredCompany>(k)));
    const dynamicNames = discovered.filter(Boolean).map(d => d!.name);
    if (dynamicNames.length > 0) {
      try { await kv.set(DISCOVERED_INDEX_KEY, dynamicNames); } catch {}
    }
    return [...new Set([...staticNames, ...dynamicNames])];
  } catch {
    return staticNames;
  }
}

export function getCompanyContext(beat: Beat): string {
  return COMPANIES
    .filter(c => c.beat === beat && c.tier <= 2)
    .map(c => `${c.name}: ${c.dealVector.join(", ")}`)
    .join("\n");
}

// Normalize: lowercase, collapse whitespace, drop punctuation.
// "Hugging-Face" → "hugging face", "Exa Labs" → "exa labs".
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tokens shorter than this length are not considered safe to standalone-match.
// Avoids "AI" matching "AI21 Labs", "ML" matching anything, etc.
const MIN_MATCH_LEN = 3;

/**
 * Resolve an arbitrary tag (whatever Gemini returned, e.g. "Exa Labs") to a
 * canonical tracked company name (e.g. "Exa") when possible. Matches in order:
 *   1. case-insensitive exact
 *   2. normalized exact (whitespace/punctuation collapsed)
 *   3. word-boundary prefix: tag starts with canonical name + space (catches
 *      "Exa Labs" → "Exa") provided canonical name is >= MIN_MATCH_LEN
 * Only matches against COMPANIES, not DOMAIN_ALIASES — so "Google DeepMind"
 * won't collapse to "Google" (Google lives only in aliases).
 * Returns the input tag unchanged if no match.
 */
export function resolveCanonicalCompanyName(tag: string): string {
  const lowered = tag.toLowerCase();
  for (const c of COMPANIES) {
    if (c.name.toLowerCase() === lowered) return c.name;
  }
  const normTag = normalizeForMatch(tag);
  if (normTag.length === 0) return tag;
  for (const c of COMPANIES) {
    if (normalizeForMatch(c.name) === normTag) return c.name;
  }
  for (const c of COMPANIES) {
    const normCanon = normalizeForMatch(c.name);
    if (normCanon.length < MIN_MATCH_LEN) continue;
    if (normTag.startsWith(normCanon + " ")) return c.name;
  }
  return tag;
}
