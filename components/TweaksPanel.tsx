"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTheme } from "./DigestClient";
import type { UserPrefs, ThemeKey, HeadlineFont, ReadingMode } from "@/lib/themes";

interface Props {
  prefs: UserPrefs;
  onPrefsChange: (p: UserPrefs) => void;
}

const PANEL_STYLE = `
  .twk-panel {
    position: fixed; right: 16px; bottom: 16px; z-index: 2000;
    width: 260px; display: flex; flex-direction: column;
    background: rgba(250,249,247,.82);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    backdrop-filter: blur(24px) saturate(160%);
    border: .5px solid rgba(255,255,255,.65);
    border-radius: 14px;
    box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 12px 40px rgba(0,0,0,.18);
    font: 11.5px/1.4 ui-sans-serif, system-ui, -apple-system, sans-serif;
    color: #29261b; overflow: hidden;
    transform-origin: bottom right;
  }
  .twk-hd {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 8px 10px 14px; cursor: move; user-select: none;
    border-bottom: .5px solid rgba(0,0,0,.06);
  }
  .twk-hd b { font-size: 12px; font-weight: 600; letter-spacing: .01em; }
  .twk-x {
    appearance: none; border: 0; background: transparent;
    color: rgba(41,38,27,.55); width: 22px; height: 22px;
    border-radius: 6px; cursor: default; font-size: 13px; line-height: 22px;
    text-align: center;
  }
  .twk-x:hover { background: rgba(0,0,0,.06); color: #29261b; }
  .twk-body {
    padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 12px;
  }
  .twk-sect {
    font-size: 10px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: rgba(41,38,27,.45); margin-bottom: -4px;
  }
  .twk-seg {
    position: relative; display: flex; padding: 2px;
    border-radius: 8px; background: rgba(0,0,0,.07); user-select: none;
  }
  .twk-seg-thumb {
    position: absolute; top: 2px; bottom: 2px; border-radius: 6px;
    background: rgba(255,255,255,.92);
    box-shadow: 0 1px 3px rgba(0,0,0,.14);
    transition: left .15s cubic-bezier(.3,.7,.4,1), width .15s;
  }
  .twk-seg button {
    appearance: none; position: relative; z-index: 1; flex: 1;
    border: 0; background: transparent; color: inherit; font: inherit;
    font-weight: 500; min-height: 24px; border-radius: 6px;
    cursor: default; padding: 3px 6px; line-height: 1.2; overflow-wrap: anywhere;
  }
  .twk-fab {
    position: fixed; right: 16px; bottom: 16px; z-index: 1999;
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(250,249,247,.82);
    -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
    border: .5px solid rgba(0,0,0,.12);
    box-shadow: 0 2px 12px rgba(0,0,0,.14);
    display: flex; align-items: center; justify-content: center;
    cursor: default; font-size: 14px; color: rgba(41,38,27,.7);
    transition: box-shadow .15s, background .15s;
  }
  .twk-fab:hover { box-shadow: 0 4px 16px rgba(0,0,0,.18); background: rgba(250,249,247,.95); }
`;

function SegRadio({
  options, value, onChange,
}: { options: string[]; value: string; onChange: (v: string) => void }) {
  const n = options.length;
  const idx = Math.max(0, options.indexOf(value));
  return (
    <div className="twk-seg">
      <div
        className="twk-seg-thumb"
        style={{
          left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
          width: `calc((100% - 4px) / ${n})`,
        }}
      />
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}>
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function TweaksPanel({ prefs, onPrefsChange }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef({ x: 16, y: 16 });

  const clamp = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const PAD = 16;
    offsetRef.current = {
      x: Math.min(Math.max(PAD, offsetRef.current.x), window.innerWidth - w - PAD),
      y: Math.min(Math.max(PAD, offsetRef.current.y), window.innerHeight - h - PAD),
    };
    el.style.right = offsetRef.current.x + "px";
    el.style.bottom = offsetRef.current.y + "px";
  }, []);

  useEffect(() => {
    if (!open) return;
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [open, clamp]);

  function onDragStart(e: React.MouseEvent) {
    const el = panelRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startR = window.innerWidth - r.right;
    const startB = window.innerHeight - r.bottom;
    const move = (ev: MouseEvent) => {
      offsetRef.current = {
        x: startR - (ev.clientX - sx),
        y: startB - (ev.clientY - sy),
      };
      clamp();
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  const palettes: ThemeKey[] = ["Cream", "Ink", "Press"];
  const fonts: HeadlineFont[] = ["Serif", "Sans"];
  const modes: ReadingMode[] = ["Deep Read", "Scan"];

  return (
    <>
      <style>{PANEL_STYLE}</style>

      {!open && (
        <button className="twk-fab" aria-label="Open settings" onClick={() => setOpen(true)}>
          ⚙
        </button>
      )}

      {open && (
        <div ref={panelRef} className="twk-panel">
          <div className="twk-hd" onMouseDown={onDragStart}>
            <b>Tweaks</b>
            <button className="twk-x" aria-label="Close" onMouseDown={(e) => e.stopPropagation()} onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="twk-body">
            <div>
              <div className="twk-sect">Palette</div>
              <SegRadio
                options={palettes}
                value={prefs.palette}
                onChange={(v) => onPrefsChange({ ...prefs, palette: v as ThemeKey })}
              />
            </div>
            <div>
              <div className="twk-sect">Headlines</div>
              <SegRadio
                options={fonts}
                value={prefs.headlines}
                onChange={(v) => onPrefsChange({ ...prefs, headlines: v as HeadlineFont })}
              />
            </div>
            <div>
              <div className="twk-sect">Reading Mode</div>
              <SegRadio
                options={modes}
                value={prefs.mode}
                onChange={(v) => onPrefsChange({ ...prefs, mode: v as ReadingMode })}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
