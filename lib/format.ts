import type { DigestArticle } from "./summarize";

// Display strings for the page. Computed on the server and passed down as
// plain strings, so client components never format dates themselves (no
// hydration mismatches, nothing to ship to the browser).

const PT = "America/Los_Angeles";

// "Saturday, October 17, 2026": the edition's own date, not the reader's.
export function formatEditionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: PT,
  });
}

// Exa returns most dates without a time, and those arrive as midnight UTC.
// Converting them to PT printed a false "5:00 PM PT" on the previous day, so a
// midnight-UTC timestamp is shown as its UTC calendar date alone.
export function formatPublishedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dateOnly =
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  if (dateOnly) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  const when = d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: PT,
  });
  return `${when} PT`;
}

// Drops a trailing " | Publisher" that repeats the source line ("... | TechCrunch").
// Display only: cross-beat dedup compares the raw titles.
const PUBLISHER_SUFFIX = /\s+\|\s+[^|]{1,40}$/;

export function displayTitle(title: string): string {
  const stripped = title.replace(PUBLISHER_SUFFIX, "");
  return stripped.length >= 20 ? stripped : title;
}

export interface DisplayArticle extends DigestArticle {
  displayTitle: string;
  publishedLabel: string;
}

export function toDisplayArticle(article: DigestArticle): DisplayArticle {
  return {
    ...article,
    displayTitle: displayTitle(article.title),
    publishedLabel: formatPublishedAt(article.publishedAt),
  };
}
