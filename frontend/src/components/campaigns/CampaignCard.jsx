// src/components/campaigns/CampaignCard.jsx
import { Link } from "react-router-dom";
import { Users, MapPin, Clock, Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react";

/* ================== Config ================== */
const DEFAULT_MEAL_PRICE = 10000; // fallback nếu meta.meal.price không có

/* ================== Tiny helpers ================== */
const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const fmt = (v, locale = "vi-VN") => toNum(v).toLocaleString(locale);
const fmtMoney = (v) => `${fmt(v)} đ`;
const fmtMeal = (v, unit = "phần") => `${fmt(v)} ${unit}`;
const percent = (raised, goal) => {
  const r = toNum(raised, 0);
  const g = toNum(goal, 0);
  if (g <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((r / g) * 100)));
};
const dayDiff = (end) => {
  if (!end) return null;
  const d = new Date(end);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
};

const asIdOrSlug = (c) => encodeURIComponent(c?.id ?? c?.slug ?? "");

/* ================== UI atoms ================== */
function Pill({ label, tone = "slate" }) {
  const toneMap = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
    pink: "bg-pink-50 text-pink-700 border-pink-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={`inline-flex h-7 items-center rounded-full border px-2 text-xs font-medium ${toneMap[tone]}`}
      title={String(label)}
    >
      {label}
    </span>
  );
}

