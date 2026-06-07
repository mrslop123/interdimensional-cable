"use client";

import { useEffect } from "react";

export default function VhsTexture() {
  // inject a keyframe for the wobble
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes vhs-wobble-x {
        0% { transform: translateX(0); }
        25% { transform: translateX(0.5px); }
        50% { transform: translateX(-0.3px); }
        75% { transform: translateX(0.7px); }
        100% { transform: translateX(0); }
      }
      @keyframes vhs-shake {
        0% { transform: translate(0, 0) scale(1, 1); }
        20% { transform: translate(0.4px, -0.2px) scale(1.001, 1); }
        40% { transform: translate(-0.3px, 0.3px) scale(1, 1.001); }
        60% { transform: translate(-0.5px, -0.1px) scale(0.999, 1); }
        80% { transform: translate(0.2px, 0.2px) scale(1, 0.999); }
        100% { transform: translate(0, 0) scale(1, 1); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div
      className="absolute inset-0 z-10 pointer-events-none overflow-hidden"
      style={{ animation: "vhs-shake 0.15s linear infinite" }}
    >
      {/* scanlines – solid black lines, high opacity */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.22) 2px, rgba(0,0,0,0.22) 4px)",
          animation: "scanline-drift 0.08s linear infinite",
        }}
      />

      {/* chromatic aberration: 2 offset copies */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(255, 60, 60, 0.08)",
          mixBlendMode: "screen",
          animation: "vhs-wobble-x 0.12s linear infinite",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(40, 180, 255, 0.06)",
          mixBlendMode: "screen",
          animation: "vhs-wobble-x 0.12s linear infinite reverse",
        }}
      />

      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* horizontal glitch line */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(transparent 0px, transparent 160px, rgba(255,255,255,0.08) 160px, rgba(255,255,255,0.08) 161px, transparent 161px, transparent 480px)",
          animation: "scanline-drift 0.06s linear infinite reverse",
        }}
      />

      {/* film grain – SVG feTurbulence, repeated */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
          mixBlendMode: "overlay",
        }}
      />

      {/* warm colour cast */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "linear-gradient(150deg, rgba(200,100,20,0.5) 0%, transparent 50%, rgba(30,120,220,0.4) 100%)",
          mixBlendMode: "overlay",
        }}
      />
    </div>
  );
}
