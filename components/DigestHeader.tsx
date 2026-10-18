interface Props {
  // The edition's own date (from generatedAt), so an old edition never
  // carries today's date.
  editionDate: string;
  thesis?: string;
}

export default function DigestHeader({ editionDate, thesis }: Props) {
  return (
    <header className="digest-header">
      <p className="digest-title">Frontier AI Digest</p>
      <hr className="digest-rule" />
      <p className="edition-date">{editionDate}</p>
      {thesis && <p className="thesis">{thesis}</p>}
    </header>
  );
}
