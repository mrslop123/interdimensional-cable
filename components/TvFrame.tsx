export default function TvFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-[#d4c5a9]">
      <div className="relative w-full h-full max-w-full max-h-full flex items-center justify-center">
        <div
          className="relative"
          style={{
            width: "min(90vw, calc(80vh * 1379 / 985))",
            aspectRatio: "1379/985",
          }}
        >
          <div
            className="absolute overflow-hidden"
            style={{ top: "5.7%", right: "4.7%", bottom: "4.5%", left: "3.4%", borderRadius: "12px" }}
          >
            {children}
          </div>

          <img
            src="/tv-frame.png"
            alt=""
            className="absolute inset-0 w-full h-full pointer-events-none select-none"
            style={{ objectFit: "contain", zIndex: 50, borderRadius: "12px", border: "2px solid #333" }}
          />
        </div>
      </div>
    </div>
  );
}
