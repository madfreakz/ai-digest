import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same geometric F as app/icon.svg. Square corners: iOS applies its own mask.
export default function AppleIcon() {
  const bar = { position: "absolute", background: "#FAF8F4" } as const;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#1B3A6B" }}>
        <div style={{ ...bar, left: 62, top: 45, width: 20, height: 90 }} />
        <div style={{ ...bar, left: 62, top: 45, width: 62, height: 20 }} />
        <div style={{ ...bar, left: 62, top: 82, width: 45, height: 17 }} />
      </div>
    ),
    size,
  );
}
