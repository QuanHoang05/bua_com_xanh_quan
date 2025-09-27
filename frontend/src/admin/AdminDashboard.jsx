// src/pages/AdminDashboard.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../lib/api";
import {
  Users as UsersIcon,
  Megaphone,
  CreditCard,
  RefreshCcw,
  AlertCircle,
  Wifi,
  WifiOff,
  TrendingUp,
  Clock,
  Truck,
  MapPin,
  Bell,
  Soup,
  Percent,
} from "lucide-react";
import { useToast } from "../components/ui/Toast";

/* ================= Helpers ================= */
const toInt = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const toFloat = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const safeArr = (v) => (Array.isArray(v) ? v : []);
const safeObj = (v) => (v && typeof v === "object" ? v : {});
const objVal = (o, k, d = 0) => (o && Number.isFinite(Number(o[k])) ? Number(o[k]) : d);

function fmtTimeVi(d) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return d?.toLocaleString?.() ?? String(d);
  }
}

/* ================= Folders ================= */
function foldFromOverview(ovRaw) {
  const s = safeObj(ovRaw);
  return {
    usersTotal: objVal(s, "users"),
    donors: objVal(s, "donors"),
    recipients: objVal(s, "recipients"),
    pickupPointsTotal: objVal(s?.pickup_points ?? {}, "total"),
    announcementsActive: objVal(s?.announcements ?? {}, "active"),
    globalRaised: objVal(s, "global_raised"),
    mealPrice: objVal(s, "meal_price_vnd"),
    mealsGiven: objVal(s, "meals_given"),
    sumMealReceivedQty: objVal(s, "sum_meal_received_qty"),
    supportersTotal: objVal(s, "supporters"),
  };
}

/** /api/campaigns */
function foldFromCampaigns(listResp) {
  const items = safeArr(listResp?.items);
  const campaignsTotal = toInt(listResp?.total, items.length);
  const campaignsActive =
    items.filter((c) => String(c?.meta?.status || c?.status) === "active" || c?.status === "active").length;

  let sumRaised = 0, sumSupporters = 0, sumMealReceived = 0, sumDeliveredMeals = 0;
  for (const r of items) {
    sumRaised += toFloat(r?.raised ?? r?.raised_amount ?? 0);
    sumSupporters += toInt(r?.supporters ?? 0);
    sumMealReceived += toInt(r?.meal_received_qty ?? 0);
    sumDeliveredMeals += toInt(r?.delivered_meals ?? 0);
  }

  return {
    campaignsTotal,
    campaignsActive,
    campaignRaised: sumRaised,
    campaignSupporters: sumSupporters,
    campaignMealsReceived: sumMealReceived,
    campaignDeliveredMeals: sumDeliveredMeals,
    campaignsRaw: items,
  };
}

/** /api/analytics/delivery-rate */
function foldFromDeliveryRate(resp) {
  const items = safeArr(resp?.items);
  const summary = safeObj(resp?.summary);
  const series = items.map((r) => ({
    label: r?.grp_name ?? "—",
    value: Number(r?.success_rate ?? 0), // %
    delivered: toInt(r?.delivered ?? 0),
    cancelled: toInt(r?.cancelled ?? 0),
    total: toInt(r?.total ?? 0),
  }));
  return {
    successSeries: series, // [% theo group]
    successSummary: {
      delivered: toInt(summary?.delivered ?? 0),
      cancelled: toInt(summary?.cancelled ?? 0),
      total: toInt(summary?.total ?? 0),
      rate: Number(summary?.success_rate ?? 0), // %
    },
    successBasis: resp?.basis || "completed",
    successGroupBy: resp?.group_by || "day",
  };
}

