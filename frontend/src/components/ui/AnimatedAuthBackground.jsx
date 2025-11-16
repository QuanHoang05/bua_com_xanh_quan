import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const base = import.meta.env.BASE_URL || "/";
const BG_URL = `${base}images/campaigns/auth-bg.jpg`;
const BG_FALLBACK = `${base}images/campaigns/bg-fallback.jpg`;

export default function AnimatedAuthBackground() {
  const [bgSrc, setBgSrc] = useState(BG_URL);
  const [bgReady, setBgReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgReady(true);
    img.onerror = () => {
      setBgSrc(BG_FALLBACK);
      setBgReady(true);
    };
    img.src = BG_URL;
  }, []);

  return (
    <div className="absolute inset-0 -z-30">
      <img
        src={bgSrc}
        alt=""
        className="h-full w-full object-cover"
        style={{ opacity: bgReady ? 1 : 0, transition: "opacity .6s ease" }}
      />
      <div className="absolute inset-0 bg-slate-950/60" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(900px 520px at 12% 8%, rgba(16,185,129,0.22), transparent 55%), radial-gradient(1200px 700px at 88% 0%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 600px at 50% 100%, rgba(168,85,247,0.22), transparent 62%)",
        }}
      />
      {/* soft vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0)_55%,rgba(0,0,0,0.5)_100%)]" />
      {/* noise texture */}
      <div className="absolute inset-0 mix-blend-overlay opacity-30 bg-[url('/noise.png')]" />
      {/* animated tech grid mask */}
      <motion.div
        aria-hidden
        className="absolute inset-0 [mask-image:radial-gradient(58%_58%_at_50%_42%,black,transparent)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.35 }}
        transition={{ duration: 0.9 }}
      >
        <motion.div
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:44px_44px]"
          animate={{ backgroundPosition: ["0px 0px", "44px 44px"] }}
          transition={{ duration: 12, ease: "linear", repeat: Infinity }}
        />
      </motion.div>
    </div>
  );
}