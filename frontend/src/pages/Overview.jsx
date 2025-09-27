// --- src/pages/Overview.jsx — charity-style (TeamSeas vibe), PREMIUM UI/UX ---
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../lib/api";
import {
  Users, Soup, HandHeart, Megaphone, ArrowRight, MapPin,
  Calendar, Timer, AlertTriangle, Sparkles, Filter,
  HeartHandshake, Crown, Coins, Activity, CreditCard, Merge
} from "lucide-react";

/* --------------------------- UI PRIMITIVES --------------------------- */
const Card = ({ className = "", children }) => (
  <div
    className={[
      "rounded-3xl border border-slate-200 bg-white/85 text-slate-900 shadow-sm",
      "backdrop-blur-xl supports-[backdrop-filter]:bg-white/80",
      "transition-all duration-300 hover:shadow-xl",
      className,
    ].join(" ")}
  >
    {children}
  </div>
);

const GradientFrame = ({ children, className = "" }) => (
  <div
    className={
      "relative rounded-3xl p-[1.8px] " +
      "bg-[conic-gradient(at_20%_-10%,#34d39966,transparent_20%,#38bdf866_60%,transparent_80%)] " +
      className
    }
  >
    <Card className="rounded-[calc(theme(borderRadius.3xl)-2px)] overflow-hidden">
      {children}
    </Card>
  </div>
);

const Button = ({ children, variant = "primary", className = "", ...rest }) => {
  const base =
    "relative inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold transition focus:outline-none focus:ring-4 overflow-hidden group";
  const styles =
    variant === "primary"
      ? "bg-gradient-to-r from-emerald-600 to-sky-600 text-white hover:from-emerald-500 hover:to-sky-500 focus:ring-emerald-300"
      : variant === "outline"
      ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus:ring-slate-200"
      : variant === "ghost"
      ? "bg-white text-slate-900 hover:bg-slate-50 border border-slate-200 focus:ring-slate-200"
      : "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-300";
  return (
    <button {...rest} className={`${base} ${styles} ${className}`}>
      {variant === "primary" && (
        <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(120px_120px_at_var(--x,50%)_var(--y,50%),#ffffff33,transparent_40%)]" />
      )}
      {children}
    </button>
  );
};

const Badge = ({ children, tone = "emerald", className = "" }) => {
  const map = {
    emerald: "bg-emerald-100 text-emerald-800 border-emerald-200",
    sky: "bg-sky-100 text-sky-800 border-sky-200",
    rose: "bg-rose-100 text-rose-800 border-rose-200",
    amber: "bg-amber-100 text-amber-900 border-amber-200",
    slate: "bg-slate-100 text-slate-900 border-slate-200",
    violet: "bg-violet-100 text-violet-800 border-violet-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-lg border ${map[tone]} ${className}`}>
      {children}
    </span>
  );
};

const Select = ({ className = "", children, ...rest }) => (
  <select
    {...rest}
    className={[
      "rounded-xl border px-3 py-2 bg-white text-slate-900 outline-none",
      "border-slate-300 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500",
      className,
    ].join(" ")}
  >
    {children}
  </select>
);

/* --------------------------- SMALL BITS --------------------------- */
function SectionTitle({ icon: Icon, children, right }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-200/70 text-emerald-800 border border-emerald-300 shadow-sm">
            <Icon size={18} />
          </span>
        )}
        <h2
          className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent"
          style={{ letterSpacing: "-0.02em" }}
        >
          {children}
        </h2>
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

function StatChip({ icon: Icon, label, value }) {
  return (
    <div className="group relative flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-200 bg-white/85 backdrop-blur shadow-sm hover:shadow-lg transition">
      <div className="relative p-2.5 rounded-xl bg-emerald-50 ring-1 ring-emerald-200">
        <Icon size={20} className="text-emerald-700" />
      </div>
      <div className="space-y-0.5">
        <div className="text-[11px] uppercase tracking-wide text-slate-600">{label}</div>
        <div className="text-2xl md:text-[26px] font-extrabold tabular-nums text-slate-900 drop-shadow-sm">{value}</div>
      </div>
    </div>
  );
}

function ProgressBar({ pct, large = false }) {
  return (
    <div className={`rounded-full overflow-hidden ${large ? "h-3" : "h-2"} bg-slate-200/80`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-sky-600 transition-[width] duration-700"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

/* --------------------------- HELPERS --------------------------- */
const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const parseJson = (raw, fb = {}) => { try { return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : fb; } catch { return fb; } };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const pick = (obj, paths, fb = undefined) => {
  for (const p of paths) {
    const val = p?.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);
    if (val !== undefined && val !== null) return val;
  }
  return fb;
};
const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));

