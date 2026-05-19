"use client";

import { useTheme } from "./DigestClient";

interface Props {
  generatedAt: string;
  thesis?: string;
}

export default function DigestHeader({ generatedAt, thesis }: Props) {
  const { t, headlineFont, compact } = useTheme();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div style={{ padding: compact ? "36px var(--page-pad-x) 24px" : "52px var(--page-pad-x) 36px" }}>
      {/* Title */}
      <div className="digest-title" style={{
        fontFamily: headlineFont,
        fontSize: 38,
        fontWeight: 600,
        color: '#18140C',
        letterSpacing: "-0.025em",
        lineHeight: 1,
        marginBottom: compact ? 20 : 28,
      }}>
        Frontier AI Digest
      </div>

      {/* Horizontal rule */}
      <div style={{ height: 1, background: t.border, marginBottom: 18 }} />

      {/* Date */}
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 12,
        color: t.textGhost,
        fontWeight: 300,
        marginBottom: thesis ? 16 : 0,
      }}>
        {today}
      </div>

      {/* Editor's thesis */}
      {thesis && (
        <div style={{
          borderLeft: `2px solid ${t.accent}`,
          paddingLeft: 12,
          marginTop: 4,
        }}>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: compact ? 13 : 14,
            color: t.textMid,
            lineHeight: 1.65,
            margin: 0,
            fontStyle: "italic",
          }}>
            {thesis}
          </p>
        </div>
      )}
    </div>
  );
}
