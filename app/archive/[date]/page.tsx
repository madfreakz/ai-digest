import { notFound } from "next/navigation";
import CinematicLayout from "@/components/CinematicLayout";
import { getArchivedDigest } from "@/lib/beat-digests";

export const revalidate = 3600;

export default async function ArchivedEditionPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const digest = await getArchivedDigest(date);
  if (!digest || digest.articles.length === 0) {
    notFound();
  }

  return (
    <CinematicLayout
      digest={digest}
      archiveBanner={`Archived edition: ${date}`}
      navLink={{ href: "/archive", label: "All editions" }}
    />
  );
}