/* Normalizers */
function normalizeCampaign(r) {
  const meta = parseJson(r.meta) || {};
  const type = String(pick({ ...r, meta }, ["type", "campaign_type", "kind", "meta.type"], "money")).toLowerCase();
  const meal = meta?.meal || {};
  const meal_target_qty = toNum(meal.target_qty, 0);
  const meal_received_qty = toNum(
    pick(r, ["meal_received_qty_final", "meal_received_qty", "meta.meal.received_qty"], 0)
  );
  const goal = toNum(pick(r, ["goal", "target_amount", "meta.goal"], 0));
  const raised = toNum(pick(r, ["raised", "raised_amount", "raised_calc", "stats.raised"], 0));

  return {
    id: r.id ?? r._id ?? r.slug,
    type,
    title: pick(r, ["title", "name"], ""),
    description: pick(r, ["description", "desc"], ""),
    location: pick(r, ["location", "address.city", "address_str"], ""),
    cover: pick(r, ["cover_url", "cover", "image", "images.0"], ""),
    deadline: pick(r, ["deadline", "end_at", "meta.end_at"], null),
    tags: Array.isArray(r.tags) ? r.tags : (Array.isArray(meta?.tags) ? meta.tags : []),
    goal,
    raised,
    supporters: toNum(pick(r, ["supporters", "supporters_calc"], 0)),
    meal_unit: meal.unit || "phần",
    meal_target_qty,
    meal_received_qty,
  };
}

function normalizeDonation(x) {
  const name =
    pick(x, ["donor.name", "user.name", "donor_name", "name"], null) || "Ẩn danh";
  const status = (x.status || "success").toLowerCase();

  const qty =
    toNum(pick(x, [
      "qty", "quantity", "count",
      "item.qty", "item.quantity",
      "items.0.qty", "items.0.quantity",
      "food.qty", "food.quantity",
      "meta.qty", "meta.quantity"
    ], 0), 0);

  const unit = pick(x, [
    "unit", "item.unit", "items.0.unit",
    "food.unit", "meta.unit"
  ], "phần");

  const hasItem = !!pick(x, ["item.title", "food.title", "item_title"]);
  const money = toNum(pick(x, ["amount", "money", "value"], 0), 0);
  const isMeal = hasItem || (money <= 0 && qty > 0);

  return {
    id: x.id ?? x._id,
    donor: name,
    amount: money,
    item_title: pick(x, ["item.title", "food.title", "item_title"]),
    qty,
    unit,
    at: pick(x, ["created_at", "time", "date"], ""),
    ok: status === "success" || status === "paid",
    isMeal,
  };
}

function normalizeTransaction(x) {
  const status = (pick(x, ["status", "state"], "pending") || "").toLowerCase();
  const ok = status === "paid" || status === "success";
  return {
    id: x.id ?? x._id,
    code: pick(x, ["code", "txn_code"], null),
    amount: toNum(pick(x, ["amount", "value"], 0)),
    status: ok ? "paid" : status,
    at: pick(x, ["created_at", "time"], ""),
    ok,
  };
}

/* ====== FOOD Normalizer: thêm donor để gộp ====== */
function normalizeFood(x) {
  return {
    id: x.id ?? x._id,
    title: pick(x, ["title", "name"], "Món ăn"),
    description: pick(x, ["description", "desc"], ""),
    qty: toNum(pick(x, ["qty", "quantity"], 0)),
    unit: pick(x, ["unit"], ""),
    expire_at: pick(x, ["expire_at", "expires_at"], null),
    tags: x.tags || [],
    images: x.images || [],
    distance_km: typeof x.distance_km === "number" ? x.distance_km : null,
    location_addr: pick(x, ["location.addr", "address"]),
    diet_match: !!x.diet_match,
    reco_score: typeof x.reco_score === "number" ? x.reco_score : null,
    // donor info (nhiều schema khác nhau)
    donor_id: pick(x, ["donor.id", "user.id", "owner_id", "donor_id"], null),
    donor_name: pick(x, ["donor.name", "user.name", "owner_name", "donor_name"], null),
    donor_avatar: pick(x, ["donor.avatar", "user.avatar", "avatar"], null),
  };
}

/* ====== FOOD GROUPING ======
   Key = [donorId || donorName] + title + unit
   - qty: cộng dồn
   - expire_at: lấy sớm nhất
   - distance_km: lấy nhỏ nhất
   - tags/images: gộp unique
*/
function groupFoods(items = []) {
  const map = new Map();
  for (const f of items) {
    const donorKey = f.donor_id || (f.donor_name ? `n:${f.donor_name}` : "");
    const key = `${donorKey}|${(f.title || "").trim().toLowerCase()}|${(f.unit || "").trim().toLowerCase()}`;
    const ex = map.get(key);
    if (!ex) {
      map.set(key, { ...f });
    } else {
      ex.qty = toNum(ex.qty, 0) + toNum(f.qty, 0);
      const t1 = f.expire_at ? new Date(f.expire_at).getTime() : Infinity;
      const t2 = ex.expire_at ? new Date(ex.expire_at).getTime() : Infinity;
      ex.expire_at = (Math.min(t1, t2) !== Infinity) ? new Date(Math.min(t1, t2)).toISOString() : null;
      ex.distance_km =
        typeof ex.distance_km === "number" && typeof f.distance_km === "number"
          ? Math.min(ex.distance_km, f.distance_km)
          : (ex.distance_km ?? f.distance_km ?? null);
      ex.tags = uniq([...(ex.tags || []), ...(f.tags || [])]);
      ex.images = uniq([...(ex.images || []), ...(f.images || [])]);
      // giữ lại donor info đã có
      map.set(key, ex);
    }
  }
  return Array.from(map.values());
}

