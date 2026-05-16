interface Props {
  keyPoints: string[];
}

export default function ExecutiveSummary({ keyPoints }: Props) {
  return (
    <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-blue-500 rounded-xl p-5 mb-8">
      <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">
        Today&apos;s Big Picture
      </h2>
      <ul className="space-y-2">
        {keyPoints.map((point, i) => (
          <li key={i} className="flex gap-3 text-slate-300 text-sm leading-snug">
            <span className="text-blue-500 mt-0.5 shrink-0">▸</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
