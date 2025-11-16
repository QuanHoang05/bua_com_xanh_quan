import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const base = import.meta.env.BASE_URL || "/";
const LOGO_URL = `${base}images/logo.jpg`;

const features = [
  ["Minh bạch số liệu", "Theo dõi realtime"],
  ["Tối ưu quy trình", "Phân quyền chặt chẽ"],
  ["Bảo mật", "Mã hoá & JWT"],
  ["Hiệu suất cao", "UI hiện đại"],
];

export default function AuthHero() {
  return (
    <motion.section
      className="hidden lg:flex lg:col-span-7 px-10 xl:px-14 py-16"
      initial={{ opacity: 0, x: -28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.1 }}
    >
      <div className="m-auto max-w-2xl">
        {/* Big logo */}
        <div className="flex items-center gap-5 mb-8">
          <motion.img
            src={LOGO_URL}
            alt="Bữa Cơm Xanh"
            className="h-16 w-auto rounded-xl shadow-[0_8px_40px_rgba(34,197,94,0.35)] ring-1 ring-emerald-400/30"
            initial={{ scale: 0.96, rotate: -1 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 140, damping: 12 }}
          />
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-emerald-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent drop-shadow">
                Bữa Cơm Xanh
              </span>
            </h1>
            <p className="mt-2 text-slate-200/90">Nền tảng quản trị quyên góp & vận hành hiện đại.</p>
          </motion.div>
        </div>

        {/* Feature bullets */}
        <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map(([title, sub]) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/7.5 p-4 backdrop-blur-xl"
              style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
            >
              <CheckCircle2 className="mt-0.5 size-5 text-emerald-300" />
              <div>
                <p className="font-semibold text-white">{title}</p>
                <p className="text-sm text-slate-300/90">{sub}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </motion.section>
  );
}