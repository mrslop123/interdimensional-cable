"use client";

interface ChannelOverlayProps {
  channel: number;
  visible: boolean;
  subreddit?: string;
  author?: string;
  showTitle?: string;
}

export default function ChannelOverlay({
  channel,
  visible,
  subreddit,
  author,
  showTitle,
}: ChannelOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute top-16 right-14 z-30 font-mono text-green-400 text-right drop-shadow-[0_0_8px_rgba(74,222,128,0.6)]">
      <div className="text-lg tracking-widest opacity-80">
        CH
      </div>
      <div className="text-5xl font-bold leading-none animate-in">
        {String(channel).padStart(2, "0")}
      </div>

      {subreddit && (
        <div className="text-xs mt-1 opacity-60">
          r/{subreddit}
        </div>
      )}

      {showTitle && (
        <div className="text-sm mt-0.5 max-w-48 truncate opacity-50">
          {showTitle}
        </div>
      )}

      {author && (
        <div className="text-xs mt-0.5 opacity-40">
          u/{author}
        </div>
      )}
    </div>
  );
}
