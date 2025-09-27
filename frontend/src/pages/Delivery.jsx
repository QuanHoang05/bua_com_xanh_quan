// frontend/src/pages/Delivery.jsx
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { apiGet, apiPatch } from "../lib/api";
import {
  Truck, Bike, Clock3, CheckCircle2, XCircle,
  MapPin, Phone, RefreshCcw, ShieldCheck, AlertTriangle,
  ClipboardList, MessageSquare, Loader2, UserCheck,
  Copy, ExternalLink, CalendarClock, Package, Navigation
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ======================= API ======================= */
const API_LIST_MINE = (params = "") => `/api/deliveries?mine=1${params ? `&${params}` : ""}`;
const API_PATCH_STATE = (id) => `/api/deliveries/${id}/status`;
const API_REVIEW = (id) => `/api/deliveries/${id}/review`;
const API_REPORT = (id) => `/api/deliveries/${id}/report`;
const API_LIST_REPORTS_FOR_DELIVERY = (id, params = "") =>
  `/api/deliveries/${id}/reports?mine=1${params ? `&${params}` : ""}`;

/* ======================= UI META ======================= */
const STATUS_META = {
  pending:   { text: "Chờ tài xế",        icon: Clock3,       step: 1, bar: "bg-amber-500",   textColor: "text-amber-700",   chip: "bg-amber-50 text-amber-700 border-amber-200" },
  assigned:  { text: "Đã nhận đơn",       icon: Bike,         step: 2, bar: "bg-sky-500",     textColor: "text-sky-700",     chip: "bg-sky-50 text-sky-700 border-sky-200" },
  picking:   { text: "Đang lấy / giao",   icon: Truck,        step: 3, bar: "bg-cyan-500",    textColor: "text-cyan-700",    chip: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  delivered: { text: "Hoàn thành",        icon: CheckCircle2, step: 4, bar: "bg-emerald-600", textColor: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { text: "Đã hủy",            icon: XCircle,      step: 0, bar: "bg-rose-500",    textColor: "text-rose-700",    chip: "bg-rose-50 text-rose-700 border-rose-200" },
};
const ORDERED_STEPS = ["pending", "assigned", "picking", "delivered"];

const REASON_LABELS = {
  late: "Giao muộn",
  missing: "Thiếu hàng",
  attitude: "Thái độ không tốt",
  damage: "Hàng hoá hư hỏng",
  other: "Khác",
};
const STATUS_BADGE = (status) => {
  switch ((status || "").toLowerCase()) {
    case "open": case "new": return { text: "Chờ xử lý", cls: "bg-amber-100 text-amber-700 border-amber-200" };
    case "reviewing":
    case "in_progress":      return { text: "Đang xử lý", cls: "bg-sky-100 text-sky-700 border-sky-200" };
    case "resolved":         return { text: "Đã xử lý",   cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    case "rejected":
    case "closed":           return { text: "Đã đóng",    cls: "bg-slate-100 text-slate-700 border-slate-200" };
    default:                 return { text: status || "Không rõ", cls: "bg-slate-100 text-slate-700 border-slate-200" };
  }
};

/* ======================= small utils ======================= */
const VND = (n) => (Number(n || 0)).toLocaleString("vi-VN") + "đ";
const fmtDT = (v) => (v ? new Date(v).toLocaleString("vi-VN") : "—");
const fmtTime = (v) => (v ? new Date(v).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "");
const openMaps = ({ addr, lat, lng }) => {
  const q = lat && lng ? `${lat},${lng}` : encodeURIComponent(addr || "");
  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener,noreferrer");
};
const copy = async (text, toast = true) => {
  try { await navigator.clipboard.writeText(text || ""); toast && alert("Đã copy ✓"); }
  catch { toast && alert("Copy thất bại"); }
};

/* ======================= Stepper ======================= */
function Stepper({ status }) {
  const current = STATUS_META[status]?.step ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ORDERED_STEPS.map((s, i) => {
        const meta = STATUS_META[s];
        const active = i + 1 <= current;
        return (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${active ? meta.bar : "bg-slate-300"}`} />
            <span className={`text-xs ${active ? "text-slate-800 font-medium" : "text-slate-400"}`}>{meta.text}</span>
            {i < ORDERED_STEPS.length - 1 && (
              <div className={`w-10 h-0.5 rounded ${i + 1 < current ? "bg-emerald-500" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ======================= Main Page ======================= */
export default function DeliveryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [modal, setModal] = useState(null); // { id, mode: 'review'|'report'|'reports' }
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("all"); // all | pending | assigned | picking | delivered | cancelled
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet(API_LIST_MINE());
      const list = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
      setItems(list);
      setErr("");
    } catch (e) {
      setErr(e?.message || "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    timerRef.current = setInterval(load, 10000); // refresh 10s
    return () => clearInterval(timerRef.current);
  }, [load]);

  const patchStatus = async (id, action) => {
    try {
      await apiPatch(API_PATCH_STATE(id), { action });
      await load();
    } catch (e) {
      alert(e?.message || "Cập nhật thất bại");
    }
  };

  const handleAction = (id, action) => {
    if (action === "open_review")  return setModal({ id, mode: "review" });
    if (action === "open_report")  return setModal({ id, mode: "report" });
    if (action === "open_reports") return setModal({ id, mode: "reports" });
    patchStatus(id, action);
  };

  const submitReview = async ({ rating, comment }) => {
    if (!modal?.id) return;
    setSubmitting(true);
    try {
      await apiPatch(API_REVIEW(modal.id), { rating, comment });
      setModal(null);
      alert("Đã gửi đánh giá. Cảm ơn bạn!");
      await load();
    } catch (e) {
      alert(e?.message || "Không gửi được đánh giá");
    } finally {
      setSubmitting(false);
    }
  };

  const submitReport = async ({ reason, details }) => {
    if (!modal?.id) return;
    setSubmitting(true);
    try {
      await apiPatch(API_REPORT(modal.id), { reason, details });
      setModal(null);
      alert("Đã gửi báo cáo. Chúng tôi sẽ xử lý!");
    } catch (e) {
      alert(e?.message || "Không gửi được báo cáo");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((d) => d.status === filter);
  }, [items, filter]);

  return (
    <div className="mx-auto max-w-6xl p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-200 to-teal-200">
            <Truck className="h-6 w-6 text-emerald-700" />
          </div>
        <div>
            <h1 className="text-xl font-bold text-slate-900">Đơn giao của tôi</h1>
            <p className="text-xs text-slate-600">Track realtime, đến lấy hàng chuẩn, rating & report nhanh gọn.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {["all","pending","assigned","picking","delivered","cancelled"].map(s => {
              const meta = STATUS_META[s] || {};
              const active = filter === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-sm border ${active ? (meta.chip || "bg-slate-800 text-white border-slate-800") : "border-transparent text-slate-700 hover:bg-slate-50"}`}
                  title={s === "all" ? "Tất cả" : meta.text}
                >
                  {s === "all" ? "Tất cả" : meta.text}
                </button>
              );
            })}
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            title="Tải lại"
          >
            <RefreshCcw className="h-4 w-4" /> Tải lại
          </button>
        </div>
      </div>

      {/* States */}
      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">{err}</div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-4 w-60 animate-pulse rounded bg-slate-200" />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        </div>
      ) : !filtered?.length ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <Truck className="h-5 w-5 text-slate-500" />
          </div>
          <div className="font-medium text-slate-800">Không có đơn phù hợp bộ lọc.</div>
          <div className="text-sm text-slate-500">Chuyển sang “Tất cả” để xem toàn bộ.</div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((d) => (
            <DeliveryCard key={d.id} d={d} onAction={handleAction} />
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {modal?.mode === "review" && (
          <ReviewModal
            open
            submitting={submitting}
            onClose={() => setModal(null)}
            onSubmit={submitReview}
          />
        )}
        {modal?.mode === "report" && (
          <ReportModal
            open
            submitting={submitting}
            onClose={() => setModal(null)}
            onSubmit={submitReport}
          />
        )}
        {modal?.mode === "reports" && (
          <ReportsViewer
            open
            deliveryId={modal.id}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ======================= Card ======================= */
function DeliveryCard({ d, onAction }) {
  const meta = STATUS_META[d.status] || STATUS_META.pending;
  const MetaIcon = meta.icon;

  // derive pickup window
  const winFrom = fmtTime(d.pickup_time_from);
  const winTo   = fmtTime(d.pickup_time_to);
  const hasPickupWin = winFrom || winTo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-700">#{d.id}</span>
          <span className="text-slate-300">•</span>
          <span className={`inline-flex items-center gap-1 text-sm font-semibold ${meta.textColor}`}>
            <MetaIcon className="h-4 w-4" /> {meta.text}
          </span>
        </div>
        <div className="text-[11px] text-slate-600 flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Cập nhật: <span className="ml-1 font-medium text-slate-800">{fmtDT(d.updated_at)}</span>
        </div>
      </div>

      {/* Nội dung */}
      <div className="grid gap-4 p-4">
        <Stepper status={d.status} />

        {/* Pickup */}
        <Section title="Điểm lấy hàng" icon={Navigation}>
          <Info name={d.pickup_name} addr={d.pickup_address} phone={d.pickup_phone} />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Chip icon={CalendarClock} label="Khung giờ" value={hasPickupWin ? `${winFrom || "?"} – ${winTo || "?"}` : "Không đặt trước"} />
            {d.pickup_note && <Chip icon={MessageSquare} label="Ghi chú" value={d.pickup_note} />}
            {Number.isFinite(Number(d.qty)) && (
              <Chip icon={Package} label="Số lượng" value={`${d.qty} ${d.unit || "suất"}`} />
            )}
            {d.eta_time && <Chip icon={Clock3} label="ETA dự kiến" value={fmtDT(d.eta_time)} />}
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {d.pickup_address && (
              <>
                <ActionBtn onClick={() => copy(d.pickup_address)} icon={Copy} text="Copy địa chỉ" />
                <ActionBtn onClick={() => openMaps({ addr: d.pickup_address, lat: d.pickup_lat, lng: d.pickup_lng })} icon={ExternalLink} text="Mở Google Maps" />
              </>
            )}
            {d.pickup_phone && <ActionLink href={`tel:${d.pickup_phone}`} icon={Phone} text="Gọi điểm lấy" />}
          </div>
        </Section>

        {/* Dropoff */}
        <Section title="Người nhận" icon={UserCheck}>
          <Info name={d.dropoff_name} addr={d.dropoff_address} phone={d.dropoff_phone} />
          <div className="mt-2 flex flex-wrap gap-2">
            {d.dropoff_address && (
              <>
                <ActionBtn onClick={() => copy(d.dropoff_address)} icon={Copy} text="Copy địa chỉ" />
                <ActionBtn onClick={() => openMaps({ addr: d.dropoff_address })} icon={ExternalLink} text="Mở Google Maps" />
              </>
            )}
            {d.dropoff_phone && <ActionLink href={`tel:${d.dropoff_phone}`} icon={Phone} text="Gọi người nhận" />}
          </div>
        </Section>

        {/* Shipper */}
        {d.shipper_name && (
          <Section title="Shipper phụ trách" icon={Bike}>
            <Info name={d.shipper_name} phone={d.shipper_phone} />
            {d.shipper_phone && <div className="mt-2"><ActionLink href={`tel:${d.shipper_phone}`} icon={Phone} text="Gọi shipper" /></div>}
          </Section>
        )}
      </div>

      {/* Hành động */}
      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3 text-sm">
        {d.status === "pending" && (
          <PrimaryBtn onClick={() => onAction(d.id, "accept")} text="Xác nhận nhận đơn" />
        )}
        {d.status === "assigned" && (
          <PrimaryBtn tone="sky" onClick={() => onAction(d.id, "start_pickup")} text="Bắt đầu lấy hàng" />
        )}
        {d.status === "picking" && (
          <PrimaryBtn
            onClick={() => onAction(d.id, "delivered")}
            icon={CheckCircle2}
            text="Xác nhận giao thành công"
          />
        )}
        {!["delivered", "cancelled"].includes(d.status) && (
          <DangerBtn onClick={() => onAction(d.id, "cancel")} icon={XCircle} text="Hủy đơn" />
        )}

        {/* Đánh giá/Báo cáo khi đã hoàn tất hoặc hủy */}
        {["delivered", "cancelled"].includes(d.status) && (
          <>
            <PrimaryBtn tone="sky" onClick={() => onAction(d.id, "open_review")} text="Đánh giá shipper" />
            <WarnBtn onClick={() => onAction(d.id, "open_report")} icon={AlertTriangle} text="Báo cáo sự cố" />
          </>
        )}

        {/* Xem báo cáo đã gửi */}
        <SecondaryBtn onClick={() => onAction(d.id, "open_reports")} icon={ClipboardList} text="Xem báo cáo đã gửi" />
      </div>
    </motion.div>
  );
}

/* ======================= Blocks & Buttons ======================= */
function Section({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Chip({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <Icon className="h-4 w-4 text-slate-600" />
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-medium text-slate-800">{value || "—"}</div>
    </div>
  );
}

function ActionBtn({ onClick, icon: Icon, text }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-50"
    >
      {Icon && <Icon className="h-4 w-4" />} {text}
    </button>
  );
}
function ActionLink({ href, icon: Icon, text }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-50"
    >
      {Icon && <Icon className="h-4 w-4" />} {text}
    </a>
  );
}
function PrimaryBtn({ onClick, text, icon: Icon, tone = "emerald" }) {
  const toneMap = {
    emerald: "bg-emerald-600 hover:bg-emerald-700",
    sky: "bg-sky-600 hover:bg-sky-700",
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold text-white ${toneMap[tone]}`}
    >
      {Icon && <Icon className="h-4 w-4" />} {text}
    </button>
  );
}
function SecondaryBtn({ onClick, text, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-800 hover:bg-slate-50"
    >
      {Icon && <Icon className="h-4 w-4" />} {text}
    </button>
  );
}
function WarnBtn({ onClick, text, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-white hover:bg-amber-600"
    >
      {Icon && <Icon className="h-4 w-4" />} {text}
    </button>
  );
}
function DangerBtn({ onClick, text, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-700"
    >
      {Icon && <Icon className="h-4 w-4" />} {text}
    </button>
  );
}

/* ======================= Info block ======================= */
function Info({ name, addr, phone }) {
  return (
    <div className="space-y-1">
      <div className="font-medium text-slate-900">{name || "—"}</div>
      {addr && (
        <div className="inline-flex items-start gap-2 text-slate-700">
          <MapPin className="mt-0.5 h-4 w-4 text-slate-500" />
          <span>{addr}</span>
        </div>
      )}
      {phone && (
        <a href={`tel:${phone}`} className="inline-flex items-center gap-1 text-emerald-700 hover:underline" title="Gọi">
          <Phone className="h-4 w-4" /> {phone}
        </a>
      )}
    </div>
  );
}

/* ======================= Review Modal ======================= */
function ReviewModal({ open, submitting, onClose, onSubmit }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
          >
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Đánh giá shipper</h2>

            <div className="mb-3 flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setRating(s)} aria-label={`Chọn ${s} sao`}>
                  <span className={s <= rating ? "text-amber-500 text-2xl" : "text-slate-300 text-2xl"}>★</span>
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Nhận xét của bạn…"
              className="mb-4 h-28 w-full resize-none rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                disabled={submitting}
                onClick={() => onSubmit({ rating, comment })}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitting ? "Đang gửi…" : "Gửi đánh giá"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ======================= Report Modal ======================= */
function ReportModal({ open, submitting, onClose, onSubmit }) {
  const [reason, setReason] = useState("late");
  const [details, setDetails] = useState("");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
          >
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Báo cáo sự cố</h2>

            <label className="mb-2 block text-sm font-medium text-slate-700">Lý do</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mb-3 w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 text-slate-900 [&>option]:text-slate-900"
            >
              <option value="late">Giao muộn</option>
              <option value="missing">Thiếu hàng</option>
              <option value="attitude">Thái độ không tốt</option>
              <option value="damage">Hàng hoá hư hỏng</option>
              <option value="other">Khác</option>
            </select>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Mô tả chi tiết sự cố…"
              className="mb-4 h-28 w-full resize-none rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                disabled={submitting}
                onClick={() => onSubmit({ reason, details })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                <AlertTriangle className="h-4 w-4" />
                {submitting ? "Đang gửi…" : "Gửi báo cáo"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ======================= Reports Viewer ======================= */
function ReportsViewer({ open, deliveryId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet(API_LIST_REPORTS_FOR_DELIVERY(deliveryId));
      const list = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
      setItems(list);
      setErr("");
    } catch (e) {
      setErr(e?.message || "Không tải được danh sách báo cáo");
    } finally {
      setLoading(false);
    }
  }, [deliveryId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold text-slate-900">Báo cáo đã gửi — Đơn #{deliveryId}</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                <span className="text-sm text-slate-600">Đang tải…</span>
              </div>
            ) : err ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{err}</div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                Chưa có báo cáo nào cho đơn này.
              </div>
            ) : (
              <div className="space-y-3 max-h-[65vh] overflow-auto pr-1">
                {items.map((r) => {
                  const statusMeta = STATUS_BADGE(r.status);
                  const reasonText = REASON_LABELS[r.reason] || r.reason || "—";
                  const adminReply = r.admin_reply ?? r.response ?? r.reply ?? r.admin_response ?? r.admin_message ?? "";
                  const handler = r.handled_by_name ?? r.admin_name ?? "";
                  return (
                    <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-slate-600" />
                          <div className="font-medium text-slate-900">#{r.id}</div>
                          <span className="text-slate-400">•</span>
                          <div className="text-sm text-slate-700">Lý do: <span className="font-medium">{reasonText}</span></div>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusMeta.cls}`}>
                          {statusMeta.text}
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="text-xs font-semibold text-slate-600">Chi tiết mô tả</div>
                          <div className="whitespace-pre-wrap text-sm text-slate-800">{r.details || "—"}</div>
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-600">
                            <UserCheck className="h-4 w-4 text-emerald-600" />
                            Phản hồi từ admin
                          </div>
                          <div className="whitespace-pre-wrap text-sm text-slate-800">
                            {adminReply ? adminReply : <span className="text-slate-500">Chưa có phản hồi</span>}
                          </div>
                          <div className="mt-2 text-[11px] text-slate-500">
                            {handler && <>Người xử lý: <span className="font-medium text-slate-700">{handler}</span> • </>}
                            Gửi lúc: <span className="font-medium text-slate-700">{fmtDT(r.created_at)}</span>
                            {r.updated_at && (<> • Cập nhật: <span className="font-medium text-slate-700">{fmtDT(r.updated_at)}</span></>)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
