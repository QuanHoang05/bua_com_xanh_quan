// src/pages/Reports.jsx
// Báo cáo chiến dịch – all-in-one + “Bữa đã phát” (delivered meals)
// - Ưu tiên /api/reports/campaigns & /api/reports/transactions
// - Fallback /api/campaigns, /api/donations, /api/deliveries (thay vì distributions)
// - KPI mới: Bữa đã phát; Card/Modal hiển thị rõ; Xuất CSV cho “Bữa phát”
// - UI: bo góc/overflow-hidden, trạng thái tải/lỗi rõ ràng

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { apiGet } from "../lib/api";
import {
  BarChart3, Search, Filter, CalendarRange, ArrowUpWideNarrow, Users, Target,
  BadgeDollarSign, UtensilsCrossed, MapPin, Image as ImageIcon,
  X, Download, RefreshCcw, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2
} from "lucide-react";
import {
  ResponsiveContainer, BarChart as RBarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";

/* ========================= tiny UI ========================= */
const Card = ({ className = "", children }) => (
  <div
    className={[
      "rounded-3xl border border-slate-200 bg-white",
      "shadow-[0_1px_0_#e5e7eb,0_16px_40px_rgba(0,0,0,0.06)]",
      "overflow-hidden",
      className,
    ].join(" ")}
  >
    {children}
  </div>
);

const Badge = ({ className = "", children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${className}`}>{children}</span>
);

const Input = ({ className = "", ...props }) => (
  <input
    {...props}
    className={[
      "h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900",
      "outline-none focus:ring-4 focus:ring-emerald-200/70",
      "placeholder:text-slate-400",
      className,
    ].join(" ")}
  />
);

const Select = ({ className = "", ...props }) => (
  <select
    {...props}
    className={[
      "h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900",
      "outline-none focus:ring-4 focus:ring-emerald-200/70",
      className,
    ].join(" ")}
  />
);

const Button = ({ children, className = "", ...rest }) => (
  <button
    {...rest}
    className={[
      "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold",
      "transition hover:opacity-90 focus:ring-4 focus:outline-none",
      className,
    ].join(" ")}
  >
    {children}
  </button>
);

const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-2xl bg-slate-100 ${className}`} />;

const Empty = ({ title = "Không có dữ liệu", hint }) => (
  <Card className="p-10 text-center">
    <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-slate-100 grid place-items-center text-slate-500">
      <AlertCircle />
    </div>
    <div className="text-lg font-extrabold text-slate-900">{title}</div>
    {hint ? <div className="mt-1 text-slate-600">{hint}</div> : null}
  </Card>
);

/* ========================= helpers ========================= */
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clamp = (n, a = 0, b = 100) => Math.min(b, Math.max(a, n));
const pctProgress = (raised, goal) => {
  const g = Math.max(0, toNum(goal));
  const r = Math.max(0, toNum(raised));
  if (g <= 0) return r > 0 ? 100 : 0;
  return clamp(Math.round((r / g) * 100));
};
const fmtMoneyOnly = (v) => toNum(v).toLocaleString("vi-VN");
const fmtMoney = (v) => `${fmtMoneyOnly(v)} đ`;
const fmtMeals = (v) => `${toNum(v).toLocaleString("vi-VN")} bữa`;
const cov = (c) => c?.cover || c?.cover_url || c?.image || "";
const safeText = (x) => (x == null ? "—" : typeof x === "object" ? JSON.stringify(x) : String(x));
const ym = (d) => {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return "—";
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
};
function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* ====== campaign metric detection (map DB) ====== */
const pickMoneyRaised = (c) => toNum(c.raised_amount || c.money_raised || c.raised || 0);
const pickMoneyGoal = (c) => toNum(c.target_amount || c.goal || 0);
const pickMealsRaised = (c) => toNum(c.meal_received_qty || c.meals_raised || c.meals || c.total_meals || 0);
const pickMealsGoal = (c) => toNum(c.meal_goal || c.meals_goal || c.goal_meals || 0);
/** NEW: tổng bữa đã phát (ưu tiên cột campaigns.delivered_meals, fallback 0) */
const pickMealsDelivered = (c) => toNum(c.delivered_meals || c.meals_delivered || 0);

function detectMetric(c) {
  const type = String(c.type || "").toLowerCase();
  const hasMoney = (pickMoneyRaised(c) || pickMoneyGoal(c)) > 0;
  const hasMeals = (pickMealsRaised(c) || pickMealsGoal(c)) > 0;
  if (hasMoney && hasMeals) return "hybrid";
  if (type === "meal" || hasMeals) return "meals";
  return "money";
}

/* ===== progress bar ===== */
const ProgressBar = ({ pct, gradient = "from-emerald-600 via-teal-600 to-cyan-600" }) => (
  <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
    <div className={`h-full rounded-full bg-gradient-to-r ${gradient}`} style={{ width: `${clamp(pct)}%` }} />
  </div>
);

/* ===== status + chips ===== */
const StatusBadge = ({ status }) => {
  const s = (status || "").toLowerCase();
  const map =
    s === "active"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : s === "archived"
      ? "bg-slate-50 text-slate-800 ring-slate-200"
      : "bg-sky-50 text-sky-800 ring-sky-200";
  const label = s === "active" ? "Đang chạy" : s === "archived" ? "Lưu trữ" : s === "draft" ? "Nháp" : safeText(status);
  return <Badge className={map}>{label}</Badge>;
};

const MetricChip = ({ kind }) => {
  const isMoney = kind === "money";
  const map = isMoney ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-sky-50 text-sky-800 ring-sky-200";
  return (
    <Badge className={map}>
      {isMoney ? <BadgeDollarSign size={14} /> : <UtensilsCrossed size={14} />} {isMoney ? "Tiền" : "Bữa"}
    </Badge>
  );
};

/* ========================= PAGE ========================= */
export default function Reports() {
  const [items, setItems] = useState(null); // null=loading
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 18;
  const [selectedId, setSelectedId] = useState(null);

  // toolbar state
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 350);
  const [status, setStatus] = useState("all");
  const [year, setYear] = useState("all");
  const [sort, setSort] = useState("progress");
  const [metricFilter, setMetricFilter] = useState("all");
  const [viewMode, setViewMode] = useState("auto");

  // fetch list (reports -> campaigns fallback)
  const load = useCallback(
    async (toPage = 1) => {
      const qs = new URLSearchParams({
        page: String(toPage),
        pageSize: String(pageSize),
        q: debouncedQ,
        status,
        sort,
        year: year === "all" ? "" : String(year),
      }).toString();

      async function tryReports() {
        try {
          const r = await apiGet(`/api/reports/campaigns?${qs}`);
          const items = Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : [];
          const total = toNum(r?.total, items.length);
          return { items, total };
        } catch {
          return null;
        }
      }
      async function tryCampaigns() {
        try {
          const r = await apiGet(`/api/campaigns?${qs}`);
          const items = Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : [];
          const total = toNum(r?.total, items.length);
          return { items, total };
        } catch {
          return { items: [], total: 0 };
        }
      }

      setItems(null);
      const res = (await tryReports()) || (await tryCampaigns());
      setItems(res.items);
      setTotal(res.total);
      setPage(toPage);
    },
    [debouncedQ, status, sort, year]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  // normalize list
  const listRaw = useMemo(() => {
    return (items || []).map((c) => {
      const mRaised = pickMoneyRaised(c);
      const mGoal = pickMoneyGoal(c);
      const bRaised = pickMealsRaised(c);
      const bGoal = pickMealsGoal(c);
      const bDelivered = pickMealsDelivered(c); // NEW
      return {
        ...c,
        _metric: detectMetric(c),
        _moneyRaised: mRaised,
        _moneyGoal: mGoal,
        _mealsRaised: bRaised,
        _mealsGoal: bGoal,
        _mealsDelivered: bDelivered,
        _pctMoney: pctProgress(mRaised, mGoal),
        _pctMeals: pctProgress(bRaised, bGoal),
        _supporters: toNum(c.supporters || c.supporters_calc || 0),
      };
    });
  }, [items]);

  const list = useMemo(() => {
    return listRaw.filter((x) => metricFilter === "all" || x._metric === metricFilter);
  }, [listRaw, metricFilter]);

  // KPIs
  const kpi = useMemo(() => {
    const moneySet = listRaw.filter((x) => x._moneyRaised > 0 || x._moneyGoal > 0);
    const mealsSet = listRaw.filter((x) => x._mealsRaised > 0 || x._mealsGoal > 0);
    const sumRaisedMoney = moneySet.reduce((s, x) => s + x._moneyRaised, 0);
    const sumGoalMoney = moneySet.reduce((s, x) => s + Math.max(0, x._moneyGoal), 0);
    const avgPctMoney = moneySet.length ? Math.round(moneySet.reduce((s, x) => s + x._pctMoney, 0) / moneySet.length) : 0;
    const sumRaisedMeals = mealsSet.reduce((s, x) => s + x._mealsRaised, 0);
    const sumGoalMeals = mealsSet.reduce((s, x) => s + Math.max(0, x._mealsGoal), 0);
    const avgPctMeals = mealsSet.length ? Math.round(mealsSet.reduce((s, x) => s + x._pctMeals, 0) / mealsSet.length) : 0;
    const activeCount = listRaw.filter((x) => (x.status || "").toLowerCase() === "active").length;

    // NEW: tổng bữa đã phát — nếu chưa có ở list, sẽ tính ở Detail theo deliveries
    const sumDeliveredMeals = listRaw.reduce((s, x) => s + toNum(x._mealsDelivered), 0);

    return { sumRaisedMoney, sumGoalMoney, avgPctMoney, sumRaisedMeals, sumGoalMeals, avgPctMeals, activeCount, sumDeliveredMeals };
  }, [listRaw]);

  /* ======= render ======= */
  if (items === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!listRaw.length) {
    return <Empty title="Chưa có chiến dịch nào" hint="Hãy tạo chiến dịch hoặc thay đổi bộ lọc." />;
  }

  const maxPage = Math.max(1, Math.ceil((total || list.length) / pageSize));

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight text-slate-900">
          <BarChart3 className="text-emerald-600" /> Báo cáo theo chiến dịch
        </h1>
        <Badge className="bg-white ring-slate-200 text-slate-700">{`Đang hiển thị ${list.length} / ${total} chiến dịch`}</Badge>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-7 gap-3">
        <Kpi label="Tổng tiền đã quyên góp" value={fmtMoney(kpi.sumRaisedMoney)} tone="money" icon={<BadgeDollarSign />} />
        <Kpi label="Mục tiêu tiền" value={fmtMoney(kpi.sumGoalMoney)} tone="money-muted" icon={<Target />} />
        <Kpi label="Tiến độ tiền (TB)" value={`${kpi.avgPctMoney}%`} tone="money" icon={<BarChart3 />} />
        <Kpi label="Tổng bữa đã quyên góp" value={fmtMeals(kpi.sumRaisedMeals)} tone="meals" icon={<UtensilsCrossed />} />
        <Kpi label="Mục tiêu bữa" value={fmtMeals(kpi.sumGoalMeals)} tone="meals-muted" icon={<Target />} />
        <Kpi label="Chiến dịch đang chạy" value={kpi.activeCount.toLocaleString("vi-VN")} icon={<Users />} tone="neutral" />
        {/* NEW */}
        <Kpi label="Bữa đã phát" value={fmtMeals(kpi.sumDeliveredMeals)} tone="neutral" icon={<CheckCircle2 />} />
      </div>

      {/* toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Tìm tên / địa điểm / mô tả…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 w-72" />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang chạy</option>
              <option value="archived">Lưu trữ</option>
              <option value="draft">Nháp</option>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <CalendarRange size={16} className="text-slate-500" />
            <Select value={year} onChange={(e) => setYear(e.target.value)} className="w-36">
              <option value="all">Tất cả năm</option>
              {Array.from({ length: 7 }).map((_, i) => {
                const y = new Date().getFullYear() - i;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <UtensilsCrossed size={16} className="text-slate-500" />
            <Select value={metricFilter} onChange={(e) => setMetricFilter(e.target.value)} className="w-44">
              <option value="all">Tất cả loại chiến dịch</option>
              <option value="money">Chỉ tiền</option>
              <option value="meals">Chỉ bữa</option>
              <option value="hybrid">Cả hai (hybrid)</option>
            </Select>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <ArrowUpWideNarrow size={16} className="text-slate-500" />
            <Select value={viewMode} onChange={(e) => setViewMode(e.target.value)} className="w-56">
              <option value="auto">Hiển thị tự động (đúng đơn vị)</option>
              <option value="money">Ưu tiên hiển thị tiền</option>
              <option value="meals">Ưu tiên hiển thị bữa</option>
            </Select>

            <Button className="border border-slate-200 bg-white text-slate-900" onClick={() => load(page)}>
              <RefreshCcw size={16} /> Áp dụng
            </Button>
          </div>
        </div>
      </Card>

      {/* list */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className="text-left group rounded-3xl p-[1.5px] bg-[conic-gradient(at_20%_-10%,#34d39933,transparent_25%,#38bdf833,transparent_60%,#a78bfa33)] hover:-translate-y-0.5 hover:shadow-xl transition"
          >
            <div className="rounded-[calc(theme(borderRadius.3xl)-2px)] bg-white overflow-hidden">
              <div className="relative h-28 bg-slate-100">
                {cov(c) ? (
                  <img
                    src={cov(c)}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full grid place-items-center text-slate-400">
                    <ImageIcon size={20} />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <MetricChip
                    kind={c._metric === "hybrid" ? (viewMode === "meals" ? "meals" : "money") : c._metric}
                  />
                  <StatusBadge status={c.status} />
                </div>
              </div>
              <div className="p-5">
                <div className="font-semibold text-lg leading-snug text-slate-900 line-clamp-2">{safeText(c.title)}</div>
                <div className="mt-1 text-sm text-slate-600 flex items-center gap-1.5">
                  <MapPin size={14} className="text-slate-400" />
                  {safeText(c.location)}
                </div>
                {renderCardMetrics(c, viewMode)}
                {/* NEW: đã phát */}
                {toNum(c._mealsDelivered) > 0 && (
                  <div className="mt-3 text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Đã phát: <span className="tabular-nums">{toNum(c._mealsDelivered).toLocaleString("vi-VN")} bữa</span>
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Trang <b>{page}</b> / {maxPage}
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="border border-slate-200 bg-white text-slate-900 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => page > 1 && load(page - 1)}
          >
            <ChevronLeft size={16} /> Trước
          </Button>
          <Button
            className="border border-slate-200 bg-white text-slate-900 disabled:opacity-50"
            disabled={page >= maxPage}
            onClick={() => page < maxPage && load(page + 1)}
          >
            Sau <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* modal */}
      {selectedId && (
        <Modal onClose={() => setSelectedId(null)}>
          <Detail campaignId={selectedId} onClose={() => setSelectedId(null)} />
        </Modal>
      )}
    </div>
  );
}

/* ===== metrics on card ===== */
function renderCardMetrics(c, viewMode) {
  const showMoney = c._metric === "money" || (c._metric === "hybrid" && (viewMode === "auto" || viewMode === "money"));
  const showMeals = c._metric === "meals" || (c._metric === "hybrid" && (viewMode === "auto" || viewMode === "meals"));

  const moneyRaised = toNum(c._moneyRaised);
  const moneyGoal = toNum(c._moneyGoal);
  const mealsRaised = toNum(c._mealsRaised);
  const mealsGoal = toNum(c._mealsGoal);

  const hasMoneyGoal = moneyGoal > 0;
  const hasMealsGoal = mealsGoal > 0;

  const pctMoney = pctProgress(moneyRaised, moneyGoal);
  const pctMeals = pctProgress(mealsRaised, mealsGoal);

  const moneyText = hasMoneyGoal ? `${fmtMoneyOnly(moneyRaised)} / ${fmtMoneyOnly(moneyGoal)} đ` : moneyRaised > 0 ? `${fmtMoneyOnly(moneyRaised)} đ` : "—";
  const mealsText = hasMealsGoal
    ? `${mealsRaised.toLocaleString("vi-VN")} / ${mealsGoal.toLocaleString("vi-VN")} bữa`
    : mealsRaised > 0
    ? `${mealsRaised.toLocaleString("vi-VN")} bữa`
    : "—";

  const footer =
    c._metric === "hybrid"
      ? `${hasMoneyGoal ? `${pctMoney}% tiền` : `Không mục tiêu tiền`} · ${hasMealsGoal ? `${pctMeals}% bữa` : `Không mục tiêu bữa`}`
      : c._metric === "money"
      ? hasMoneyGoal
        ? `${pctMoney}% mục tiêu tiền`
        : "Không đặt mục tiêu tiền"
      : hasMealsGoal
      ? `${pctMeals}% mục tiêu bữa`
      : "Không đặt mục tiêu bữa";

  return (
    <div>
      {showMoney && (
        <>
          <div className="mt-4 mb-1.5 flex justify-between text-[15px] text-slate-800">
            <span>Đã quyên góp (tiền)</span>
            <span className="font-bold text-emerald-700 tabular-nums">{moneyText}</span>
          </div>
          {(hasMoneyGoal || moneyRaised > 0) && <ProgressBar pct={pctMoney} />}
        </>
      )}

      {showMeals && (
        <>
          <div className={`${showMoney ? "mt-3" : "mt-4"} mb-1.5 flex justify-between text-[15px] text-slate-800`}>
            <span>Đã quyên góp (bữa)</span>
            <span className="font-bold text-sky-700 tabular-nums">{mealsText}</span>
          </div>
          {(hasMealsGoal || mealsRaised > 0) && <ProgressBar pct={pctMeals} gradient="from-sky-600 via-cyan-600 to-emerald-600" />}
        </>
      )}

      <div className="mt-3 flex justify-between text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <Users size={14} className="text-slate-400" />
          {toNum(c._supporters).toLocaleString("vi-VN")} người ủng hộ
        </span>
        <span className="inline-flex items-center gap-1">
          <Target size={14} className="text-slate-400" />
          {footer}
        </span>
      </div>
    </div>
  );
}

/* ===== KPI card ===== */
function Kpi({ label, value, icon, tone = "neutral" }) {
  const map =
    {
      money: "bg-emerald-100 ring-emerald-200 text-emerald-700",
      "money-muted": "bg-emerald-50 ring-emerald-200 text-emerald-700",
      meals: "bg-sky-100 ring-sky-200 text-sky-700",
      "meals-muted": "bg-sky-50 ring-sky-200 text-sky-700",
      neutral: "bg-slate-100 ring-slate-200 text-slate-700",
    }[tone] || "bg-slate-100 ring-slate-200 text-slate-700";
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`shrink-0 h-10 w-10 grid place-items-center rounded-xl ring-1 ${map}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-slate-600">{label}</div>
        <div className="text-lg font-bold text-slate-900 tabular-nums truncate">{value}</div>
      </div>
    </Card>
  );
}

/* ===== modal wrapper ===== */
function Modal({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm p-4 flex items-center justify-center" onClick={onClose}>
      <div className="max-w-6xl w-full rounded-3xl bg-white border border-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ========================= DETAIL ========================= */
function Detail({ campaignId, onClose }) {
  const [detail, setDetail] = useState(null); // { item, series, latestMoney, latestMealsIn, latestMealsOut, deliveredMeals }
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState("bar"); // bar | line
  const [metric, setMetric] = useState("auto");
  const [activeTab, setActiveTab] = useState("money"); // money | meals_in | meals_out
  const dl1 = useRef(null);
  const dl2 = useRef(null);

  // fetch detail
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);

      // 1) ưu tiên /api/reports/campaigns/:id + /api/reports/transactions?campaignId=
      async function tryReportsDetail() {
        try {
          const res = await apiGet(`/api/reports/campaigns/${encodeURIComponent(campaignId)}`);
          if (!res) return null;

          let latestMoney = [];
          let latestMealsIn = [];
          let latestMealsOut = [];
          let deliveredMeals = toNum(res.item?.delivered_meals);

          try {
            const tx = await apiGet(`/api/reports/transactions?campaignId=${encodeURIComponent(campaignId)}&pageSize=200`);
            const all = Array.isArray(tx?.items) ? tx.items : Array.isArray(tx) ? tx : [];
            latestMoney = all.filter((d) => toNum(d.amount) > 0).slice(0, 100);
            latestMealsIn = all.filter((d) => toNum(d.meals) > 0 && !d.out).slice(0, 100);
            latestMealsOut = all.filter((d) => d.out && toNum(d.meals) > 0).slice(0, 100);
            // nếu BE trả sẵn tổng delivered trong tx summary:
            if (!deliveredMeals && latestMealsOut.length) {
              deliveredMeals = latestMealsOut.reduce((s, x) => s + toNum(x.meals), 0);
            }
          } catch {}

          // fallback từ res.latest nếu BE đã trả sẵn
          if (!latestMoney.length && Array.isArray(res.latest)) latestMoney = res.latest.filter((d) => toNum(d.amount) > 0).slice(0, 100);
          if (!latestMealsIn.length && Array.isArray(res.latest))
            latestMealsIn = res.latest.filter((d) => toNum(d.meals) > 0 && !d.out).slice(0, 100);

          return {
            item: res.item || res.campaign || null,
            series: Array.isArray(res.series) ? res.series : [],
            latestMoney,
            latestMealsIn,
            latestMealsOut,
            deliveredMeals,
          };
        } catch {
          return null;
        }
      }

      // 2) fallback tự ghép từ /campaigns + /donations + /deliveries (thay vì distributions)
      async function tryCompose() {
        try {
          const item = await apiGet(`/api/campaigns/${encodeURIComponent(campaignId)}`);
          // donations (status success)
          let don = [];
          try {
            const r = await apiGet(
              `/api/donations?campaign_id=${encodeURIComponent(campaignId)}&status=success&pageSize=200`
            );
            don = Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : [];
          } catch {}
          // deliveries (bữa phát) – status delivered
          let outs = [];
          try {
            const r = await apiGet(`/api/deliveries?campaign_id=${encodeURIComponent(campaignId)}&status=delivered&pageSize=200`);
            outs = Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : [];
          } catch {}

          // series theo tháng (tiền + bữa nhận)
          const byMonth = {};
          for (const it of don) {
            const key = ym(it.paid_at || it.created_at || Date.now());
            const amount = toNum(it.amount);
            const qty = toNum(it.qty || it.meals || it.quantity);
            byMonth[key] = byMonth[key] || { month: key, value: 0, meals: 0 };
            byMonth[key].value += amount;
            byMonth[key].meals += qty;
          }
          const series = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));

          const deliveredMeals =
            toNum(item?.delivered_meals) ||
            outs.reduce((s, d) => s + toNum(d.qty), 0); // nếu BE chưa cập nhật cột này

          return {
            item: { ...item, delivered_meals: deliveredMeals },
            series,
            latestMoney: don.filter((d) => toNum(d.amount) > 0).slice(0, 100),
            latestMealsIn: don.filter((d) => toNum(d.qty || d.meals || d.quantity) > 0).slice(0, 100),
            latestMealsOut: outs.slice(0, 100).map((x) => ({
              // chuẩn hóa vài key để hiển thị table
              at: x.delivered_at || x.updated_at || x.created_at,
              receiver: x.dropoff_name,
              amount: 0,
              meals: toNum(x.qty),
              note: x.note || `Giao đơn #${x.id} cho ${x.dropoff_name || ""}`.trim(),
            })),
            deliveredMeals,
          };
        } catch {
          return null;
        }
      }

      const res = (await tryReportsDetail()) || (await tryCompose());
      if (!alive) return;
      setDetail(res);
      const m = detectMetric(res?.item || {});
      setMetric(m === "hybrid" ? "auto" : m);
      setActiveTab(m === "meals" ? "meals_in" : "money");
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [campaignId]);

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton className="h-7 w-72 mb-4" />
        <Skeleton className="h-24 mb-4" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!detail?.item) {
    return (
      <div className="p-6">
        <div className="text-slate-700">Không tải được dữ liệu báo cáo.</div>
        <div className="mt-4 text-right">
          <Button className="border border-slate-200 bg-white text-slate-900" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    );
  }

  const c = detail.item;
  const moneyRaised = pickMoneyRaised(c);
  const moneyGoal = pickMoneyGoal(c);
  const mealsRaised = pickMealsRaised(c);
  const mealsGoal = pickMealsGoal(c);
  const mealsDelivered = toNum(c.delivered_meals || detail.deliveredMeals); // NEW
  const pctMoney = pctProgress(moneyRaised, moneyGoal);
  const pctMeals = pctProgress(mealsRaised, mealsGoal);
  const series = Array.isArray(detail.series) ? detail.series : [];
  const seriesNorm = series.map((s) => ({ month: s.month || s.label || "—", value: toNum(s.value), meals: toNum(s.meals) }));
  const chartMetric = metric === "auto" ? (detectMetric(c) === "meals" ? "meals" : "money") : metric;

  // CSV series
  const exportSeries = () => {
    const header = "month,value,meals\n";
    const body = seriesNorm.map((r) => `${r.month},${r.value},${r.meals}`).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = dl1.current || document.createElement("a");
    a.href = url;
    a.download = `campaign_${c.id}_series.csv`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  // CSV giao dịch theo tab
  const exportTx = () => {
    let list = [];
    if (activeTab === "money") list = detail.latestMoney || [];
    if (activeTab === "meals_in") list = detail.latestMealsIn || [];
    if (activeTab === "meals_out") list = detail.latestMealsOut || [];
    const rows = [["time", "party", "amount", "meals", "note"].join(",")];
    for (const d of list) {
      const time = safeCsvDate(d.paid_at || d.created_at || d.at || Date.now());
      const party = csvSafe(d.party || d.donor_name || d.donor || d.name || d.receiver || "—");
      const amount = toNum(d.amount);
      const meals = toNum(d.meals || d.qty || d.quantity);
      const note = csvSafe(d.note || d.message || d.description || "");
      rows.push([time, party, amount, meals, note].join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = dl2.current || document.createElement("a");
    a.href = url;
    a.download = `campaign_${c.id}_${activeTab}.csv`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  return (
    <div className="p-6 sm:p-8">
      {/* head */}
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 grid place-items-center rounded-xl bg-emerald-100 ring-1 ring-emerald-200 text-emerald-700">
          <BarChart3 />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-black tracking-tight text-slate-900 line-clamp-2">{safeText(c.title)}</div>
          <div className="text-sm text-slate-600">{safeText(c.description || "—")}</div>
        </div>
        <button className="rounded-full p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      {/* info banner */}
      <Card className="mt-4 p-4">
        <div className="text-sm text-slate-700">
          <b>Ghi chú:</b> “Bữa đã phát” lấy từ cột <code>delivered_meals</code> của chiến dịch hoặc cộng dồn các giao hàng <code>status=delivered</code> (fallback).
        </div>
      </Card>

      {/* controls */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <div className="inline-flex items-center gap-2 text-sm">
          <span className="text-slate-600">Hiển thị</span>
          <Select value={metric} onChange={(e) => setMetric(e.target.value)} className="h-9 w-44">
            <option value="auto">Tự động (đúng đơn vị)</option>
            <option value="money">Theo tiền</option>
            <option value="meals">Theo bữa</option>
          </Select>
        </div>
        <div className="inline-flex items-center gap-2 text-sm">
          <span className="text-slate-600">Dạng biểu đồ</span>
          <Select value={chartType} onChange={(e) => setChartType(e.target.value)} className="h-9 w-32">
            <option value="bar">Cột</option>
            <option value="line">Đường</option>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button className="border border-slate-200 bg-white text-slate-900" onClick={exportSeries}>
            <Download size={14} /> Xuất CSV biểu đồ
          </Button>
          <a ref={dl1} className="hidden" />
        </div>
      </div>

      {/* stats */}
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Đã quyên góp (tiền)" value={fmtMoney(moneyRaised)} />
        <Stat label="Mục tiêu (tiền)" value={fmtMoney(moneyGoal)} />
        <Stat label="Đã quyên góp (bữa)" value={fmtMeals(mealsRaised)} />
        <Card className="p-4">
          <div className="text-xs text-slate-600">Mục tiêu (bữa)</div>
          <div className="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums">{fmtMeals(mealsGoal)}</div>
          <div className="mt-2">
            <ProgressBar pct={pctMeals} gradient="from-sky-600 via-cyan-600 to-emerald-600" />
          </div>
        </Card>
        {/* NEW */}
        <Stat label="Bữa đã phát" value={fmtMeals(mealsDelivered)} />
      </div>

      {/* chart */}
      <div className="mt-8">
        <div className="mb-3 font-semibold text-slate-900">Thống kê theo tháng</div>
        <Card className="h-80 p-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === "bar" ? (
              <RBarChart data={seriesNorm.length ? seriesNorm : [{ month: "—", value: 0, meals: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={(m) => (m?.includes("-") ? m.split("-")[1] : m)} />
                <YAxis />
                <Tooltip
                  formatter={(v, n) =>
                    n === (chartMetric === "meals" ? "meals" : "value")
                      ? chartMetric === "meals"
                        ? [fmtMeals(v), "Bữa"]
                        : [fmtMoney(v), "Quyên góp"]
                      : [toNum(v).toLocaleString("vi-VN"), n === "meals" ? "Bữa" : "Khác"]
                  }
                  labelFormatter={(l) => (l?.includes("-") ? `Tháng ${l.split("-")[1]}` : l)}
                />
                <Legend />
                {chartMetric === "meals" ? (
                  <Bar dataKey="meals" name="Bữa" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                ) : (
                  <Bar dataKey="value" name="Quyên góp" fill="#10b981" radius={[8, 8, 0, 0]} />
                )}
              </RBarChart>
            ) : (
              <LineChart data={seriesNorm.length ? seriesNorm : [{ month: "—", value: 0, meals: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tickFormatter={(m) => (m?.includes("-") ? m.split("-")[1] : m)} />
                <YAxis />
                <Tooltip
                  formatter={(v, n) =>
                    n === (chartMetric === "meals" ? "meals" : "value")
                      ? chartMetric === "meals"
                        ? fmtMeals(v)
                        : fmtMoney(v)
                      : toNum(v).toLocaleString("vi-VN")
                  }
                  labelFormatter={(l) => (l?.includes("-") ? `Tháng ${l.split("-")[1]}` : l)}
                />  
                <Legend />
                {chartMetric === "meals" ? (
                  <Line dataKey="meals" name="Bữa" stroke="#38bdf8" strokeWidth={2} dot={false} />
                ) : (
                  <Line dataKey="value" name="Quyên góp" stroke="#10b981" strokeWidth={2} dot={false} />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </Card>
      </div>

      {/* transactions tabs */}
      <div className="mt-8">
        <div className="flex items-center gap-2">
          {["money", "meals_in", "meals_out"].map((tab) => {
            const label = tab === "money" ? "Tiền vào" : tab === "meals_in" ? "Bữa nhận" : "Bữa phát";
            const hidden = tab === "meals_out" && !(detail.latestMealsOut || []).length;
            if (hidden) return null;
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-2xl text-sm font-bold border ${
                  active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-slate-200"
                }`}
              >
                {label}
              </button>
            );
          })}
          <div className="ml-auto">
            <Button className="border border-slate-200 bg-white text-slate-900" onClick={exportTx}>
              <Download size={14} /> Xuất CSV giao dịch
            </Button>
            <a ref={dl2} className="hidden" />
          </div>
        </div>

        <Card className="mt-3">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left px-3 py-2.5 w-[160px]">Thời gian</th>
                  <th className="text-left px-3 py-2.5 w-[220px]">Người/Đơn vị</th>
                  <th className="text-left px-3 py-2.5">Nội dung</th>
                  <th className="text-right px-3 py-2.5 w-[140px]">Số tiền</th>
                  <th className="text-right px-3 py-2.5 w-[110px]">Số bữa</th>
                </tr>
              </thead>
              <tbody>{renderTxRows(activeTab, detail)}</tbody>
            </table>
          </div>
          {getTxList(activeTab, detail).length === 0 && <div className="p-6 text-slate-600">Chưa có giao dịch phù hợp.</div>}
        </Card>
      </div>
    </div>
  );
}

function getTxList(tab, detail) {
  if (tab === "money") return Array.isArray(detail?.latestMoney) ? detail.latestMoney : [];
  if (tab === "meals_in") return Array.isArray(detail?.latestMealsIn) ? detail.latestMealsIn : [];
  if (tab === "meals_out") return Array.isArray(detail?.latestMealsOut) ? detail.latestMealsOut : [];
  return [];
}

function renderTxRows(tab, detail) {
  const list = getTxList(tab, detail);
  return list.map((d, i) => {
    const when = new Date(d.paid_at || d.at || d.created_at || Date.now()).toLocaleString("vi-VN");
    const who = safeText(d.party || d.donor_name || d.donor || d.name || d.receiver || "—");
    const note = safeText(d.content || d.note || d.message || d.description || "");
    const amount = toNum(d.amount);
    const meals = toNum(d.meals || d.qty || d.quantity);
    return (
      <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/60">
        <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{when}</td>
        <td className="px-3 py-2.5 truncate max-w-[220px]" title={who}>
          {who}
        </td>
        <td className="px-3 py-2.5 text-slate-600">
          <div className="truncate" title={note}>
            {note}
          </div>
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">
          {amount ? fmtMoneyOnly(amount) + " đ" : "—"}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">
          {meals ? meals.toLocaleString("vi-VN") : "—"}
        </td>
      </tr>
    );
  });
}

function csvSafe(s) {
  return `"${String(s ?? "").replaceAll('"', '""')}"`;
}
function safeCsvDate(d) {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "" : t.toISOString();
}
function Stat({ label, value }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
    </Card>
  );
}
