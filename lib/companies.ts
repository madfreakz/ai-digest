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
  { name: "OpenEvidence", beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"], vcBacked: ["Conviction Capital"],                   addedAt: "2026-05-18", domain: "openevidence.com" },
  // Vertical AI — tier 2–3
  { name: "Ironclad AI", beat: "Vertical AI", tier: 2, dealVector: ["potential_customer", "strategic_partner"], vcBacked: [],                                 addedAt: "2024-01-01" },
  { name: "Abridge",     beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner"],                       vcBacked: [],                                 addedAt: "2024-01-01" },
  { name: "Nabla",       beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner"],                       vcBacked: [],                                 addedAt: "2024-01-01" },
  { name: "Cresta",      beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "competitive_threat"], vcBacked: ["Greylock"],                        addedAt: "2024-01-01" },
  { name: "Observe.AI",  beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "competitive_threat"], vcBacked: [],                                 addedAt: "2024-01-01" },
  { name: "HeyGen",      beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "potential_customer"], vcBacked: ["Benchmark", "NVIDIA"],            addedAt: "2026-05-18", domain: "heygen.com" },
  { name: "Mercor",      beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "potential_customer"], vcBacked: ["Benchmark"],                       addedAt: "2026-05-18", domain: "mercor.com" },
  { name: "Reducto",     beat: "Vertical AI", tier: 2, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Benchmark"],                   addedAt: "2026-05-18", domain: "reducto.ai" },
  { name: "Bolt.new",    beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "competitive_threat"], vcBacked: ["GV", "Conviction Capital", "Greylock"], addedAt: "2026-05-18", domain: "bolt.new" },
  { name: "Forethought", beat: "Vertical AI", tier: 3, dealVector: ["competitive_threat"],                      vcBacked: [],                                 addedAt: "2024-01-01" },
];

export function getCompanyNames(beat?: Beat): string[] {
  return (beat ? COMPANIES.filter(c => c.beat === beat) : COMPANIES).map(c => c.name);
}

export function getCompanyRegistry(): TrackedCompany[] {
  return COMPANIES;
}

// Compressed context for Claude prompt injection — tier 1 + 2 only to keep token count low
export function getCompanyContext(beat: Beat): string {
  return COMPANIES
    .filter(c => c.beat === beat && c.tier <= 2)
    .map(c => `${c.name}: ${c.dealVector.join(", ")}`)
    .join("\n");
}
