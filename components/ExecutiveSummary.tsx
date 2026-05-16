interface Props {
  summary: string;
}

export default function ExecutiveSummary({ summary }: Props) {
  return (
    <div className="bg-slate-900 border border-slate-800 border-l-4 border-l-blue-500 rounded-xl p-5 mb-8">
      <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">
        Today&apos;s Big Picture
      </h2>
      <p className="text-slate-300 leading-relaxed">{summary}</p>
    </div>
  );
}