function Progress({ value = 0 }) {
  const v = Math.max(0, Math.min(100, toNum(value)));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
      <div
        className="h-full rounded-full bg-emerald-500 transition-[width] duration-700"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

/* ================== Component ================== */
/**
 * CampaignCard
 * Props:
 *  - c: object campaign từ API (đã normalize ở backend hoặc Campaigns.jsx)
 *  - variant: "public" | "admin"
 *  - onDonate(c), onEdit(c), onArchiveToggle(c), onDelete(c)
 */
export default function CampaignCard({
  c = {},
  variant = "public",
  onDonate,
  onEdit,
  onArchiveToggle,
  onDelete,
}) {
  // ---- Data đã chuẩn hoá từ API/Campaigns.jsx ----
  const isMeal = String(c.type || "").toLowerCase() === "meal";
  const cover = c.cover_url || c.cover || "/images/campaign-placeholder.jpg";
  const title = c.title || "Chiến dịch";
  const description = c.description || "";
  const location = c.location || "";
  const tags = Array.isArray(c.tags) ? c.tags : [];
  const supporters = toNum(c.supporters, 0);
  const status = (c.status || "active").toLowerCase();

  // Money
  const moneyGoal = toNum(c.target_amount ?? c.goal, 0);
  const moneyRaised = toNum(c.raised_amount ?? c.raised, 0);

  // Meal
  const mealGoal = isMeal ? toNum(c.meal_target_qty, 0) : 0;
  const mealRaised = isMeal ? toNum(c.meal_received_qty, 0) : 0;
  const mealUnit = (c.meal_unit || "phần").toString();
  const mealPrice = toNum(c?.meta?.meal?.price, DEFAULT_MEAL_PRICE) || DEFAULT_MEAL_PRICE;

  // Tiến độ hiển thị
  const pct = isMeal && mealGoal > 0 ? percent(mealRaised, mealGoal) : percent(moneyRaised, moneyGoal);

  // Ngày còn lại
  const daysLeft = dayDiff(c.deadline);

  /* ---------- Admin row ---------- */
  if (variant === "admin") {
    const archived = status === "archived";
    return (
      <div className="flex w-full items-center gap-4 rounded-2xl border bg-white px-3 py-2 hover:shadow-md transition">
        {/* Cover + Tiêu đề */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <img
            src={cover}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-slate-100"
          />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-slate-900">{title}</div>
            <div className="truncate text-xs text-slate-500">{description || "—"}</div>
          </div>
        </div>

        {/* Loại */}
        <div className="w-[92px] shrink-0">
          <Pill tone={isMeal ? "indigo" : "cyan"} label={isMeal ? "meal" : "money"} />
        </div>

        {/* Trạng thái */}
        <div className="w-[96px] shrink-0">
          <Pill tone={status === "active" ? "emerald" : archived ? "amber" : "slate"} label={archived ? "archived" : status} />
        </div>

        {/* Mục tiêu */}
        <div className="w-[190px] shrink-0 text-sm tabular-nums text-slate-900">
          <div className="font-medium">{fmtMoney(moneyGoal)}</div>
          {isMeal && (mealGoal > 0) && (
            <div className="text-xs text-slate-500">{fmtMeal(mealGoal, mealUnit)}</div>
          )}
        </div>

        {/* Đã đạt */}
        <div className="w-[190px] shrink-0 text-sm tabular-nums text-slate-900">
          <div className="font-medium">{fmtMoney(moneyRaised)}</div>
          {isMeal && (mealRaised > 0) && (
            <div className="text-xs text-slate-500">{fmtMeal(mealRaised, mealUnit)}</div>
          )}
        </div>

        {/* Tiến độ */}
        <div className="w-[180px] shrink-0">
          <Progress value={pct} />
          <div className="mt-1 text-right text-xs tabular-nums text-slate-500">{pct}%</div>
        </div>

        {/* Hỗ trợ / Ngày còn lại */}
        <div className="w-[160px] shrink-0 text-xs text-slate-700">
          <div className="flex items-center gap-1">
            <Users size={14} className="text-slate-500" />
            <b className="tabular-nums">{fmt(supporters)}</b> ủng hộ
          </div>
          {daysLeft !== null && (
            <div className="flex items-center gap-1">
              <Clock size={12} className="text-slate-500" /> Còn {daysLeft} ngày
            </div>
          )}
        </div>

        {/* Thao tác */}
        <div className="flex w-[220px] shrink-0 items-center justify-end gap-2">
          <button
            onClick={() => onEdit?.(c)}
            className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
            title="Sửa"
          >
            <Pencil size={16} />
            Sửa
          </button>

          <button
            onClick={() => onArchiveToggle?.(c)}
            className="inline-flex items-center gap-1 rounded-xl border bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
            title={archived ? "Bỏ lưu trữ" : "Lưu trữ"}
          >
            {archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            {archived ? "Bỏ lưu trữ" : "Lưu trữ"}
          </button>

          <button
            onClick={() => onDelete?.(c)}
            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100"
            title="Xoá"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Public card ---------- */
  // Quy đổi tương đương chỉ cho meal
  const moneyFromMealRaised = isMeal ? mealRaised * mealPrice : 0;
  const moneyFromMealGoal = isMeal ? mealGoal * mealPrice : 0;

  return (
    <div
      className="
        group relative h-full rounded-3xl p-[1.5px]
        bg-[conic-gradient(at_20%_-10%,#6366f1_0%,#a855f7_30%,#06b6d4_60%,transparent_75%)]
        transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5
        overflow-hidden
      "
    >
      <div className="rounded-[calc(theme(borderRadius.3xl)-2px)] overflow-hidden bg-white h-full flex flex-col">
        {/* Cover */}
        <div className="relative aspect-[16/9] overflow-hidden">
          <img
            src={cover}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          {isMeal && (
            <span className="absolute top-3 left-3 rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white shadow">
              Bữa ăn
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-slate-900">{title}</h3>

          {location && (
            <div className="flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin size={14} className="text-slate-500" />
              <span>{location}</span>
            </div>
          )}

          {description && <p className="line-clamp-2 text-sm text-slate-700">{description}</p>}

          {/* Progress + stats */}
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 transition-[width] duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Số liệu */}
            <div className="grid grid-cols-1 gap-1">
              {/* Dòng tiền: luôn hiển thị */}
              <div className="text-sm text-slate-800">
                Gây quỹ <b className="tabular-nums">{fmtMoney(moneyRaised)}</b>
                {moneyGoal > 0 ? (
                  <>
                    {" "} / <b className="tabular-nums">{fmtMoney(moneyGoal)}</b>
                  </>
                ) : null}
              </div>

              {/* Dòng bữa: chỉ hiển thị cho campaign meal */}
              {isMeal && (mealGoal > 0 || mealRaised > 0) && (
                <div className="text-sm text-slate-800">
                  Đã nhận <b className="tabular-nums">{fmtMeal(mealRaised, mealUnit)}</b>
                  {mealGoal > 0 ? (
                    <>
                      {" "} / <b className="tabular-nums">{fmtMeal(mealGoal, mealUnit)}</b>
                    </>
                  ) : null}
                </div>
              )}

              {/* Quy đổi tương đương: chỉ cho meal */}
              {isMeal && (
                <div className="text-xs text-slate-500">
                  Tương đương <span className="tabular-nums">{fmtMoney(moneyFromMealRaised)}</span>
                  {moneyFromMealGoal > 0 && (
                    <>
                      {" "} / <span className="tabular-nums">{fmtMoney(moneyFromMealGoal)}</span>
                    </>
                  )}
                </div>
              )}

              {/* Supporters + ngày còn lại */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-700 pt-1">
                <span className="flex items-center gap-1">
                  <Users size={14} className="text-slate-500" />
                  <b className="tabular-nums">{fmt(supporters)}</b> người ủng hộ
                </span>
                {daysLeft !== null && (
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-slate-500" /> Còn {daysLeft} ngày
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          {!!tags.length && (
            <div className="flex h-7 flex-wrap gap-2 overflow-hidden">
              {tags.slice(0, 4).map((t, i) => (
                <span
                  key={`${String(t)}-${i}`}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-800 transition hover:bg-slate-50"
                >
                  #{String(t)}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={() => onDonate?.(c)}
              className="
                w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600
                px-3 py-2 text-white shadow-sm transition hover:shadow active:brightness-95
                focus:outline-none focus:ring-2 ring-emerald-300
              "
            >
              Ủng hộ nhanh
            </button>

            <Link
              to={`/campaigns/${asIdOrSlug(c)}`}
              className="
                w-full rounded-xl border border-slate-200 px-3 py-2 text-center
                text-slate-900 transition hover:bg-slate-50 active:bg-slate-100
                focus:outline-none focus:ring-2 ring-fuchsia-200
              "
            >
              Chi tiết
            </Link>
          </div>
        </div>
      </div>

      {/* Outer glow */}
      <div
        className="
          pointer-events-none absolute inset-0 rounded-3xl
          bg-[conic-gradient(at_10%_-10%,#6366f1,transparent_30%,#a855f7,transparent_60%,#06b6d4)]
          opacity-0 blur-sm transition-opacity duration-500 group-hover:opacity-35
        "
        aria-hidden="true"
      />
    </div>
  );
}
