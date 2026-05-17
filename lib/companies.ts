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
}

export const COMPANIES: TrackedCompany[] = [
  // ── Physical AI — tier 1 ──────────────────────────────────────────────────
  { name: "Physical Intelligence", beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "technology_dependency"], vcBacked: ["Sequoia", "Lux Capital"], addedAt: "2024-01-01" },
  { name: "Figure AI",             beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["Microsoft", "Bezos Expeditions"], addedAt: "2024-01-01" },
  { name: "1X Technologies",       beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["OpenAI", "EQT Ventures"], addedAt: "2024-01-01" },
  { name: "Boston Dynamics",       beat: "Physical AI", tier: 1, dealVector: ["potential_customer", "competitive_threat"],    vcBacked: ["Hyundai"], addedAt: "2024-01-01" },
  { name: "Agility Robotics",      beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["Amazon", "DCVC"], addedAt: "2024-01-01" },
  { name: "Tesla",                 beat: "Physical AI", tier: 1, dealVector: ["competitive_threat", "potential_customer"],    vcBacked: [], addedAt: "2024-01-01" },
  { name: "Apptronik",             beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["Google"], addedAt: "2024-01-01" },
  { name: "Unitree",               beat: "Physical AI", tier: 1, dealVector: ["competitive_threat", "potential_customer"],    vcBacked: [], addedAt: "2024-01-01" },
  { name: "Sanctuary AI",          beat: "Physical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],     vcBacked: ["SoftBank"], addedAt: "2024-01-01" },
  { name: "Covariant",             beat: "Physical AI", tier: 1, dealVector: ["technology_dependency", "strategic_partner"],  vcBacked: ["Bessemer", "Radical Ventures"], addedAt: "2024-01-01" },
  // Physical AI — tier 2–3
  { name: "Genesis AI",        beat: "Physical AI", tier: 2, dealVector: ["strategic_partner"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Mind Robotics",     beat: "Physical AI", tier: 2, dealVector: ["strategic_partner"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Bedrock Robotics",  beat: "Physical AI", tier: 2, dealVector: ["strategic_partner"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Fourier Intelligence", beat: "Physical AI", tier: 2, dealVector: ["competitive_threat", "potential_customer"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Machina Labs",      beat: "Physical AI", tier: 2, dealVector: ["potential_customer", "strategic_partner"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Bright Machines",   beat: "Physical AI", tier: 2, dealVector: ["potential_customer"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Symbotic",          beat: "Physical AI", tier: 2, dealVector: ["potential_customer", "competitive_threat"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Sarcos",            beat: "Physical AI", tier: 3, dealVector: ["strategic_partner"], vcBacked: [], addedAt: "2024-01-01" },

  // ── AI Infrastructure — tier 1 ────────────────────────────────────────────
  { name: "Exa",             beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Lightspeed"], addedAt: "2024-01-01" },
  { name: "Anyscale",        beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["a16z", "NEA"], addedAt: "2024-01-01" },
  { name: "Modal",           beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Redpoint"], addedAt: "2024-01-01" },
  { name: "Replicate",       beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["a16z"], addedAt: "2024-01-01" },
  { name: "Together AI",     beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "competitive_threat"], vcBacked: ["Salesforce Ventures"], addedAt: "2024-01-01" },
  { name: "Weights & Biases", beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["GV", "Insight Partners"], addedAt: "2024-01-01" },
  { name: "LangChain",       beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Sequoia"], addedAt: "2024-01-01" },
  { name: "Weaviate",        beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Index Ventures"], addedAt: "2024-01-01" },
  { name: "Pinecone",        beat: "AI Infrastructure", tier: 1, dealVector: ["technology_dependency", "competitive_threat"], vcBacked: ["Andreessen Horowitz"], addedAt: "2024-01-01" },
  // AI Infrastructure — tier 2–3
  { name: "Helicone",     beat: "AI Infrastructure", tier: 2, dealVector: ["technology_dependency"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Braintrust",   beat: "AI Infrastructure", tier: 2, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Arize AI",     beat: "AI Infrastructure", tier: 2, dealVector: ["technology_dependency"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "LlamaIndex",   beat: "AI Infrastructure", tier: 2, dealVector: ["technology_dependency"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Unstructured", beat: "AI Infrastructure", tier: 3, dealVector: ["technology_dependency"], vcBacked: [], addedAt: "2024-01-01" },

  // ── AI Labs — tier 1 ──────────────────────────────────────────────────────
  { name: "Anthropic",        beat: "AI Labs", tier: 1, dealVector: ["strategic_partner", "technology_dependency"], vcBacked: ["Google", "Spark Capital"], addedAt: "2024-01-01" },
  { name: "OpenAI",           beat: "AI Labs", tier: 1, dealVector: ["competitive_threat", "technology_dependency"], vcBacked: ["Microsoft"], addedAt: "2024-01-01" },
  { name: "Google DeepMind",  beat: "AI Labs", tier: 1, dealVector: ["competitive_threat", "strategic_partner"],    vcBacked: ["Google"], addedAt: "2024-01-01" },
  { name: "Meta AI",          beat: "AI Labs", tier: 1, dealVector: ["competitive_threat", "technology_dependency"], vcBacked: ["Meta"], addedAt: "2024-01-01" },
  { name: "Mistral",          beat: "AI Labs", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["Andreessen Horowitz", "Lightspeed"], addedAt: "2024-01-01" },
  { name: "xAI",              beat: "AI Labs", tier: 1, dealVector: ["competitive_threat", "strategic_partner"],    vcBacked: [], addedAt: "2024-01-01" },
  { name: "Cohere",           beat: "AI Labs", tier: 1, dealVector: ["technology_dependency", "strategic_partner"], vcBacked: ["NVIDIA", "Salesforce Ventures"], addedAt: "2024-01-01" },
  // AI Labs — tier 2–3
  { name: "AI21 Labs",     beat: "AI Labs", tier: 2, dealVector: ["technology_dependency"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Inflection AI", beat: "AI Labs", tier: 2, dealVector: ["competitive_threat"],   vcBacked: [], addedAt: "2024-01-01" },
  { name: "Aleph Alpha",   beat: "AI Labs", tier: 2, dealVector: ["strategic_partner"],    vcBacked: [], addedAt: "2024-01-01" },
  { name: "Reka",          beat: "AI Labs", tier: 3, dealVector: ["technology_dependency"], vcBacked: [], addedAt: "2024-01-01" },

  // ── Vertical AI — tier 1 ──────────────────────────────────────────────────
  { name: "Harvey",      beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],  vcBacked: ["Sequoia", "OpenAI"], addedAt: "2024-01-01" },
  { name: "Rogo",        beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],  vcBacked: ["a16z"], addedAt: "2024-01-01" },
  { name: "Sierra",      beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: ["Sequoia"], addedAt: "2024-01-01" },
  { name: "Decagon",     beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: ["a16z"], addedAt: "2024-01-01" },
  { name: "Glean",       beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "potential_customer"],  vcBacked: ["Sequoia", "Coatue"], addedAt: "2024-01-01" },
  { name: "Writer",      beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: ["ICONIQ Growth"], addedAt: "2024-01-01" },
  { name: "Moveworks",   beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: ["Kleiner Perkins", "ICONIQ Growth"], addedAt: "2024-01-01" },
  { name: "Cognigy",     beat: "Vertical AI", tier: 1, dealVector: ["strategic_partner", "competitive_threat"],  vcBacked: [], addedAt: "2024-01-01" },
  // Vertical AI — tier 2–3
  { name: "Ironclad AI",  beat: "Vertical AI", tier: 2, dealVector: ["potential_customer", "strategic_partner"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Abridge",      beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner"],                       vcBacked: [], addedAt: "2024-01-01" },
  { name: "Nabla",        beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner"],                       vcBacked: [], addedAt: "2024-01-01" },
  { name: "Cresta",       beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "competitive_threat"], vcBacked: ["Greylock"], addedAt: "2024-01-01" },
  { name: "Observe.AI",   beat: "Vertical AI", tier: 2, dealVector: ["strategic_partner", "competitive_threat"], vcBacked: [], addedAt: "2024-01-01" },
  { name: "Forethought",  beat: "Vertical AI", tier: 3, dealVector: ["competitive_threat"],                      vcBacked: [], addedAt: "2024-01-01" },
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
