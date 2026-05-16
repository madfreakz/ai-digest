"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  generatedAt: string;
}

export default function DigestHeader({ generatedAt }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const date = new Date(generatedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  async function handleRefresh() {
    setLoading(true);
    // Bust the 1-hour cache by appending a timestamp
    await fetch(`/api/digest?t=${Date.now()}`, { cache: "no-store" });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
          Physical AI Daily
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">{date}</p>
      </div>
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Refreshing…" : "↻ Refresh"}
      </button>
    </div>
  );
}
