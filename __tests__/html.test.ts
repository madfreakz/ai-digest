import { test, describe } from "node:test";
import assert from "node:assert";
import { escapeHtml } from "../lib/html";

describe("escapeHtml", () => {
  test("escapes each of the five HTML special characters", () => {
    assert.equal(escapeHtml("&"), "&amp;");
    assert.equal(escapeHtml("<"), "&lt;");
    assert.equal(escapeHtml(">"), "&gt;");
    assert.equal(escapeHtml('"'), "&quot;");
    assert.equal(escapeHtml("'"), "&#39;");
  });

  test("neutralises a script-tag payload", () => {
    assert.equal(
      escapeHtml(`<script>alert("xss")</script>`),
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });

  test("does not double-escape ampersands", () => {
    // Single-pass regex must not re-trigger on '&amp;' it just produced.
    assert.equal(escapeHtml("a & b < c"), "a &amp; b &lt; c");
  });

  test("preserves text without special characters", () => {
    assert.equal(escapeHtml("Plain text, no entities."), "Plain text, no entities.");
  });

  test("handles empty string", () => {
    assert.equal(escapeHtml(""), "");
  });

  test("escapes the mix that real article titles tend to contain", () => {
    const input = `Anthropic's "Claude 4.6" beats GPT-5 on <reasoning> & cost`;
    const expected = "Anthropic&#39;s &quot;Claude 4.6&quot; beats GPT-5 on &lt;reasoning&gt; &amp; cost";
    assert.equal(escapeHtml(input), expected);
  });
});
