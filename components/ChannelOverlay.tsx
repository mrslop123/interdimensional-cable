"use client";

interface ChannelOverlayProps {
  channel: number;
  visible: boolean;
  subreddit?: string;
  pendingDigits?: string | null;
  totalChannels: number;
}

export default function ChannelOverlay({
  channel,
  visible,
  subreddit,
  pendingDigits,
  totalChannels,
}: ChannelOverlayProps) {
  if (!visible) return null;

  return (
    <div className="absolute top-16 right-14 z-30 font-mono text-green-400 text-right drop-shadow-[0_0_8px_rgba(74,222,128,0.6)]">
      <div className="text-lg tracking-widest opacity-80">CH</div>
      <div className="text-5xl font-bold leading-none">
        {pendingDigits ? pendingDigits.padEnd(2, "-") : String(channel).padStart(2, "0")}
      </div>

      {!pendingDigits && subreddit && (
        <div className="text-xs mt-1 opacity-60">
          {channel === totalChannels ? `BEST OF` : `r/${subreddit}`}
        </div>
      )}
    </div>
  );
}
