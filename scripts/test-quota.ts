import { GoogleGenAI } from "@google/genai";

async function testQuota() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("✗ GOOGLE_API_KEY not set");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "Test quota" }] }],
    });
    console.log("✓ Quota available - API responded successfully");
    process.exit(0);
  } catch (err: any) {
    const msg = err.message || "";
    if (
      msg.includes("quota") ||
      msg.includes("exhausted") ||
      msg.includes("429") ||
      msg.includes("Quota exceeded")
    ) {
      console.log("✗ Quota still exhausted:", msg.slice(0, 150));
      process.exit(1);
    }
    console.log("! Error:", msg.slice(0, 150));
    process.exit(2);
  }
}

testQuota();
