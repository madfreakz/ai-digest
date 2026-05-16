"use client";

import { useTheme } from "./DigestClient";
import { formatPublishedAt } from "@/lib/themes";
import type { UserPrefs, ThemeKey, HeadlineFont, ReadingMode } from "@/lib/themes";

interface Props {
  generatedAt: string;
  prefs: UserPrefs;
  onPrefsChange: (p: UserPrefs) => void;
}

const PALETTES: ThemeKey[] = ["Cream", "Ink", "Press"];
const HEADLINE_FONTS: HeadlineFont[] = ["Serif", "Sans"];
const MODES: ReadingMode[] = ["Deep Read", "Scan"];

export default function DigestHeader({ generatedAt, prefs, onPrefsChange }: Props) {
  const { t, headlineFont, compact } = useTheme();

  const dateStr = formatPublishedAt(generatedAt);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div style={{ padding: compact ? "36px 56px 24px" : "52px 56px 36px" }}>
      {/* Title */}
      <div style={{
        fontFamily: headlineFont,
        fontSize: 38,
        fontWeight: 600,
        color: t.textHigh,
        letterSpacing: "-0.025em",
        lineHeight: 1,
        marginBottom: compact ? 20 : 28,
      }}>
        Physical AI News
      </div>

      {/* Horizontal rule */}
      <div style={{ height: 1, background: t.border, marginBottom: 18 }} />

      {/* Date + settings row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 12,
          color: t.textGhost,
          fontWeight: 300,
        }}>
          {today}
        </div>

        {/* Settings toggles */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <ToggleGroup
            label="Palette"
            options={PALETTES}
            value={prefs.palette}
            onChange={(v) => onPrefsChange({ ...prefs, palette: v as ThemeKey })}
            t={t}
          />
          <ToggleGroup
            label="Headlines"
            options={HEADLINE_FONTS}
            value={prefs.headlines}
            onChange={(v) => onPrefsChange({ ...prefs, headlines: v as HeadlineFont })}
            t={t}
          />
          <ToggleGroup
            label="Mode"
            options={MODES}
            value={prefs.mode}
            onChange={(v) => onPrefsChange({ ...prefs, mode: v as ReadingMode })}
            t={t}
          />
        </div>
      </div>
    </div>
  );
}

function ToggleGroup({
  options, value, onChange, t,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  t: ReturnType<typeof useTheme>["t"];
}) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              background: active ? t.accent : "transparent",
              color: active ? t.bg : t.textGhost,
              border: `1px solid ${active ? t.accent : t.borderLight}`,
              borderRadius: 3,
              padding: "2px 8px",
              fontSize: 10,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: active ? 500 : 300,
              cursor: "pointer",
              letterSpacing: "0.04em",
              transition: "all 0.14s ease",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
