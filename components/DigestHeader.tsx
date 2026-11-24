import Link from "next/link";

interface Props {
  // The edition's own date (from generatedAt), so an old edition never
  // carries today's date.
  editionDate: string;
  thesis?: string;
  navLink?: { href: string; label: string };
}

export default function DigestHeader({
  editionDate,
  thesis,
  navLink = { href: "/archive", label: "Archive" },
}: Props) {
  return (
    <header className="digest-header">
      <p className="digest-title">Frontier AI Digest</p>
      <hr className="digest-rule" />
      <div className="digest-meta-row">
        <p className="edition-date">{editionDate}</p>
        <nav className="digest-nav-links" aria-label="Editions">
          <Link href="/weekly">Weekly</Link>
          <span aria-hidden="true">·</span>
          <Link href={navLink.href}>{navLink.label}</Link>
        </nav>
      </div>
      {thesis && <p className="thesis">{thesis}</p>}
    </header>
  );
}
