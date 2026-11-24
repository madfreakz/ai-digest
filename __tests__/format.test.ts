import { test, describe } from "node:test";
import assert from "node:assert";
import { formatEditionDate, formatPublishedAt, displayTitle } from "../lib/format";

describe("formatPublishedAt", () => {
  test("shows a midnight-UTC (date-only) timestamp as its UTC date, with no time", () => {
    // Previously rendered as "Oct 15, 5:00 PM PT", the day before.
    assert.equal(formatPublishedAt("2026-10-16T00:00:00.000Z"), "Oct 16");
  });

  test("shows a real time in Pacific time", () => {
    // 16:30 UTC is 9:30 AM PDT. ICU may use a narrow no-break space before AM.
    assert.match(formatPublishedAt("2026-10-16T16:30:00.000Z"), /^Oct 16, 9:30\s?AM PT$/u);
  });

  test("treats any non-midnight UTC time as a real time", () => {
    assert.match(formatPublishedAt("2026-10-16T00:00:01.000Z"), /PT$/);
  });

  test("returns an empty string for an unparseable date", () => {
    assert.equal(formatPublishedAt("not a date"), "");
  });
});

describe("formatEditionDate", () => {
  test("uses the edition's Pacific date, not UTC", () => {
    // 14:30 UTC on Oct 17 is 7:30 AM PDT on Saturday, Oct 17.
    assert.equal(formatEditionDate("2026-10-17T14:30:31.588Z"), "Saturday, October 17, 2026");
    // 03:00 UTC on Oct 18 is 8 PM PDT, still Saturday, Oct 17.
    assert.equal(formatEditionDate("2026-10-18T03:00:00.000Z"), "Saturday, October 17, 2026");
  });
});

describe("displayTitle", () => {
  test("drops a trailing publisher after a pipe", () => {
    assert.equal(
      displayTitle("Meta launches an open-weight AI model that runs on Macs | TechCrunch"),
      "Meta launches an open-weight AI model that runs on Macs",
    );
  });

  test("keeps titles without a pipe suffix", () => {
    const t = "Floqer's AI agents research sales prospects so teams don't have to";
    assert.equal(displayTitle(t), t);
  });

  test("keeps a pipe that is not a short trailing suffix", () => {
    const t = "Agents | the year infrastructure caught up with the hype, and what comes after it for builders";
    assert.equal(displayTitle(t), t);
  });

  test("drops trailing :: and - publisher suffixes", () => {
    assert.equal(
      displayTitle("Protecting where software gets built: StepSecurity's $20M Series A - StepSecurity"),
      "Protecting where software gets built: StepSecurity's $20M Series A",
    );
    assert.equal(
      displayTitle("Amesite Signs New 2,000-Patient Enterprise Customer :: Amesite, Inc. (AMST)"),
      "Amesite Signs New 2,000-Patient Enterprise Customer",
    );
  });

  test("preserves hyphenated product terms and lowercase dashed clauses", () => {
    const t1 = "Freshworks alums raise $53M to build AI-native CRM with GPT-6.2";
    assert.equal(displayTitle(t1), t1);
    const t2 = "Why agent orchestration matters now - and what builders should watch";
    assert.equal(displayTitle(t2), t2);
  });

  test("keeps the full title when stripping would leave almost nothing", () => {
    assert.equal(displayTitle("Jev | TechCrunch"), "Jev | TechCrunch");
  });
});
