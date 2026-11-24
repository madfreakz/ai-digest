import Link from "next/link";
import DigestHeader from "@/components/DigestHeader";
import { getArchiveIndex } from "@/lib/beat-digests";
import { getLatestWeeklyDigest } from "@/lib/weekly";

export const revalidate = 3600;

export default async function ArchivePage() {
  const [entries, latestWeekly] = await Promise.all([
    getArchiveIndex(),
    getLatestWeeklyDigest(),
  ]);

  return (
    <>
      <div className="masthead-rule" />
      <DigestHeader
        editionDate="Edition Archive"
        thesis="Catch up on past daily editions and Sunday cross-stack rollups."
        navLink={{ href: "/", label: "Today" }}
      />
      <main className="archive-page">
        {latestWeekly && (
          <Link href="/weekly" className="archive-item">
            <span className="archive-item-date">Latest Weekly Rollup · Ending {latestWeekly.weekEnding}</span>
            <span className="archive-item-title">{latestWeekly.emailSubject}</span>
            <span className="archive-item-meta">
              {latestWeekly.daysCovered} editions · {latestWeekly.articleCount} stories distilled
            </span>
          </Link>
        )}

        <div className="archive-list">
          {entries.length === 0 ? (
            <p className="beat-empty">No archived editions saved yet. Daily archives begin accumulating with tonight&rsquo;s publish.</p>
          ) : (
            entries.map((entry) => (
              <Link key={entry.date} href={`/archive/${entry.date}`} className="archive-item">
                <span className="archive-item-date">{entry.date}</span>
                <span className="archive-item-title">
                  {entry.emailSubject || entry.leadTitle || `Edition for ${entry.date}`}
                </span>
                <span className="archive-item-meta">{entry.articleCount} stories</span>
              </Link>
            ))
          )}
        </div>
      </main>
    </>
  );
}
