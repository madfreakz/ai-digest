"use client";

interface Props {
  src: string;
  isLogo: boolean;
  onError: () => void;
}

// Decorative: the card's title link carries the story. When the image fails,
// the card drops the thumbnail column rather than showing a placeholder.
// Loaded eagerly: a lazy image that 404s mid-scroll collapses its card on
// mobile and throws jump links off target. The page has under 20 of them.
export default function Thumb({ src, isLogo, onError }: Props) {
  return (
    <div className="thumb-wrap" style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="thumb-inner"
        src={src}
        alt=""
        width={180}
        height={140}
        decoding="async"
        style={{
          width: "100%",
          height: "100%",
          objectFit: isLogo ? "contain" : "cover",
          objectPosition: "center",
          display: "block",
          backgroundColor: isLogo ? "#FFFFFF" : undefined,
          padding: isLogo ? "16px" : undefined,
        }}
        onError={onError}
      />
    </div>
  );
}
