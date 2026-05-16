"use client";

import { useTheme } from "./DigestClient";

interface Props {
  ogImage: string | null;
  label: string;
  height: number;
}

export default function Thumb({ ogImage, label, height }: Props) {
  const { t } = useTheme();

  return (
    <div
      className="thumb-wrap"
      style={{ width: "100%", height, position: "relative", overflow: "hidden" }}
    >
      <div
        className="thumb-inner"
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          background: ogImage
            ? undefined
            : `repeating-linear-gradient(-45deg, ${t.thumbS1} 0px, ${t.thumbS1} 14px, ${t.thumbS2} 14px, ${t.thumbS2} 28px)`,
        }}
      >
        {ogImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ogImage}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <>
            {t.thumbVignette !== "transparent" && (
              <div style={{ position: "absolute", inset: 0, background: t.thumbVignette }} />
            )}
            <div style={{
              position: "absolute",
              bottom: 14,
              left: 18,
              fontFamily: "'DM Mono', monospace",
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: t.thumbLabel,
            }}>
              {label}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
