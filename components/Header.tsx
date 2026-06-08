"use client";

const title = "INTERDIMENSIONAL";
const subtitle = "CABLE";

const quirks: Record<string, React.CSSProperties> = {
  I: { transform: "rotate(-3deg) translateY(-2px)", fontSize: "1.05em" },
  N: { transform: "rotate(2deg) translateY(1px)", fontSize: "0.95em" },
  T: { transform: "rotate(-1deg) translateY(-1px)" },
  E: { transform: "rotate(2deg)", fontSize: "1.02em" },
  R: { transform: "rotate(-2deg) translateY(2px)" },
  D: { transform: "rotate(1deg) translateY(-2px)", fontSize: "0.97em" },
  M: { transform: "rotate(-2deg) translateY(1px)", fontSize: "1.03em" },
  O: { transform: "rotate(3deg)", fontSize: "0.96em" },
  S: { transform: "rotate(-1deg) translateY(-1px)" },
  A: { transform: "rotate(2deg) translateY(1px)", fontSize: "1.01em" },
  L: { transform: "rotate(-3deg)", fontSize: "0.98em" },
  C: { transform: "rotate(1deg) translateY(-1px)" },
  B: { transform: "rotate(-2deg) translateY(1px)", fontSize: "1.04em" },
};

export default function Header() {
  return (
    <div className="w-full text-center select-none" style={{ zIndex: 60 }}>
      <div
        className="text-3xl leading-tight tracking-[0.05em] flex flex-col items-center"
        style={{ fontFamily: "var(--font-display)", color: "#3d2b4f" }}
      >
        <div className="flex">
          {[...title].map((char, i) => (
            <span
              key={`t-${i}`}
              className="inline-block"
              style={quirks[char] ?? {}}
            >
              {char}
            </span>
          ))}
        </div>
        <div className="flex">
          {[...subtitle].map((char, i) => (
            <span
              key={`s-${i}`}
              className="inline-block"
              style={quirks[char] ?? {}}
            >
              {char}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
