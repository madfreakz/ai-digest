"use client";

import { useEffect, useState } from "react";
import DigestClient from "./DigestClient";
import type { Digest } from "@/lib/summarize";

export default function DigestLoader() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/digest");
        if (!res.ok) { setError(true); return; }
        const data: Digest = await res.json();
        if (!cancelled && data.articles?.length > 0) setDigest(data);
        else if (!cancelled) setError(true);
      } catch {
        if (!cancelled) setError(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (digest) return <DigestClient digest={digest} />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF8F4" }}>
      <div style={{ textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
        {error ? (
          <>
            <p style={{ color: "#7A7268", fontSize: 16 }}>Could not load digest.</p>
            <p style={{ color: "#A8A098", fontSize: 13, marginTop: 8 }}>Try refreshing in a minute.</p>
          </>
        ) : (
          <>
            <p style={{ color: "#7A7268", fontSize: 16 }}>Generating today&apos;s digest…</p>
            <p style={{ color: "#A8A098", fontSize: 13, marginTop: 8 }}>Fetching articles across all 4 beats. This takes about a minute.</p>
          </>
        )}
      </div>
    </div>
  );
}
