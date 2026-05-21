"use client";

import { useState } from "react";
import { useTheme } from "./DigestClient";

interface Props {
  ogImage: string | null;
  companyLogoUrl?: string;
  label: string;
  height: number;
}

export default function Thumb({ ogImage, companyLogoUrl, label, height }: Props) {
  const { t } = useTheme();
  const [imgFailed, setImgFailed] = useState(false);

  const imageUrl = companyLogoUrl || (ogImage && ogImage.startsWith("http") ? ogImage : null);

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
          background: imageUrl
            ? undefined
            : `repeating-linear-gradient(-45deg, ${t.thumbS1} 0px, ${t.thumbS1} 14px, ${t.thumbS2} 14px, ${t.thumbS2} 28px)`,
        }}
      >
        {imageUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: companyLogoUrl ? "contain" : "cover",
              objectPosition: "center",
              display: "block",
              backgroundColor: companyLogoUrl ? "#FFFFFF" : undefined,
              padding: companyLogoUrl ? "16px" : undefined,
            }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <>
            {/* Vignette overlay — margin: 0px 56px per user edit */}
            {t.thumbVignette !== "transparent" && (
              <div style={{
                position: "absolute", inset: 0,
                background: t.thumbVignette,
                margin: "0px 56px",
              }} />
            )}
            {/* Label */}
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
            {/* Play button ring — margin: 10px; border-width: 3px 56px per user edit */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "50px",
              margin: "10px",
              borderStyle: "solid",
              borderWidth: "3px 56px",
              borderColor: "transparent",
            }}>
              <div
                className="play-ring"
                style={{
                  width: 54, height: 54, borderRadius: "50%",
                  border: `1px solid ${t.playBorder}`,
                  background: t.playBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <div style={{
                  width: 0, height: 0,
                  borderLeft: `16px solid ${t.playArrow}`,
                  borderTop: "9px solid transparent",
                  borderBottom: "9px solid transparent",
                  marginLeft: 5,
                }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
