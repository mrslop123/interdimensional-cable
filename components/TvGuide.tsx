"use client";

import { useState, useEffect, useCallback } from "react";
import type { VideoEntry } from "@/lib/schedule";

export interface GuideChannel {
  num: number;
  subreddit: string;
  video: VideoEntry | null;
  offset: number;
  duration: number;
  thumbnail: string | null;
}

interface TvGuideProps {
  channels: GuideChannel[];
  currentChannel: number;
  onSelect: (channel: number) => void;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatRemaining(offset: number, duration: number): string {
  const remaining = Math.max(0, duration - offset);
  return formatTime(remaining);
}

export default function TvGuide({ channels, currentChannel, onSelect, onClose }: TvGuideProps) {
  const [focusIdx, setFocusIdx] = useState(currentChannel);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((prev) => (prev - 1 + channels.length) % channels.length);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((prev) => (prev + 1) % channels.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        onSelect(focusIdx);
      } else if (e.key === "g" || e.key === "G" || e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [channels.length, focusIdx, onSelect, onClose],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center pb-4"
      onClick={onClose}
    >
      <div
        className="bg-black/90 border border-green-800/40 rounded-t-lg w-full max-h-full overflow-hidden flex flex-col animate-guide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "95%" }}
      >
        <div className="flex items-center justify-between px-4 py-2 border-b border-green-800/30 bg-green-950/40">
          <span className="text-green-400 font-mono text-sm tracking-[0.3em]">TV GUIDE</span>
          <span className="text-green-600 font-mono text-xs">[G] close</span>
        </div>

        <div className="overflow-y-auto flex-1">
          {channels.map((ch) => {
            const idx = ch.num - 1;
            const isActive = idx === currentChannel;
            const isFocused = idx === focusIdx;
            const progress = ch.duration > 0 ? (ch.offset / ch.duration) * 100 : 0;

            return (
              <div
                key={ch.num}
                data-channel={ch.num}
                onClick={() => onSelect(idx)}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors border-l-4 ${
                  isActive
                    ? "border-green-400 bg-green-400/10 text-green-300"
                    : isFocused
                      ? "border-green-800 bg-green-900/20 text-green-400/70"
                      : "border-transparent text-green-500/50 hover:bg-green-900/10"
                }`}
              >
                <span className="font-mono text-sm w-14 shrink-0 text-right tabular-nums">
                  CH {String(ch.num).padStart(2, "0")}
                </span>

                <div className="w-16 h-9 shrink-0 bg-green-950/60 rounded overflow-hidden flex items-center justify-center">
                  {ch.thumbnail ? (
                    <img
                      src={ch.thumbnail}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="text-green-900 text-[8px] font-mono">NO IMG</div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <span className="text-[11px] font-mono leading-tight truncate">
                    {ch.video ? ch.video.title : "NO SIGNAL"}
                  </span>
                  <div className="mt-0.5 h-1 bg-green-950/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500/60 rounded-full transition-[width] duration-1000 ease-linear"
                      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                  </div>
                </div>

                <span className="font-mono text-xs w-10 shrink-0 text-right tabular-nums opacity-70">
                  {ch.video ? formatRemaining(ch.offset, ch.duration) : "--:--"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
