import { test, describe } from "node:test";
import assert from "node:assert";
import { resolveCanonicalCompanyName, COMPANIES } from "../lib/companies";

describe("resolveCanonicalCompanyName", () => {
  test("returns tag unchanged when no match", () => {
    assert.equal(resolveCanonicalCompanyName("Some Random Co"), "Some Random Co");
  });

  test("matches case-insensitively", () => {
    assert.equal(resolveCanonicalCompanyName("anthropic"), "Anthropic");
    assert.equal(resolveCanonicalCompanyName("ANTHROPIC"), "Anthropic");
  });

  test("collapses whitespace and punctuation", () => {
    assert.equal(resolveCanonicalCompanyName("Hugging-Face"), "Hugging Face");
    assert.equal(resolveCanonicalCompanyName("OpenAI"), "OpenAI");
  });

  test("resolves 'Exa Labs' to 'Exa' (prefix match)", () => {
    assert.equal(resolveCanonicalCompanyName("Exa Labs"), "Exa");
    assert.equal(resolveCanonicalCompanyName("Exa AI"), "Exa");
  });

  test("resolves Recursive Superintelligence to itself once tracked", () => {
    assert.equal(
      resolveCanonicalCompanyName("Recursive Superintelligence"),
      "Recursive Superintelligence",
    );
  });

  test("does not collapse short names that would over-match", () => {
    // "AI" is too short — never a valid match
    assert.equal(resolveCanonicalCompanyName("AI"), "AI");
  });

  test("resolves 'Parallel Web Systems' to 'Parallel' and has no duplicate company names", () => {
    assert.equal(resolveCanonicalCompanyName("Parallel Web Systems"), "Parallel");
    const names = COMPANIES.map(c => c.name.toLowerCase());
    assert.equal(new Set(names).size, names.length);
  });
});