/* Count-up */
function useCountUp(target = 0, durationMs = 1200) {
  const [val, setVal] = useState(0);
  const rafRef = useRef(0), startRef = useRef(0), fromRef = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    startRef.current = 0;
    fromRef.current = val;
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(fromRef.current + (target - fromRef.current) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);
  return val;
}

/* --------------------------- PROGRESS (kép) --------------------------- */
function DualProgress({ pct, label }) {
  const showPct = Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.round(pct))) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-700">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">{showPct}%</span>
      </div>
      <ProgressBar pct={showPct} />
    </div>
  );
}

function FeaturedCard({ c }) {
  const cover =
    c.cover?.length > 4
      ? c.cover
      : "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=1200&auto=format&fit=crop";
  const isMeal = c.type === "meal";
  const pctMeals = c.meal_target_qty > 0 ? (c.meal_received_qty / c.meal_target_qty) * 100 : null;
  const pctMoney = c.goal > 0 ? (c.raised / c.goal) * 100 : null;

  return (
    <div className="group">
      <GradientFrame>
        <div className="relative">
          <div className="aspect-[16/9] overflow-hidden">
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
              loading="lazy"
            />
          </div>
          {c.location && (
            <span className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 backdrop-blur">
              <MapPin size={12} /> {c.location}
            </span>
          )}
          {c.deadline && (
            <span className="absolute top-3 right-3 bg-white/90 text-slate-900 text-xs px-2 py-1 rounded-full border border-slate-200 inline-flex items-center gap-1">
              <Calendar size={12} /> {new Date(c.deadline).toLocaleDateString("vi-VN")}
            </span>
          )}
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg md:text-xl font-semibold leading-tight line-clamp-1 text-slate-900">
              {c.title || "Chiến dịch"}
            </h3>
            {((pctMeals ?? 0) >= 90 || (pctMoney ?? 0) >= 90) && <Badge tone="emerald" className="ml-auto">Sắp đạt</Badge>}
            <Badge tone={isMeal ? "sky" : "emerald"} className="ml-1">{isMeal ? "meal" : "money"}</Badge>
          </div>

          <p className="text-[15px] text-slate-800 line-clamp-2">{c.description || "—"}</p>

          <div className="space-y-3">
            {pctMeals !== null && (
              <DualProgress
                pct={pctMeals}
                label={`Bữa: ${(c.meal_received_qty || 0).toLocaleString("vi-VN")} / ${(c.meal_target_qty || 0).toLocaleString("vi-VN")} ${c.meal_unit}`}
              />
            )}
            {pctMoney !== null && (
              <DualProgress
                pct={pctMoney}
                label={`Tiền: ${(c.raised || 0).toLocaleString("vi-VN")}đ / ${(c.goal || 0).toLocaleString("vi-VN")}đ`}
              />
            )}
            {pctMeals === null && pctMoney === null && <ProgressBar pct={0} />}
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            {(c.tags || []).slice(0, 3).map((t) => (
              <span key={String(t)} className="inline-flex px-2 py-0.5 rounded-lg text-xs bg-slate-100 text-slate-900 border border-slate-200">
                #{String(t)}
              </span>
            ))}
            {isMeal && (
              <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs bg-sky-100 text-sky-900 border border-sky-200">
                <Soup size={12} /> {(c.meal_received_qty || 0).toLocaleString("vi-VN")} {c.meal_unit}
              </span>
            )}
          </div>
        </div>
      </GradientFrame>
    </div>
  );
}

