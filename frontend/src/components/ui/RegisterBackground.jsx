import { useMemo } from "react";

function Particles({ density = 80 }) {
  const dots = useMemo(() => Array.from({ length: density }, (_, i) => ({
    key: i, left: Math.random() * 100, top: Math.random() * 100,
    size: Math.random() * 1.6 + 0.6, opacity: Math.random() * 0.7 + 0.2,
  })), [density]);

  return (
    <div className="pointer-events-none absolute inset-0">
      {dots.map((d) => (
        <span
          key={d.key}
          className="absolute rounded-full bg-white"
          style={{ left: `${d.left}%`, top: `${d.top}%`, width: d.size, height: d.size, opacity: d.opacity, boxShadow: "0 0 6px rgba(255,255,255,.6)" }}
        />
      ))}
    </div>
  );
}

export default function RegisterBackground() {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(1100px_600px_at_-10%_-10%,rgba(16,185,129,0.25),transparent),radial-gradient(900px_500px_at_110%_120%,rgba(99,102,241,0.25),transparent)]">
      <Particles density={80} />
    </div>
  );
}