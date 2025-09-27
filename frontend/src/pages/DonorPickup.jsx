import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../lib/api";
import {
  MapPin,
  Search,
  Copy,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Info,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ----------------------- tiny helpers ----------------------- */
const cx = (...xs) => xs.filter(Boolean).join(" ");
const toGmaps = (lat, lng, address) =>
  lat && lng
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        address || ""
      )}`;

/* ----------------------- base card ----------------------- */
const Card = ({ children, className = "" }) => (
  <div
    className={cx(
      "rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70",
      "shadow-[0_1px_0_#e5e7eb,0_10px_30px_rgba(0,0,0,0.08)]",
      className
    )}
  >
    {children}
  </div>
);

/* ----------------------- skeletons ----------------------- */
function Skeleton({ className = "" }) {
  return (
    <div className={cx("animate-pulse rounded-xl bg-slate-200/70", className)} />
  );
}

function PickupCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-28" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ===================== MAIN COMPONENT ===================== */
export default function DonorPickup() {
  const [items, setItems] = useState(null); // null = loading, [] possible
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [defaultId, setDefaultId] = useState(
    () => localStorage.getItem("bxc.defaultPickup") || null
  );
  const [copiedId, setCopiedId] = useState(null);
  const [campaign, setCampaign] = useState(null);

  // debounce search for smoother UX
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 180);
    return () => clearTimeout(t);
  }, [q]);

  // fetch campaign (tolerant to backend variations)
  useEffect(() => {
    let cancelled = false;
    async function loadCampaign() {
      try {
        let r = await apiGet("/api/campaigns/active");
        if (!cancelled && r) setCampaign(r?.campaign || r?.item || r);
      } catch {
        try {
          const r2 = await apiGet("/api/campaigns?status=active&limit=1");
          const first = r2?.items?.[0] || r2?.data?.[0] || null;
          if (!cancelled) setCampaign(first);
        } catch {
          // silently ignore – banner just won't show
        }
      }
    }
    loadCampaign();
    return () => {
      cancelled = true;
    };
  }, []);

  // fetch pickup points
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      try {
        const r = await apiGet("/api/donor/pickup-points");
        if (!cancelled) setItems(r.items || r.data || []);
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setError(
            "Không tải được danh sách điểm giao nhận. Vui lòng thử lại sau."
          );
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const list = useMemo(() => {
    if (!items) return null;
    if (!debouncedQ) return items;
    return items.filter((it) => {
      const name = (it.name || "").toLowerCase();
      const addr = (it.address || "").toLowerCase();
      return name.includes(debouncedQ) || addr.includes(debouncedQ);
    });
  }, [items, debouncedQ]);

  function setDefault(id) {
    setDefaultId(id);
    localStorage.setItem("bxc.defaultPickup", id || "");
  }

  async function copy(text, id) {
    try {
      await navigator.clipboard?.writeText(text || "");
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {}
  }

  /* ---------------------- animation variants ---------------------- */
  const containerV = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06, when: "beforeChildren" },
    },
  };
  const itemV = {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", mass: 0.9, damping: 18 } },
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Campaign banner */}
      {campaign && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className="overflow-hidden">
            <div className="relative p-5 md:p-6">
              <div className="absolute inset-0 pointer-events-none opacity-60 bg-[radial-gradient(40%_30%_at_10%_10%,#a78bfa33_0%,transparent_60%),radial-gradient(30%_40%_at_90%_20%,#22d3ee33_0%,transparent_60%),radial-gradient(60%_60%_at_50%_120%,#22c55e22_0%,transparent_70%)]" />
              <div className="relative flex items-start gap-3 md:gap-4">
                <div className="shrink-0 grid place-items-center h-12 w-12 rounded-xl bg-violet-50 border border-violet-200">
                  <Sparkles className="h-6 w-6 text-violet-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-violet-700/90">Chiến dịch đang diễn ra</div>
                  <div className="text-lg md:text-xl font-extrabold tracking-tight text-slate-900 truncate">
                    {campaign?.title || campaign?.name}
                  </div>
                  {campaign?.slogan && (
                    <div className="text-slate-600 mt-1 line-clamp-2">{campaign.slogan}</div>
                  )}
                </div>
                {campaign?.cover_url && (
                  <img
                    src={campaign.cover_url}
                    alt="Campaign cover"
                    className="hidden sm:block h-16 w-28 object-cover rounded-xl border"
                  />
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Heading */}
      <div className="mb-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Điểm giao nhận</h1>
        <p className="text-slate-600 mt-1">Chọn điểm gần bạn để giao–nhận nhanh chóng. Có thể đặt một điểm mặc định cho những lần sau.</p>
      </div>

      {/* Search */}
      <div className="mb-5">
        <div className="flex items-center gap-2 rounded-2xl border px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-violet-200">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoặc địa chỉ…"
            className="flex-1 outline-none placeholder:text-slate-400"
            aria-label="Tìm điểm giao nhận"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="p-4 mb-4">
          <div className="flex items-start gap-2 text-rose-700">
            <Info className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-semibold">Có lỗi xảy ra</div>
              <div className="text-sm text-rose-700/90">{error}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Content */}
      {!list ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <PickupCardSkeleton key={i} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="text-xl font-semibold text-slate-900">Chưa có điểm nào</div>
          <div className="text-slate-600 mt-1">Vui lòng liên hệ quản trị để thêm điểm mới.</div>
        </Card>
      ) : (
        <motion.div
          variants={containerV}
          initial="hidden"
          animate="show"
          className="grid md:grid-cols-2 gap-4"
        >
          <AnimatePresence>
            {list.map((it) => {
              const isDefault = String(defaultId || "") === String(it.id || "");
              return (
                <motion.div key={it.id} variants={itemV} layout>
                  <Card className="group p-4 transition-all hover:shadow-[0_1px_0_#e5e7eb,0_14px_34px_rgba(0,0,0,0.10)]">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 grid place-items-center h-12 w-12 rounded-xl bg-violet-50 border border-violet-200">
                        <MapPin className="h-6 w-6 text-violet-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-slate-900 truncate" title={it.name}>
                            {it.name}
                          </div>
                          {isDefault && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                              <CheckCircle2 className="h-4 w-4" /> Mặc định
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 mt-0.5 truncate" title={it.address}>
                          {it.address}
                        </div>
                        {it.lat && it.lng && (
                          <div className="text-xs text-slate-500 mt-0.5">({it.lat}, {it.lng})</div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {/* Nút 1: Đặt mặc định (đồng bộ xanh) */}
                          <button
                            onClick={() => setDefault(it.id)}
                            className={cx(
                              "px-3 py-1.5 rounded-2xl border text-sm font-semibold transition-colors",
                              isDefault
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                            )}
                            aria-pressed={isDefault}
                          >
                            {isDefault ? "Đã đặt mặc định" : "Đặt mặc định"}
                          </button>

                          {/* Nút 2: Mở bản đồ (đồng bộ xanh) */}
                          <a
                            href={toGmaps(it.lat, it.lng, it.address)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-2xl border text-sm inline-flex items-center gap-1 bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 transition-colors"
                          >
                            <ExternalLink className="h-4 w-4" /> Mở bản đồ
                          </a>

                          {/* Nút 3: Sao chép (đồng bộ xanh) */}
                          <button
                            onClick={() => copy(`${it.name} - ${it.address}`, it.id)}
                            className="px-3 py-1.5 rounded-2xl border text-sm inline-flex items-center gap-1 bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 transition-colors"
                          >
                            {copiedId === it.id ? (
                              <>
                                <CheckCircle2 className="h-4 w-4" /> Đã sao chép
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4" /> Sao chép
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* subtle footer hint */}
      <div className="mt-8 text-center text-xs text-slate-500">
        Mẹo: đặt một điểm mặc định để tiết kiệm thời gian cho những lần tặng kế tiếp.
      </div>
    </div>
  );
}
