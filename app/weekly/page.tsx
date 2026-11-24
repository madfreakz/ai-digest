import Link from "next/link";
import DigestHeader from "@/components/DigestHeader";
import { getLatestWeeklyDigest } from "@/lib/weekly";
import { displayTitle } from "@/lib/format";

export const revalidate = 3600;

export default async function WeeklyPage() {
  const weekly = await getLatestWeeklyDigest();

  return (
    <>
      <div className="masthead-rule" />
      <DigestHeader
        editionDate={weekly ? `Weekly Rollup · Ending ${weekly.weekEnding}` : "Weekly Rollup"}
        thesis={weekly?.weekTheme}
        navLink={{ href: "/", label: "Today" }}
      />
      <main className="archive-page">
        {!weekly ? (
          <div className="weekly-card">
            <h2>No Weekly Rollup Yet</h2>
            <p>The first Sunday synthesis runs automatically once daily editions are archived.</p>
            <p><Link href="/archive">Browse daily archive</Link></p>
          </div>
        ) : (
          <>
            <p className="archive-item-meta">
              {weekly.daysCovered} editions · {weekly.articleCount} unique stories distilled
            </p>
            {weekly.beatSummaries.map((bs) => (
              <section key={bs.beat} className="weekly-card">
                <h2>{bs.beat}</h2>
                <p>{bs.summary}</p>
                {bs.topStoryUrls.length > 0 && (
                  <ul className="weekly-links">
                    {bs.topStoryUrls.map((url) => {
                      const ref = weekly.stories[url];
                      if (!ref) return null;
                      return (
                        <li key={url}>
                          <a href={ref.url} target="_blank" rel="noopener noreferrer">
                            {displayTitle(ref.title)}
                          </a>{" "}
                          <span>({ref.source})</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))}
          </>
        )}
      </main>
    </>
  );
}