/* --------------------------- TOAST --------------------------- */
function Toast({ toast, onClose }) {
  if (!toast?.show) return null;
  const tone = toast.type || "success";
  const map = {
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    danger: "bg-rose-50 text-rose-900 border-rose-200",
    info: "bg-sky-50 text-sky-900 border-sky-200",
  };
  return (
    <div className="fixed bottom-4 right-4 z-[60]">
      <div className={`max-w-sm rounded-2xl border px-4 py-3 shadow-md ${map[tone]}`}>
        <div className="flex items-start gap-3">
          <Sparkles size={18} className="mt-0.5" />
          <div className="text-[15px] leading-relaxed">{toast.message}</div>
          <button className="ml-1 text-slate-600 hover:text-slate-800" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- MY MEAL PROGRESS (NEW) --------------------------- */
function MyMealProgress({ count }) {
  const milestones = [1, 5, 10, 25, 50, 100, 200, 500];
  const next = milestones.find(m => m > count) ?? count;
  const prev = milestones.reduce((p, m) => (m <= count ? m : p), 0);
  const denom = Math.max(1, next - prev);
  const numer = Math.max(0, count - prev);
  const pct = Math.min(100, Math.round((numer / denom) * 100));

  return (
    <GradientFrame>
      <div className="p-5 flex flex-col md:flex-row gap-4 md:items-center">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge tone="emerald">Cám ơn bạn 💚</Badge>
            <span className="text-sm text-slate-700">đã đóng góp bữa ăn cho cộng đồng</span>
          </div>

          <div className="flex items-end justify-between mb-1">
            <div className="text-[15px] text-slate-800">
              Tiến đến mốc <b className="text-slate-900">{next}</b> suất
              {prev > 0 && <span className="text-slate-700"> (đã đạt {prev})</span>}
            </div>
            <div className="text-sm font-semibold text-slate-900 tabular-nums">{pct}%</div>
          </div>

          <ProgressBar pct={pct} large />

          <div className="mt-1.5 text-xs text-slate-700">
            Bạn đã tặng <b className="text-slate-900 tabular-nums">{count}</b> {count > 1 ? "suất" : "suất"}.
            {next > count && <> Còn <b className="tabular-nums">{next - count}</b> suất nữa lên mốc tiếp theo.</>}
          </div>
        </div>

        <div className="shrink-0">
          <Button variant="outline" onClick={() => (window.location.href = "/donate")}>
            Tiếp tục ủng hộ
          </Button>
        </div>
      </div>
    </GradientFrame>
  );
}

/* --------------------------- MAIN PAGE --------------------------- */
export default function Overview() {
  // Core stats
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Featured campaigns
  const [featured, setFeatured] = useState({ items: [], total: 0 });
  const [loadingFeat, setLoadingFeat] = useState(true);

  // Leaderboard & activity
  const [topDonors, setTopDonors] = useState([]);
  const [recentDonations, setRecentDonations] = useState([]);
  const [recentTxns, setRecentTxns] = useState([]);

  // Foods (latest)
  const [foods, setFoods] = useState([]);

  // Notifications
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState({ show: false, type: "success", message: "" });

  // Geolocation & pickup
  const [latlng, setLatlng] = useState({ lat: null, lng: null });

  // Reco filter
  const [maxKm, setMaxKm] = useState(5);
  const [dietPref, setDietPref] = useState("any");
  const [recoSort, setRecoSort] = useState("priority");
  const [personalize, setPersonalize] = useState(true);
  const [reco, setReco] = useState({ items: [], ok: true, msg: "" });
  const [loadingReco, setLoadingReco] = useState(false);

  // Grouping (NEW)
  const [mergeFoods, setMergeFoods] = useState(true);

  // My meal donations (NEW)
  const [myMealCount, setMyMealCount] = useState(0);
  const [loadingMyMeals, setLoadingMyMeals] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  /* ---- Load overview stats ---- */
  useEffect(() => {
    (async () => {
      setLoadingStats(true);
      try {
        const s = await apiGet("/api/overview").catch(() => ({}));
        setStats(s || {});
      } finally {
        setLoadingStats(false);
      }
    })();
  }, []);

  /* ---- Load featured campaigns ---- */
  useEffect(() => {
    (async () => {
      setLoadingFeat(true);
      try {
        let res = await apiGet("/api/campaigns?featured=1&pageSize=6");
        if (!res?.items?.length) res = await apiGet("/api/campaigns?page=1&pageSize=6");
        const items = (res?.items || res || []).map(normalizeCampaign);
        setFeatured({ items, total: res?.total || items.length });
      } catch {
        setFeatured({ items: [], total: 0 });
      } finally {
        setLoadingFeat(false);
      }
    })();
  }, []);

  /* ---- Load multi tables: leaderboard, donations, transactions, foods ---- */
  useEffect(() => {
    (async () => {
      try {
        const [lb, dons, txs, foodsRes] = await Promise.allSettled([
          apiGet("/api/leaderboard?type=donors&limit=5"),
          apiGet("/api/donations?limit=8"),
          apiGet("/api/transactions?limit=6"),
          apiGet("/api/foods?limit=50") // lấy nhiều hơn để gộp
        ]);

        if (lb.status === "fulfilled" && lb.value) {
          const arr = (lb.value?.items || lb.value || []).map((x, i) => ({
            id: x.id ?? x._id ?? i,
            name: (x.name || x?.user?.name || x?.donor?.name || "Ẩn danh"),
            total: toNum(x.total ?? x.amount ?? x.sum, 0),
          }));
          setTopDonors(arr.slice(0, 5));
        }

        if (dons.status === "fulfilled" && dons.value) {
          const arrRaw = (dons.value?.items || dons.value || []).map(normalizeDonation);
          const arr = arrRaw.filter(d => d.ok);
          setRecentDonations(arr.slice(0, 8));
        }

        if (txs.status === "fulfilled" && txs.value) {
          const arrRaw = (txs.value?.items || txs.value || []).map(normalizeTransaction);
          const arr = arrRaw.filter(t => t.ok);
          setRecentTxns(arr.slice(0, 6));
        }

        if (foodsRes.status === "fulfilled" && foodsRes.value) {
          const raw = (foodsRes.value?.items || foodsRes.value || []).map(normalizeFood);
          setFoods(raw); // lưu raw, render sẽ quyết định gộp hay không
        }
      } catch { /* no-op */ }
    })();
  }, []);

  /* ---- Load my donations (meal only) ---- */
  useEffect(() => {
    (async () => {
      setLoadingMyMeals(true);
      try {
        let res =
          (await apiGet("/api/donations?mine=1&type=meal&limit=200").catch(() => null)) ||
          (await apiGet("/api/donations/me?type=meal&limit=200").catch(() => null)) ||
          (await apiGet("/api/donations?limit=200").catch(() => null));

        const list = (res?.items || res || []).map(normalizeDonation).filter(d => d.ok && d.isMeal);
        const totalMeals = list.reduce((s, d) => s + (d.qty > 0 ? d.qty : 1), 0);
        setMyMealCount(totalMeals);
      } catch {
        setMyMealCount(0);
      } finally {
        setLoadingMyMeals(false);
      }
    })();
  }, []);

  /* ---- Derived stats ---- */
  const mealsGivenApi = useMemo(() => {
    const m = stats?.meals_given ?? stats?.meals ?? stats?.distributed_meals ?? 0;
    return Number.isFinite(Number(m)) ? Number(m) : 0;
  }, [stats]);

  const mealsFromStatsCampaign = useMemo(() => {
    return toNum(
      stats?.extra_meals ??
      stats?.meals_from_campaigns ??
      stats?.sum_meal_received_qty ??
      stats?.meals_from_meal_col ??
      stats?.meals_from_received, 0
    );
  }, [stats]);

  const mealsFromFeatured = useMemo(
    () => (featured.items || []).reduce((sum, c) => sum + toNum(c.meal_received_qty, 0), 0),
    [featured]
  );

  const mealsGiven = Math.max(
    0,
    mealsGivenApi || 0,
    mealsFromStatsCampaign || 0,
    mealsFromFeatured || 0
  );

  const donors = stats?.donors ?? stats?.total_donors ?? 0;
  const recipients = stats?.recipients ?? stats?.total_recipients ?? 0;
  const campaigns = stats?.campaigns ?? stats?.active_campaigns ?? 0;

  const globalGoal = toNum(stats?.global_goal ?? stats?.target_meals ?? stats?.target_amount, 0);
  const globalRaised = toNum(stats?.global_raised ?? stats?.raised_meals ?? stats?.raised_amount ?? stats?.raised, 0);
  const progressPct = globalGoal > 0 ? clamp(Math.round((globalRaised / globalGoal) * 100), 0, 100) : 0;

  const deliveredMeals = useMemo(() => {
    const v =
      stats?.rescued_meals_total ??
      stats?.meals_delivered ??
      stats?.delivered_meals ??
      0;
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  }, [stats]);

  const heroCount = useCountUp(mealsGiven, 1200);

  /* ---- Toast helpers ---- */
  const showToast = (message, type = "success") => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast((t) => ({ ...t, show: false })) , 2800);
  };

  /* ---- Geolocation + pickup ---- */
  function getLocation() {
    if (!navigator.geolocation) { showToast("Trình duyệt không hỗ trợ định vị.", "warning"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLatlng({ lat: pos.coords.latitude, lng: pos.coords.longitude }); showToast("Đã lấy vị trí của bạn.", "info"); },
      () => showToast("Không lấy được vị trí. Hãy cấp quyền định vị.", "warning"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function fetchRecommendations() {
    setLoadingReco(true);
    try {
      const qs = new URLSearchParams({
        maxKm: String(maxKm),
        diet: dietPref,
        personalize: String(personalize),
        sort: recoSort,
        limit: "50",
        lat: latlng.lat ?? "",
        lng: latlng.lng ?? "",
      }).toString();
      const data = await apiGet(`/api/reco/foods?${qs}`);
      const arr = Array.isArray(data) ? data : data?.items || [];
      const normalized = arr.map(normalizeFood);
      setReco({
        items: mergeFoods ? groupFoods(normalized) : normalized,
        ok: true,
        msg: ""
      });
      showToast("Đã cập nhật gợi ý phù hợp.", "info");
    } catch {
      setReco({ items: [], ok: false, msg: "Không lấy được gợi ý." });
      showToast("Không lấy được gợi ý. Thử lại sau.", "danger");
    } finally {
      setLoadingReco(false);
    }
  }

  // foods hiển thị (áp dụng gộp nếu bật)
  const foodsDisplay = useMemo(
    () => (mergeFoods ? groupFoods(foods) : foods).slice(0, 12),
    [foods, mergeFoods]
  );

  return (
    <>
      <Toast toast={toast} onClose={() => setToast((t) => ({ ...t, show: false }))} />

      {/* Neon aura background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-20 -left-16 h-[32rem] w-[32rem] rounded-full blur-3xl opacity-30 bg-emerald-200" />
        <div className="absolute -bottom-24 -right-20 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-25 bg-sky-200" />
      </div>

      {/* HERO */}
      <section className={`mb-8 transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
        <GradientFrame>
          <div className="relative p-7 md:p-10 flex flex-col lg:flex-row items-start lg:items-center gap-7">
            <div className="flex-1">
              <div className="text-[15px] font-semibold text-emerald-800 mb-2 flex items-center gap-2">
                <HandHeart size={18} /> Cùng nhau giảm lãng phí – lan toả yêu thương
              </div>

              <h1 className="text-5xl font-extrabold tracking-tight">
                <span className="bg-gradient-to-r from-emerald-600 via-sky-600 to-emerald-500 bg-clip-text text-transparent">
                  Đã kết nối bữa ăn tới cộng đồng
                </span>
              </h1>

              <div className="mt-4 mb-2">
                {globalGoal > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm text-slate-800 mb-2">
                      <span>Tiến độ chiến dịch tổng</span>
                      <span className="font-semibold text-slate-900">{progressPct}%</span>
                    </div>
                    <ProgressBar pct={progressPct} large />
                    <div className="mt-1.5 text-xs text-slate-700">
                      {(globalRaised || 0).toLocaleString("vi-VN")} / {globalGoal.toLocaleString("vi-VN")} {stats?.unit || "bữa/đồng"}
                    </div>
                  </>
                )}
              </div>

              <div
                className="mt-2 mb-1 text-7xl md:text-8xl font-black leading-none tabular-nums text-slate-900 drop-shadow-sm"
                style={{ WebkitTextStroke: "1px rgba(255,255,255,0.75)", paintOrder: "stroke fill" }}
              >
                {loadingStats ? "…" : heroCount.toLocaleString("vi-VN")}
              </div>
              <div className="text-lg text-slate-800">bữa ăn đã được cho đi</div>

              <div className="mt-6 flex items-center gap-3">
                <Button
                  onMouseMove={(e)=>{e.currentTarget.style.setProperty('--x', `${e.nativeEvent.offsetX}px`); e.currentTarget.style.setProperty('--y', `${e.nativeEvent.offsetY}px`);}}
                  onClick={() => (window.location.href = "/campaigns")}
                  className="shadow-sm hover:shadow"
                >
                  Tham gia ủng hộ <ArrowRight size={16} className="ml-1" />
                </Button>
                <Button variant="outline" onClick={() => (window.location.href = "/reports")} className="hover:bg-white">
                  Xem tác động
                </Button>
              </div>
            </div>

            {/* Stats grid incl. NEW 'Bữa đã trao' */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:w-[36rem]">
              <StatChip icon={Users} label="Nhà hảo tâm" value={(donors || 0).toLocaleString("vi-VN")} />
              <StatChip icon={HandHeart} label="Người nhận" value={(recipients || 0).toLocaleString("vi-VN")} />
              <StatChip icon={Megaphone} label="Chiến dịch đang chạy" value={(campaigns || 0).toLocaleString("vi-VN")} />
              <StatChip icon={Soup} label="Bữa đã trao" value={(deliveredMeals || 0).toLocaleString("vi-VN")} />
            </div>
          </div>
        </GradientFrame>
      </section>

      {/* My meal donations progress (NEW) */}
      {!loadingMyMeals && myMealCount > 0 && (
        <div className="mb-6">
          <MyMealProgress count={myMealCount} />
        </div>
      )}

      {/* Leaderboard & activity */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <GradientFrame className="lg:col-span-2">
          <div className="p-5">
            <SectionTitle icon={Activity}>Hoạt động gần đây</SectionTitle>
            {recentDonations.length === 0 && recentTxns.length === 0 ? (
              <div className="text-slate-600 text-sm">Chưa có dữ liệu.</div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2 text-slate-900 font-semibold">
                    <HeartHandshake size={16}/> Quyên góp
                  </div>
                  <ul className="divide-y divide-slate-200/70">
                    {recentDonations.slice(0, 6).map((d) => (
                      <li key={d.id} className="py-2 text-sm flex items-center justify-between">
                        <span className="text-slate-900 font-medium line-clamp-1">{d.donor}</span>
                        <span className="text-slate-800">
                          {d.amount ? <><Coins size={12} className="inline mr-1" />{d.amount.toLocaleString("vi-VN")}đ</> : (d.item_title || "—")}
                        </span>
                      </li>
                    ))}
                    {!recentDonations.length && <li className="py-2 text-sm text-slate-600">Chưa có.</li>}
                  </ul>
                </Card>

                <Card className="p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2 text-slate-900 font-semibold">
                    <CreditCard size={16}/> Giao dịch (thành công)
                  </div>
                  <ul className="divide-y divide-slate-200/70">
                    {recentTxns.slice(0, 6).map((t) => (
                      <li key={t.id} className="py-2 text-sm flex items-center justify-between">
                        <span className="text-slate-900 font-medium">#{(t.code || String(t.id)).slice(0,6)}</span>
                        <span className="text-slate-800">{t.amount.toLocaleString("vi-VN")}đ • paid</span>
                      </li>
                    ))}
                    {!recentTxns.length && <li className="py-2 text-sm text-slate-600">Chưa có.</li>}
                  </ul>
                </Card>
              </div>
            )}
          </div>
        </GradientFrame>

        <GradientFrame>
          <div className="p-5">
            <SectionTitle icon={Crown}>Top nhà hảo tâm</SectionTitle>
            <ul className="space-y-2">
              {topDonors.length ? topDonors.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between rounded-2xl border bg-white/85 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={i === 0 ? "amber" : i === 1 ? "sky" : "slate"} className="!px-2">#{i+1}</Badge>
                    <span className="font-semibold text-slate-900 line-clamp-1 max-w-[14rem]">{p.name}</span>
                  </div>
                  <span className="tabular-nums text-slate-900">{p.total.toLocaleString("vi-VN")}đ</span>
                </li>
              )) : <li className="text-slate-600 text-sm">Chưa có dữ liệu.</li>}
            </ul>
          </div>
        </GradientFrame>
      </div>

      {/* Reco toolbar */}
      <GradientFrame className="mb-4">
        <div className="p-5">
          <SectionTitle
            icon={Filter}
            right={
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none text-slate-900">
                <input
                  type="checkbox"
                  checked={mergeFoods}
                  onChange={() => setMergeFoods(v => !v)}
                  className="h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-300"
                />
                <Merge size={14}/> Gộp món cùng người hoặc trùng nhau
              </label>
            }
          >
            Gợi ý cho bạn
          </SectionTitle>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={getLocation} className="hover:bg-white">
                <MapPin size={16} className="mr-2" /> Lấy vị trí
              </Button>
              <div className="text-sm text-slate-800">{latlng.lat ? "Đã bật GPS" : "Chưa dùng GPS (demo)"} </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-800">Bán kính</label>
              <div className="relative w-44">
                <input
                  type="range" min={1} max={20} value={maxKm}
                  onChange={(e) => setMaxKm(Number(e.target.value))}
                  className="w-full appearance-none bg-transparent relative z-10"
                />
                <div className="pointer-events-none absolute inset-y-1.5 left-0 right-0 rounded-full bg-slate-200" />
                <div
                  className="pointer-events-none absolute inset-y-1.5 left-0 rounded-full bg-gradient-to-r from-emerald-600 to-sky-600"
                  style={{ width: `${(maxKm / 20) * 100}%` }}
                />
              </div>
              <div className="w-12 text-right text-sm tabular-nums text-slate-900">{maxKm}km</div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-800">Chế độ ăn</label>
              <Select value={dietPref} onChange={(e) => setDietPref(e.target.value)}>
                <option value="any">Bất kỳ</option>
                <option value="chay">Ăn chay</option>
                <option value="halal">Halal</option>
                <option value="kythit">Kỵ thịt</option>
                <option value="none">Không ưu tiên</option>
              </Select>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none text-slate-900">
                <input
                  type="checkbox" checked={personalize}
                  onChange={() => setPersonalize(!personalize)}
                  className="h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-300"
                />
                Cá nhân hoá từ lịch sử
              </label>

              <Select value={recoSort} onChange={(e) => setRecoSort(e.target.value)}>
                <option value="priority">Ưu tiên</option>
                <option value="distance">Gần nhất</option>
                <option value="expiry">Sắp hết hạn</option>
              </Select>

              <Button onClick={fetchRecommendations} className="ml-1">Lấy gợi ý</Button>
            </div>
          </div>
        </div>
      </GradientFrame>

      {/* Recommendations result */}
      {loadingReco ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-slate-100 rounded-3xl" />)}
        </div>
      ) : !reco.ok ? (
        <GradientFrame className="mb-6">
          <div className="p-3 flex items-center gap-2 text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl">
            <AlertTriangle size={18} /> <span>{reco.msg}</span>
          </div>
        </GradientFrame>
      ) : reco.items.length > 0 ? (
        <>
          <SectionTitle icon={Sparkles} right={<div className="text-sm text-slate-800">{reco.items.length} mục</div>}>
            Gợi ý cho bạn
          </SectionTitle>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {reco.items.map((it) => <FoodCard key={it.id || `${it.title}-${Math.random()}`} item={it} />)}
          </div>
        </>
      ) : null}

      {/* Latest foods (newly donated) */}
      <SectionTitle
        icon={Soup}
        right={
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none text-slate-900">
              <input
                type="checkbox"
                checked={mergeFoods}
                onChange={() => setMergeFoods(v => !v)}
                className="h-4 w-4 rounded border-slate-400 text-emerald-600 focus:ring-emerald-300"
              />
              <Merge size={14}/> Gộp món trùng
            </label>
            <Button variant="ghost" onClick={() => (window.location.href = "/foods")}>
              Xem tất cả <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        }
      >
        Thực phẩm mới nhất
      </SectionTitle>

      {foodsDisplay.length === 0 ? (
        <Card className="p-8 text-center text-slate-600 mb-8">Chưa có thực phẩm mới.</Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {foodsDisplay.map((f) => <FoodCard key={`${f.id}-${f.title}-${f.unit}`} item={f} />)}
        </div>
      )}

      {/* Featured campaigns */}
      <SectionTitle
        icon={Megaphone}
        right={<Button variant="ghost" onClick={() => (window.location.href = "/campaigns")}>Xem tất cả <ArrowRight size={14} className="ml-1" /></Button>}
      >
        Chiến dịch tiêu biểu
      </SectionTitle>

      {loadingFeat ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Card key={i} className="h-64 animate-pulse bg-slate-100 rounded-3xl" />)}
        </div>
      ) : featured.items.length === 0 ? (
        <Card className="p-8 text-center text-slate-600">Chưa có chiến dịch.</Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featured.items.map((c) => <FeaturedCard key={c.id} c={c} />)}
        </div>
      )}
    </>
  );
}

/* --------------------------- FOOD CARD --------------------------- */
function FoodCard({ item }) {
  const cover =
    item.images?.[0] ||
    "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=800&auto=format&fit=crop";
  const km = typeof item.distance_km === "number" ? item.distance_km : null;
  const score = typeof item.reco_score === "number" ? Math.round(item.reco_score * 100) : null;
  const hoursLeft = item.expire_at
    ? Math.max(0, Math.ceil((new Date(item.expire_at) - new Date()) / 3600000))
    : null;
  const dietMatch = item.diet_match === true;

  return (
    <div className="group">
      <GradientFrame>
        <div className="overflow-hidden rounded-[calc(theme(borderRadius.3xl)-2px)]">
          <div className="relative aspect-[16/10]">
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
              loading="lazy"
            />
            <div className="absolute left-2 top-2 flex gap-2">
              {dietMatch && <Badge tone="emerald" className="!px-2 !py-0.5">Phù hợp chế độ ăn</Badge>}
              {score !== null && <Badge tone="sky" className="!px-2 !py-0.5">score {score}</Badge>}
            </div>
          </div>

          <div className="p-4 space-y-2 text-slate-900">
            <div className="font-semibold text-[15.5px] line-clamp-1">{item.title}</div>
            <div className="text-[14.5px] text-slate-800 line-clamp-2">{item.description}</div>
            <div className="text-sm">
              Còn <b className="tabular-nums">{item.qty}</b> {item.unit}
              {item.expire_at && <> • HSD {new Date(item.expire_at).toLocaleString("vi-VN")}</>}
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              {(item.tags || []).slice(0, 4).map((t) => <Badge key={String(t)} tone="slate">#{String(t)}</Badge>)}
              {km !== null && <Badge tone="slate"><MapPin size={12} className="mr-1" /> {km.toFixed(1)} km</Badge>}
              {hoursLeft !== null && (
                <span className={[
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs border",
                  hoursLeft <= 12 ? "bg-amber-100 text-amber-900 border-amber-200" : "bg-slate-100 text-slate-900 border-slate-200"
                ].join(" ")}>
                  <Timer size={12} /> còn ~{hoursLeft}h
                </span>
              )}
            </div>

            {(item.donor_name || item.donor_id) && (
              <div className="text-xs text-slate-700 flex items-center gap-2">
                {item.donor_avatar ? (
                  <img src={item.donor_avatar} alt="" className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-slate-200 inline-flex items-center justify-center text-[10px]">🎁</span>
                )}
                <span>Người tặng: <b className="text-slate-900">{item.donor_name || `#${String(item.donor_id).slice(0,6)}`}</b></span>
              </div>
            )}

            <div className="text-xs text-slate-700">{item.location_addr ? <>Địa điểm: {item.location_addr}</> : null}</div>
          </div>
        </div>
      </GradientFrame>
    </div>
  );
}
