"use client";

import { useState } from "react";
import type { DigestArticle } from "@/lib/summarize";
import type { Beat } from "@/lib/companies";
import { useTheme } from "./DigestClient";
import CategorySection from "./CategorySection";

const BEATS: Beat[] = ["Physical AI", "AI Infrastructure", "AI Labs", "Vertical AI"];

interface Props {
  articles: DigestArticle[];
  activeBeat: Beat;
  onBeatChange: (b: Beat) => void;
}

export default function BeatSection({ articles, activeBeat, onBeatChange }: Props) {
  const { t } = useTheme();
  const [animKey, setAnimKey] = useState(0);

  function switchBeat(beat: Beat) {
    if (beat === activeBeat) return;
    onBeatChange(beat);
    setAnimKey(k => k + 1);
  }

  const filtered = articles.filter(a => a.beat === activeBeat);

  return (
    <div>
      {/* Beat tab bar — sticky, same visual language as CategorySection */}
      <div
        className="tab-bar"
        style={{ position: "sticky", top: 0, zIndex: 20, padding: "0 var(--page-pad-x)" }}
      >
        <div style={{
          display: "flex",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch" as const,
          scrollbarWidth: "none",
        }}>
          {BEATS.map(beat => {
            const isActive = beat === activeBeat;
            const count = articles.filter(a => a.beat === beat).length;
            return (
              <button
                key={beat}
                onClick={() => switchBeat(beat)}
                className={`tab-btn${isActive ? " tab-active" : ""}`}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? `1.5px solid ${t.accent}` : "1.5px solid transparent",
                  padding: "16px 18px 14px",
                  marginBottom: -1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                <span
                  className="tab-label"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: isActive ? 500 : 300,
                    color: isActive ? t.accent : t.textGhost,
                    transition: "all 0.14s ease",
                  }}
                >
                  {beat}
                </span>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 9,
                    color: isActive ? t.textGhost : t.textMin,
                    transition: "color 0.14s ease",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category tabs + articles for the active beat */}
      <div key={animKey} className="tab-content">
        <CategorySection articles={filtered} />
      </div>
    </div>
  );
}