/* =============== Main =============== */
export default function AdminDashboard() {
  const [view, setView] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastAt, setLastAt] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [eta, setEta] = useState(0);
  const controllerRef = useRef(null);
  const prevSnapshotRef = useRef(null);
  const t = useToast();

  const nf = useMemo(() => new Intl.NumberFormat("vi-VN"), []);
  const nfc = useMemo(() => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }), []);

  const CHANGE_THRESHOLD = 1;

  // ETA đếm ngược
  useEffect(() => {
    if (!autoRefresh) return;
    setEta(15);
    const iv = setInterval(() => setEta((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(iv);
  }, [autoRefresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    if (eta === 0) {
      load({ origin: "auto" });
      setEta(15);
    }
  }, [eta, autoRefresh]); // eslint-disable-line

  useEffect(() => {
    load({ origin: "init" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAll(signal) {
    // 14 ngày gần nhất cho analytics
    const now = new Date();
    const from = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000); // ~14d range
    const q = new URLSearchParams({
      scope: "all",
      group_by: "day",
      basis: "completed",
      from: from.toISOString().slice(0, 19), // yyyy-mm-ddThh:mm:ss
      to: now.toISOString().slice(0, 19),
    }).toString();

    const [ov, camps, recentDeliveries, deliveryRate] = await Promise.all([
      apiGet("/api/overview", { signal }).catch(() => ({})),
      apiGet("/api/campaigns?page=1&pageSize=500", { signal }),
      apiGet("/api/deliveries/recent?limit=8", { signal }).catch(() => ({ ok: true, items: [] })),
      apiGet(`/api/analytics/delivery-rate?${q}`, { signal }).catch(() => ({ items: [], summary: {} })),
    ]);
    return {
      ov,
      camps,
      recentDeliveries: safeArr(recentDeliveries?.items),
      deliveryRate,
    };
  }

  async function load({ origin = "manual" } = {}) {
    if (controllerRef.current) controllerRef.current.abort();
    const ctl = new AbortController();
    controllerRef.current = ctl;

    const isManual = origin === "manual";
    const isAuto = origin === "auto";

    try {
      setErr("");
      setLoading(true);
      if (isManual) t.info("Đang tải số liệu…", { duration: 800 });

      const { ov, camps, recentDeliveries, deliveryRate } = await fetchAll(ctl.signal);
      const now = new Date();

      const foldedOv = foldFromOverview(ov);
      const foldedCamps = foldFromCampaigns(camps);
      const foldedRate = foldFromDeliveryRate(deliveryRate);

      // Hợp nhất thành view duy nhất
      const curr = {
        ...foldedOv,
        ...foldedCamps,
        ...foldedRate, // ⬅️ success rate analytics
        paymentsByProvider: [],
        deliveriesByStatus: [],
        deliveriesTotal: 0,
        deliveriesToday: 0,
        deliveriesTodayCount: 0,
        deliveriesTodayMeals: 0,
        bookingsTotal: 0,
        bookingsByStatus: [],
        donationsTotal: foldedOv.supportersTotal,
        donationsSuccess: foldedOv.supportersTotal,
        donationsFailed: 0,
        donationsAmountSuccess: foldedCamps.campaignRaised,
        donationsLatest: [],
        announcementsLatest: [],
        recentDeliveries,
      };

      setView(curr);
      setLastAt(now);

      // so sánh thay đổi lớn
      const prev = prevSnapshotRef.current;
      if (prev) {
        const deltas = {
          users: (curr?.usersTotal ?? 0) - (prev?.usersTotal ?? 0),
          campaigns: (curr?.campaignsTotal ?? 0) - (prev?.campaignsTotal ?? 0),
          donations: (curr?.donationsSuccess ?? 0) - (prev?.donationsSuccess ?? 0),
        };
        const big = Object.values(deltas).some((d) => Math.abs(d) >= CHANGE_THRESHOLD);
        if ((isManual || isAuto) && big) {
          const lines = [
            Math.abs(deltas.users) >= CHANGE_THRESHOLD && `Users: ${trend(nf, deltas.users)} (tổng ${nf.format(curr.usersTotal)})`,
            Math.abs(deltas.campaigns) >= CHANGE_THRESHOLD && `Campaigns: ${trend(nf, deltas.campaigns)} (tổng ${nf.format(curr.campaignsTotal)})`,
            Math.abs(deltas.donations) >= CHANGE_THRESHOLD && `Donations (success): ${trend(nf, deltas.donations)} (≈ ${nf.format(curr.donationsSuccess)})`,
          ]
            .filter(Boolean)
            .join("\n");
          t.success({ title: "Dữ liệu có thay đổi", description: lines, duration: 3500 });
        } else if (isManual) {
          t.info({ title: "Đã cập nhật", description: "Không có thay đổi đáng kể." });
        }
      }
      prevSnapshotRef.current = curr;
    } catch (e) {
      if (e?.name === "AbortError") return;
      const msg = e?.message || "Load stats failed";
      setErr(msg);
      t.error({ title: "Không tải được dữ liệu", description: msg, duration: 4500 });
    } finally {
      setLoading(false);
    }
  }

  const handleManualRefresh = () => load({ origin: "manual" });

  const nfCompact = (n) =>
    new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-emerald-200/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 size-40 rounded-full bg-teal-200/25 blur-3xl" />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                <TrendingUp className="h-3.5 w-3.5" />
                Live overview
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-700">
              Tổng quan hệ thống •{" "}
              {lastAt ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5">
                  <Clock className="h-4 w-4 text-slate-600" />
                  <span className="text-slate-800">{fmtTimeVi(lastAt)}</span>
                </span>
              ) : (
                "Chưa cập nhật"
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                autoRefresh
                  ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                  : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
              }`}
              title="Bật/tắt tự động làm mới"
            >
              {autoRefresh ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4 text-slate-500" />}
              {autoRefresh ? `Tự làm mới (${eta}s)` : "Tự làm mới: tắt"}
            </button>

            <button
              onClick={handleManualRefresh}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:scale-[.98] transition"
              disabled={loading}
              title="Làm mới"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </button>
          </div>
        </div>

        {err && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">Không tải được dữ liệu</div>
              <div className="text-sm">{err}</div>
            </div>
          </div>
        )}
      </div>

      {/* Skeleton lần đầu */}
      {!view && loading ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <SkeletonPanel />
            <SkeletonPanel />
            <SkeletonPanel />
          </div>
        </>
      ) : null}

      {/* Content */}
      {view && (
        <>
          {/* Top KPIs */}
          <div className="grid gap-4 md:grid-cols-5">
            <StatCard
              title="Users"
              value={nf.format(view.usersTotal)}
              icon={UsersIcon}
              hint="Tổng người dùng"
              accent="from-emerald-300/30 to-teal-300/30"
            />
            <StatCard
              title="Campaigns"
              value={`${nf.format(view.campaignsActive)} / ${nf.format(view.campaignsTotal)}`}
              icon={Megaphone}
              hint="Active / Tổng"
              accent="from-sky-300/30 to-cyan-300/30"
            />
            <StatCard
              title="Tiền đã quyên góp"
              value={nfc.format(view.campaignRaised || 0)}
              icon={CreditCard}
              hint="sum(campaigns.raised_amount)"
              accent="from-violet-300/30 to-fuchsia-300/30"
            />
            <StatCard
              title="Bữa đã nhận"
              value={nf.format(view.campaignMealsReceived)}
              icon={Truck}
              hint="sum(campaigns.meal_received_qty)"
              accent="from-amber-300/30 to-orange-300/30"
            />
            {/* ⬇️ NEW KPI: Success Rate tổng */}
            <StatCard
              title="Tỷ lệ giao thành công"
              value={`${(view.successSummary?.rate ?? 0).toFixed(2)}%`}
              icon={Percent}
              hint="(delivered) / (delivered + cancelled)"
              accent="from-emerald-400/25 to-teal-400/25"
            />
          </div>

          {/* Hàng 2: Users by role + Payments + Pickup points */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Users by role" badge="—">
              <EmptyState text="Chưa có thống kê theo vai trò" />
            </Panel>

            <Panel title="Payments breakdown" badge="—">
              <EmptyState text="Chưa có dữ liệu thanh toán" />
            </Panel>

            <Panel title="Pickup points" badge={nf.format(view.pickupPointsTotal || 0)}>
              <KpiRow icon={MapPin} label="Số điểm nhận" value={nf.format(view.pickupPointsTotal || 0)} />
              <KpiRow icon={Bell} label="Announces (active)" value={nf.format(view.announcementsActive || 0)} />
            </Panel>
          </div>

          {/* Hàng 3: Success Rate + Deliveries */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* ⬇️ NEW PANEL: Success rate */}
            <Panel
              title={`Success rate (14 ngày • basis: ${view.successBasis === "all" ? "all" : "completed"})`}
              badge={`${nf.format(view.successSummary?.delivered || 0)} delivered / ${nf.format(view.successSummary?.cancelled || 0)} cancelled`}
            >
              {view.successSeries?.length ? (
                <>
                  <BarList
                    rows={view.successSeries.map((r) => ({ label: r.label, value: r.value }))}
                    kind="emerald"
                  />
                  <div className="mt-3">
                    <MiniTable
                      headers={["Ngày", "Delivered", "Cancelled", "Tổng", "Success %"]}
                      rows={view.successSeries.map((r) => [
                        r.label,
                        nf.format(r.delivered),
                        nf.format(r.cancelled),
                        nf.format(r.total),
                        `${r.value.toFixed(2)}%`,
                      ])}
                    />
                  </div>
                </>
              ) : (
                <EmptyState text="Không có dữ liệu tỷ lệ" />
              )}
            </Panel>

            <Panel title="Deliveries status" badge={`${nf.format(view.deliveriesTotal || 0)} tổng`}>
              {view.deliveriesByStatus?.length ? (
                <BarList rows={view.deliveriesByStatus.map((r) => ({ label: r.status, value: r.count }))} kind="teal" />
              ) : view.recentDeliveries?.length ? (
                <>
                  <MiniTable
                    headers={["Thời gian", "Campaign", "Qty", "Trạng thái"]}
                    rows={view.recentDeliveries.map((d) => [
                      d?.updated_at || d?.created_at || "—",
                      d?.campaign_id ?? "—",
                      nf.format(d?.qty ?? 0),
                      d?.status ?? "—",
                    ])}
                  />
                  <div className="mt-3 text-xs text-slate-500">
                    *Không có breakdown; đang hiển thị các lần giao gần đây từ <code>/api/deliveries/recent</code>.
                  </div>
                </>
              ) : (
                <EmptyState text="Chưa có thống kê giao nhận" />
              )}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <KpiTiny label="Hôm nay (đơn)" value={nf.format(view.deliveriesToday || view.deliveriesTodayCount || 0)} />
                <KpiTiny label="Bữa cứu hôm nay" value={nf.format(view.rescuedMealsToday || view.deliveriesTodayMeals || 0)} />
              </div>
            </Panel>
          </div>

          {/* Hàng 4: Donations (optional) + Hoạt động + Thông báo */}
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Donations gần đây" badge="—">
              <EmptyState text="Chưa có donation gần đây" />
              <div className="mt-3 grid grid-cols-3 gap-3">
                <KpiTiny label="Tổng donation (≈ success)" value={nf.format(view.donationsSuccess || 0)} />
                <KpiTiny label="Số người ủng hộ (≈)" value={nf.format(view.donationsSuccess || 0)} />
                <KpiTiny label="Tiền đã nhận" value={nfc.format(view.campaignRaised || 0)} />
              </div>
            </Panel>

            <Panel title="Hoạt động gần đây" badge="—">
              <EmptyState text="Chưa có hoạt động gần đây" />
            </Panel>

            <Panel title="Thông báo (announcements)" badge={view.announcementsActive ? `${nf.format(view.announcementsActive)} active` : "—"}>
              <EmptyState text="Không có thông báo hiển thị" />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

/* ============= Subcomponents ============= */

function trend(nf, n) {
  return n > 0 ? `↑ +${nf.format(n)}` : n < 0 ? `↓ -${nf.format(Math.abs(n))}` : "0";
}

function StatCard({ title, value, icon: Icon, hint, accent = "from-emerald-300/30 to-teal-300/20" }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${accent} blur-2xl`} />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-slate-700">{title}</div>
          <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{value}</div>
          {hint ? (
            <div className="mt-1 inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
              {hint}
            </div>
          ) : null}
        </div>
        {Icon ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
            <Icon className="h-6 w-6" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Panel({ title, badge, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
          {badge || "—"}
        </span>
      </div>
      {children}
    </div>
  );
}

function BarList({ rows, kind = "emerald" }) {
  const data = Array.isArray(rows) ? rows : [];
  const max = data.reduce((m, r) => Math.max(m, Number(r?.value ?? 0)), 0);
  const gradientMap = {
    emerald: "from-emerald-500 to-teal-500",
    teal: "from-teal-500 to-cyan-500",
    cyan: "from-cyan-500 to-sky-500",
    violet: "from-violet-500 to-fuchsia-500",
  };
  const barGrad = gradientMap[kind] || gradientMap.emerald;

  if (!data.length) return <EmptyState text="Không có dữ liệu" />;

  return (
    <ul className="space-y-3">
      {data.map((r, i) => {
        const label = String(r?.label ?? "—");
        const val = Number(r?.value ?? 0);
        const pct = max > 0 ? Math.round((val / max) * 100) : 0;
        return (
          <li key={`${label}-${i}`}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-900">
                {label}
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 tabular-nums text-slate-800">
                {val.toFixed(2)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full bg-gradient-to-r ${barGrad} transition-[width] duration-500`}
                style={{ width: `${pct}%` }}
                aria-label={`${label} ${val.toFixed(2)}%`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MiniTable({ headers = [], rows = [] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        {headers.length ? (
          <thead>
            <tr className="text-left">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2">
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[13px] font-semibold text-slate-700">
                    {h}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-200">
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-2">
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-slate-900">
                      {String(c ?? "—")}
                    </span>
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-4">
                <EmptyState text="Không có dữ liệu" />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function KpiRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <div className="flex items-center gap-2 text-slate-700">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <span>{label}</span>
      </div>
      <span className="tabular-nums font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function KpiTiny({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-8 w-32 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-3 w-40 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

function SkeletonPanel() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 h-5 w-40 animate-pulse rounded bg-slate-200" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-3 w-full animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ text = "No data" }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white">
        <span className="block h-1.5 w-1.5 rounded bg-slate-300" />
      </span>
      {text}
    </div>
  );
}
