// src/pages/VerifyOtp.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { API_BASE } from "../lib/api";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ShieldCheck, Loader2, Mail,
  RefreshCcw, CheckCircle2, AlertCircle
} from "lucide-react";

const base = import.meta.env.BASE_URL || "/";
const LOGO_URL = `${base}images/logo.jpg`;
const BG_URL = `${base}images/campaigns/auth-bg.jpg`;
const BG_FALLBACK = `${base}images/campaigns/bg-fallback.jpg`;

export default function VerifyOtp() {
  const [sp] = useSearchParams();
  const email = sp.get("email") || "";
  const next = sp.get("next") || "reset-password";

  const nav = useNavigate();
  const {
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm({ defaultValues: { code: "" }, mode: "onTouched" });

  // ===== Background preload =====
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

  // ===== OTP cells =====
  const [cells, setCells] = useState(Array(6).fill(""));
  const refs = Array.from({ length: 6 }).map(() => useRef(null));
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const code = useMemo(() => cells.join(""), [cells]);

  // Keep form hidden field in sync
  useEffect(() => setValue("code", code), [code, setValue]);

  useEffect(() => {
    // focus first empty when mount
    const idx = cells.findIndex((c) => !c);
    if (idx >= 0 && refs[idx]?.current) refs[idx].current.focus();
    // reset feedback when email changes
    setErr("");
    setOk("");
  }, [email]); // eslint-disable-line

  const handleChange = (i, v) => {
    const d = (v || "").replace(/\D/g, ""); // numbers only
    if (!d) {
      // clear current
      setCells((s) => {
        const n = [...s];
        n[i] = "";
        return n;
      });
      return;
    }
    // take first digit
    const digit = d[0];
    setCells((s) => {
      const n = [...s];
      n[i] = digit;
      return n;
    });
    // move to next
    if (i < 5) refs[i + 1]?.current?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (cells[i]) {
        // clear current only
        setCells((s) => {
          const n = [...s];
          n[i] = "";
          return n;
        });
      } else if (i > 0) {
        refs[i - 1]?.current?.focus();
        setCells((s) => {
          const n = [...s];
          n[i - 1] = "";
          return n;
        });
      }
    }
    if (e.key === "ArrowLeft" && i > 0) {
      refs[i - 1]?.current?.focus();
    }
    if (e.key === "ArrowRight" && i < 5) {
      refs[i + 1]?.current?.focus();
    }
    if (e.key === "Enter") {
      // submit when full
      if (code.length === 6) onSubmit({ code });
    }
  };

  const handlePaste = (e) => {
    const text = (e.clipboardData.getData("text") || "").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    const chunk = text.slice(0, 6).split("");
    setCells((s) => {
      const n = [...s];
      for (let i = 0; i < 6; i++) n[i] = chunk[i] || "";
      return n;
    });
    const target = refs[Math.min(chunk.length, 5)];
    target?.current?.focus();
  };

  // ===== Resend OTP cooldown =====
  const [cooldown, setCooldown] = useState(60);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const resend = async () => {
    if (!email) return setErr("Thiếu email trên URL.");
    try {
      setErr("");
      setOk("");
      setCooldown(60);
      // Backend của bạn đang dùng /api/auth/forgot-password để gửi OTP
      const r = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) throw new Error(data?.message || "Gửi OTP thất bại.");
      setOk("Đã gửi lại OTP vào email của bạn.");
    } catch (e) {
      setErr(e.message || "Không thể gửi lại OTP. Kiểm tra API.");
    }
  };

  // ===== Submit =====
  const onSubmit = async ({ code }) => {
    setErr("");
    setOk("");

    const c = String(code || "").trim();
    if (!email) return setErr("Thiếu email trên URL.");
    if (c.length !== 6) return setErr("Mã OTP cần đủ 6 số.");

    try {
      const r = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: c }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) {
        throw new Error(data?.message || "Mã OTP không đúng hoặc đã hết hạn.");
      }
      setOk("Xác thực thành công! Đang chuyển trang…");
      setTimeout(() => {
        nav(`/${next}?email=${encodeURIComponent(email)}&code=${encodeURIComponent(c)}`, { replace: true });
      }, 500);
    } catch (e) {
      setErr(e.message || "Không thể kết nối máy chủ. Kiểm tra API_BASE và CORS.");
    }
  };

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-slate-950 text-slate-100">
      {/* ===== Background (aurora + grid + texture) ===== */}
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0)_55%,rgba(0,0,0,0.5)_100%)]" />
        <div className="absolute inset-0 mix-blend-overlay opacity-30 bg-[url('/noise.png')]" />
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

      {/* top glow */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent -z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />

      {/* ===== Content ===== */}
      <div className="relative z-10 min-h-dvh w-full max-w-7xl mx-auto px-6 sm:px-10 grid place-items-center">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 130, damping: 16 }}
          className="w-full max-w-md"
        >
          {/* Back link */}
          <div className="mb-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition"
            >
              <ArrowLeft size={16} /> Quay lại đăng nhập
            </Link>
          </div>

          {/* Fancy glowing card */}
          <div className="relative">
            <span className="pointer-events-none absolute -inset-[1px] rounded-3xl bg-[conic-gradient(from_180deg_at_50%_50%,#22c55e33_0deg,#38bdf833_120deg,#a78bfa33_240deg,#22c55e33_360deg)] blur-[8px]" />
            <Card className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 backdrop-blur-2xl p-8 sm:p-10 shadow-[0_12px_60px_rgba(0,0,0,0.35)] text-slate-900">
              <span className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-black/5" />
              <span className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/40 via-white/0 to-white/10" />

              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={LOGO_URL}
                  alt="Bữa Cơm Xanh"
                  className="h-12 w-auto rounded-lg shadow-sm ring-1 ring-emerald-400/30"
                />
                <div>
                  <h1 className="text-3xl sm:text-[34px] font-extrabold leading-tight">
                    <span className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-violet-600 bg-clip-text text-transparent">
                      Xác thực OTP
                    </span>
                  </h1>
                  <div className="mt-1 h-1.5 w-36 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400" />
                </div>
              </div>

              <div className="flex items-center justify-between text-[13px] text-slate-600 mb-4">
                <span className="inline-flex items-center gap-1">
                  <Mail size={16} className="text-slate-500" />
                  Email:&nbsp;<span className="font-medium text-slate-800">{email || "(không có email)"}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={16} className="text-emerald-600" /> An toàn
                </span>
              </div>

              {/* Alerts */}
              <AnimatePresence>
                {err && (
                  <motion.div
                    key="err"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mb-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm px-3 py-2 flex items-start gap-2"
                    role="alert"
                  >
                    <AlertCircle size={16} className="mt-0.5" />
                    <span>{err}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {ok && (
                  <motion.div
                    key="ok"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-3 py-2 flex items-start gap-2"
                    role="status"
                  >
                    <CheckCircle2 size={16} className="mt-0.5" />
                    <span>{ok}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
                {/* OTP Inputs */}
                <div>
                  <label className="text-[15px] font-medium text-slate-800">Nhập mã OTP (6 số)</label>
                  <div
                    className="mt-2 grid grid-cols-6 gap-2 sm:gap-3"
                    onPaste={handlePaste}
                  >
                    {cells.map((v, i) => (
                      <input
                        key={i}
                        ref={refs[i]}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        aria-label={`OTP số ${i + 1}`}
                        className={[
                          "h-12 sm:h-14 text-center text-lg sm:text-xl font-semibold",
                          "rounded-xl border bg-white/90 outline-none ring-0",
                          "transition focus:ring-4 placeholder:text-slate-400",
                          v ? "border-emerald-400 focus:ring-emerald-100" : "border-slate-300 focus:border-emerald-500 focus:ring-emerald-100",
                        ].join(" ")}
                        value={v}
                        maxLength={1}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                      />
                    ))}
                  </div>
                  {/* hidden field for RHF */}
                  <input type="hidden" name="code" value={code} />
                  <p className="mt-2 text-xs text-slate-600">
                    Bạn có thể <span className="font-medium text-slate-800">dán</span> trực tiếp 6 số vào bất kỳ ô nào.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 transition"
                    onClick={() => nav(`/forgot?email=${encodeURIComponent(email)}`)}
                  >
                    <RefreshCcw size={16} /> Đổi email khác
                  </button>

                  <button
                    type="button"
                    className={[
                      "inline-flex items-center gap-2 text-sm font-semibold transition",
                      cooldown > 0
                        ? "text-slate-400 cursor-not-allowed"
                        : "text-emerald-700 hover:text-emerald-600",
                    ].join(" ")}
                    onClick={resend}
                    disabled={cooldown > 0}
                    aria-disabled={cooldown > 0}
                  >
                    Gửi lại OTP {cooldown > 0 ? `(${cooldown}s)` : ""}
                  </button>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full h-12 sm:h-14 text-[16px] sm:text-[17px] font-semibold justify-center disabled:opacity-60 rounded-xl shadow hover:shadow-md"
                  disabled={isSubmitting || code.length !== 6}
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="animate-spin" size={18} /> Đang xác thực...
                    </span>
                  ) : (
                    "Xác thực"
                  )}
                </Button>

                <p className="text-center text-[15px] text-slate-700">
                  Không thấy email? Kiểm tra hộp thư rác hoặc{" "}
                  <button
                    type="button"
                    onClick={resend}
                    disabled={cooldown > 0}
                    className="font-semibold text-emerald-700 hover:text-emerald-600 transition disabled:text-slate-400"
                  >
                    gửi lại OTP {cooldown > 0 ? `(${cooldown}s)` : ""}
                  </button>
                </p>
              </form>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
