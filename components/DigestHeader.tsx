"use client";

import { useTheme } from "./DigestClient";

interface Props {
  generatedAt: string;
}

export default function DigestHeader({ generatedAt }: Props) {
  const { t, headlineFont, compact } = useTheme();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div style={{ padding: compact ? "36px var(--page-pad-x) 24px" : "52px var(--page-pad-x) 36px" }}>
      {/* Title */}
      <div className="physai-title" style={{
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

      {/* Date */}
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 12,
        color: t.textGhost,
        fontWeight: 300,
      }}>
        {today}
      </div>
    </div>
  );
}
