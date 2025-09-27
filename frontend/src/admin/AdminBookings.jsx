// frontend/src/pages/AdminBookings.jsx
// Trang quản trị Bookings: list/search, duyệt, tạo Delivery & gán shipper
// Workflow: booking.pending → (delivery.create + assign shipper) → booking.accepted/ completed
// UI: sticky header, hover tinh tế, sheet mượt, chống lỗi API đa nguồn

import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import {
  Truck, XCircle, CheckCircle2, Clock4, UserRound, Soup,
  Home, LocateFixed, ExternalLink, RefreshCcw, Search
} from "lucide-react";

/* ========== helpers ========== */
const cx = (...a) => a.filter(Boolean).join(" ");

const Pill = ({ tone = "slate", children }) => {
  const map = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
  };
  return (
    <span className={cx(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
      map[tone]
    )}>
      {children}
    </span>
  );
};

const StatusBadge = ({ s }) => {
  const tone =
    s === "pending" ? "amber" :
    s === "accepted" ? "emerald" :
    s === "completed" ? "sky" :
    ["cancelled","rejected","expired"].includes(s) ? "rose" : "slate";
  return <Pill tone={tone}>{s}</Pill>;
};

const RowSkeleton = () => (
  <tr className="border-t animate-pulse">
    {Array.from({ length: 7 }).map((_, i) => (
      <td key={i} className="px-3 py-3">
        <div className="h-3 w-[70%] rounded bg-slate-200/60" />
      </td>
    ))}
  </tr>
);

/* ========== Sheet: Approve + Assign (create Delivery) ========== */
function ApproveAssignSheet({ open, onClose, booking, reload }) {
  const t = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const openedOnce = useRef(false);

  const [shippers, setShippers] = useState([]);
  const [pickupPoints, setPickupPoints] = useState([]);
  const [pickupAddresses, setPickupAddresses] = useState([]);
  const [recipientAddrs, setRecipientAddrs] = useState([]);

  const [form, setForm] = useState({
    shipperId: "",
    qty: 1,
    note: "",
    pickupMode: "point",      // "point" | "address"
    pickupPointId: "",
    pickupAddrId: "",
    useCustomDrop: false,
    dropId: "",
    dropText: "",
  });

  const onChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  useEffect(() => {
    if (!open || !booking?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // 1) Shippers + pickup points
        const [S, P] = await Promise.all([
          apiGet("/api/admin/shippers").catch(() => ({ items: [] })),
          apiGet("/api/admin/pickup-points").catch(() => ({ items: [] })),
        ]);
        const shipList = Array.isArray(S?.items) ? S.items : Array.isArray(S) ? S : [];
        const points = (Array.isArray(P?.items) ? P.items : Array.isArray(P) ? P : []).map(p => ({
          ...p,
          address_line: p.address_line ?? p.address ?? "",
        }));

        // 2) Booking detail for recipient IDs / qty / note
        let B = booking;
        try {
          const full = await apiGet(`/api/admin/bookings/${booking.id}`);
          if (full && typeof full === "object") B = { ...booking, ...full };
        } catch {}

        // 3) Kitchen addresses (optional)
        let kitchenAddrs = [];
        try {
          const K = await apiGet("/api/admin/kitchen-addresses").catch(() => null);
          const arr = Array.isArray(K?.items) ? K.items : Array.isArray(K) ? K : [];
          kitchenAddrs = arr.map(p => ({
            id: p.id,
            label: `${p.label || p.name || "Điểm lấy"} • ${p.address || p.address_line || ""}`,
            raw: p,
          }));
        } catch {}

        // 4) Recipient addresses
        let addrList = [];
        try {
          const rid = B?.receiver_id || B?.recipient_id;
          if (rid) {
            const RA = await apiGet(`/api/admin/recipients/${rid}/addresses`).catch(() =>
              apiGet(`/api/recipients/${rid}/addresses`)
            );
            const arr = Array.isArray(RA?.items) ? RA.items : Array.isArray(RA) ? RA : [];
            addrList = arr.map((a) => ({
              id: a.id,
              label: `${a.label ? a.label + " • " : ""}${a.address || a.address_line || a.line1 || ""}`,
              raw: a,
            }));
          }
        } catch {}

        // include booking.dropoff_address if present
        if (B?.dropoff_address && !addrList.find(a => a.label?.includes(B.dropoff_address))) {
          addrList.unshift({
            id: "booking",
            label: B.dropoff_address,
            raw: { address_line: B.dropoff_address }
          });
        }

        if (cancelled) return;
        setShippers(shipList);
        setPickupPoints(points);
        setPickupAddresses(kitchenAddrs);
        setRecipientAddrs(addrList);

        setForm((f) => ({
          ...f,
          pickupMode: points.length ? "point" : (kitchenAddrs.length ? "address" : "point"),
          pickupPointId: points[0]?.id || "",
          pickupAddrId: kitchenAddrs[0]?.id || "",
          qty: B?.qty || 1,
          note: B?.note ? `Từ booking #${B.id}: ${B.note}` : `Từ booking #${B.id}`,
          dropId: addrList[0]?.id || "",
          dropText: addrList[0]?.label || "",
        }));
      } catch (err) {
        console.error(err);
        if (!openedOnce.current) t.error("Không tải được dữ liệu gợi ý");
      } finally {
        openedOnce.current = true;
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, booking?.id]);

  async function submit() {
    if (creating) return;

    // Validate
    if (form.pickupMode === "point" && !form.pickupPointId && !pickupPoints.length)
      return t.error("Chọn điểm lấy (pickup)");
    if (form.pickupMode === "address" && !form.pickupAddrId && !pickupAddresses.length)
      return t.error("Chọn điểm lấy (pickup)");
    if (!form.useCustomDrop && !form.dropId)
      return t.error("Chọn địa chỉ giao (dropoff)");
    if (form.useCustomDrop && !form.dropText.trim())
      return t.error("Nhập địa chỉ giao");

    const dropLabel = form.useCustomDrop
      ? form.dropText
      : (recipientAddrs.find(a => String(a.id) === String(form.dropId))?.label || "");

    // payload theo deliveries router (BE map sang cột tương ứng)
    const payload = {
      bookingId: booking.id,
      shipperId: form.shipperId || null,
      qty: Math.max(1, Number(form.qty) || 1),
      note: form.note || null,

      pickupPointId: form.pickupMode === "point" ? (form.pickupPointId || null) : null,
      pickupAddrId: form.pickupMode === "address"
        ? (isNaN(Number(form.pickupAddrId)) ? String(form.pickupAddrId) : Number(form.pickupAddrId))
        : null,

      dropoffAddrId: form.useCustomDrop
        ? null
        : (isNaN(Number(form.dropId)) ? String(form.dropId) : Number(form.dropId)),
      dropoffAddrText: form.useCustomDrop ? form.dropText : dropLabel,
    };

    try {
      setCreating(true);
      await apiPost("/api/admin/deliveries", payload);
      t.success("Đã tạo delivery & gán shipper (nếu có)");
      // chuyển booking sang accepted (nếu BE chưa làm tự động)
      try { await apiPatch(`/api/admin/bookings/${booking.id}`, { status: "accepted" }); } catch {}
      onClose();
      reload();
    } catch (e) {
      const msg = String(e?.message || e).toLowerCase();
      if (msg.includes("delivery") || msg.includes("not deliverable"))
        t.error("Booking không phải hình thức giao tận nơi");
      else if (msg.includes("not found"))
        t.error("Không tìm thấy booking/địa chỉ");
      else t.error(e.message || "Lỗi tạo delivery");
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 animate-[fadeIn_.15s_ease]">
      <div className="w-full max-w-xl rounded-t-3xl bg-white shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b">
          <h3 className="text-xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-emerald-600 via-sky-600 to-violet-600 bg-clip-text text-transparent">
              Duyệt & gán shipper
            </span>{" "}
            <span className="text-slate-500">#{String(booking?.id).slice(0,8)}</span>
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <XCircle />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Info row */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border p-3">
              <div className="text-xs text-slate-600">Người nhận</div>
              <div className="mt-1 font-semibold flex items-center gap-2">
                <UserRound className="h-4 w-4"/>
                {booking?.receiver_name || booking?.receiver_id || booking?.recipient_id}
              </div>
            </div>
            <div className="rounded-2xl border p-3">
              <div className="text-xs text-slate-600">Hình thức</div>
              <div className="mt-1 font-semibold flex items-center gap-2">
                <Soup className="h-4 w-4"/>
                {booking?.method === "delivery" ? "Giao tận nơi" : booking?.method}
              </div>
            </div>
          </div>

          {/* Form grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">
              Chọn shipper
              <select
                name="shipperId"
                value={form.shipperId}
                onChange={onChange}
                className="mt-1 w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-emerald-300"
              >
                <option value="">— Chưa gán —</option>
                {shippers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name || u.email || "Shipper")} {u.phone ? `• ${u.phone}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Số suất giao
              <input
                type="number"
                min="1"
                name="qty"
                value={form.qty}
                onChange={onChange}
                className="mt-1 w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-emerald-300"
              />
            </label>

            {/* Pickup */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Điểm lấy (pickup)</div>
              {pickupPoints.length > 0 && (
                <label className="inline-flex items-center gap-2 text-sm select-none">
                  <input
                    type="radio"
                    name="pickupMode"
                    value="point"
                    checked={form.pickupMode === "point"}
                    onChange={onChange}
                  /> Dùng điểm hệ thống
                </label>
              )}
              {pickupAddresses.length > 0 && (
                <label className="inline-flex items-center gap-2 text-sm select-none">
                  <input
                    type="radio"
                    name="pickupMode"
                    value="address"
                    checked={form.pickupMode === "address"}
                    onChange={onChange}
                  /> Dùng địa chỉ (addresses)
                </label>
              )}
              {form.pickupMode === "point" && (
                <label className="block">
                  <select
                    name="pickupPointId"
                    value={form.pickupPointId}
                    onChange={onChange}
                    className="w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-emerald-300"
                  >
                    <option value="">— Chọn —</option>
                    {pickupPoints.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} • {p.address_line}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                    <LocateFixed className="w-3.5 h-3.5"/>Nguồn: pickup_points
                  </div>
                </label>
              )}
              {form.pickupMode === "address" && (
                <label className="block">
                  <select
                    name="pickupAddrId"
                    value={form.pickupAddrId}
                    onChange={onChange}
                    className="w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-emerald-300"
                  >
                    <option value="">— Chọn —</option>
                    {pickupAddresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                    <LocateFixed className="w-3.5 h-3.5"/>Nguồn: addresses (kitchen)
                  </div>
                </label>
              )}
            </div>

            {/* Dropoff */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Điểm giao (dropoff)</div>
              {!form.useCustomDrop && (
                <label className="block">
                  <select
                    name="dropId"
                    value={form.dropId}
                    onChange={onChange}
                    className="w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-emerald-300"
                  >
                    <option value="">— Chọn —</option>
                    {recipientAddrs.map((a) => (
                      <option key={String(a.id)} value={String(a.id)}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                    <Home className="w-3.5 h-3.5"/>Nguồn: địa chỉ người nhận
                  </div>
                </label>
              )}
              {form.useCustomDrop && (
                <label className="block">
                  <input
                    name="dropText"
                    value={form.dropText}
                    onChange={onChange}
                    placeholder="Nhập địa chỉ giao…"
                    className="w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-emerald-300"
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    Có thể dán địa chỉ tự do (số nhà, đường, phường…)
                  </div>
                </label>
              )}
              <label className="inline-flex items-center gap-2 text-sm select-none">
                <input
                  type="checkbox"
                  name="useCustomDrop"
                  checked={form.useCustomDrop}
                  onChange={onChange}
                /> Nhập địa chỉ giao khác
              </label>
            </div>

            <label className="md:col-span-2 text-sm font-medium">
              Ghi chú
              <textarea
                name="note"
                rows={2}
                value={form.note}
                onChange={onChange}
                className="mt-1 w-full rounded-xl border px-3 py-2 focus:ring-2 focus:ring-emerald-300"
                placeholder="Thông tin thêm cho chuyến giao…"
              />
            </label>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <Clock4 size={14} /> Tạo xong có thể theo dõi ở Deliveries.
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={submit}
                disabled={loading || creating}
                className="bg-emerald-600 text-white hover:translate-y-[-1px]"
              >
                <Truck className="mr-1" size={16}/>
                {creating ? "Đang tạo…" : "Duyệt & gán shipper"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================= Trang chính ============================= */
export default function AdminBookings() {
  const t = useToast();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState({ open: false, booking: null });

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || 20))),
    [data.total, data.pageSize]
  );

  // debounce search
  const debounceRef = useRef(null);
  function triggerLoadSoon() {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(), 300);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await apiGet(
        `/api/admin/bookings?status=${status}&q=${encodeURIComponent(q)}&page=${page}&page_size=${data.pageSize || 20}`
      );
      const normalized = Array.isArray(res)
        ? { items: res, total: res.length, page, pageSize: data.pageSize || 20 }
        : (res || { items: [], total: 0, page, pageSize: 20 });
      setData(normalized);
    } catch (e) {
      console.error(e);
      t.error("Không tải được danh sách booking");
      setData({ items: [], total: 0, page, pageSize: 20 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, [status, page]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/>
          <input
            className="input w-[320px] pl-9 focus:ring-2 focus:ring-emerald-300"
            placeholder="Tìm nhanh (ID, ghi chú)…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); triggerLoadSoon(); }}
            onKeyDown={(e) => e.key === "Enter" && (setPage(1), load())}
          />
        </div>
        <select
          className="input focus:ring-2 focus:ring-emerald-300"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">Tất cả</option>
          <option value="pending">Chờ duyệt</option>
          <option value="accepted">Đã duyệt</option>
          <option value="completed">Hoàn tất</option>
          <option value="cancelled">Đã huỷ</option>
        </select>
        <Button onClick={() => { setPage(1); load(); }} className="shadow-sm hover:shadow-md">
          <RefreshCcw className="h-4 w-4 mr-1" /> Làm mới
        </Button>
      </div>

      {/* List */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b text-slate-800">
              <tr className="text-left">
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">Người nhận</th>
                <th className="px-3 py-3">Số suất</th>
                <th className="px-3 py-3">Hình thức</th>
                <th className="px-3 py-3">Tạo lúc</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3 w-[380px]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => <RowSkeleton key={i} />)}
              {!loading && (data.items || [])
                .map((b) => (
                  <tr key={b.id} className="border-t hover:bg-emerald-50/40 transition-colors">
                    <td className="px-3 py-3 font-mono text-xs">{b.id}</td>
                    <td className="px-3 py-3">{b.receiver_name || b.receiver_id || b.recipient_id || "-"}</td>
                    <td className="px-3 py-3">{b.qty}</td>
                    <td className="px-3 py-3">{b.method === "delivery" ? "Giao tận nơi" : b.method}</td>
                    <td className="px-3 py-3">{b.created_at ? new Date(b.created_at).toLocaleString() : "-"}</td>
                    <td className="px-3 py-3"><StatusBadge s={b.status} /></td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {b.status === "pending" && b.method === "delivery" && (
                          <Button
                            className="bg-emerald-600 text-white hover:translate-y-[-1px]"
                            onClick={() => setSheet({ open: true, booking: b })}
                          >
                            <Truck className="mr-1" size={16}/> Duyệt & gán shipper
                          </Button>
                        )}
                        {b.status === "pending" && b.method !== "delivery" && (
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              await apiPatch(`/api/admin/bookings/${b.id}`, { status: "accepted" });
                              t.success("Đã duyệt");
                              load();
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Duyệt
                          </Button>
                        )}
                        {b.status === "accepted" && b.method !== "delivery" && (
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              await apiPatch(`/api/admin/bookings/${b.id}`, { status: "completed" });
                              t.success("Hoàn tất");
                              load();
                            }}
                          >
                            Hoàn tất
                          </Button>
                        )}
                        {b.status === "pending" && (
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              await apiPatch(`/api/admin/bookings/${b.id}`, { status: "cancelled" });
                              t.info("Đã huỷ");
                              load();
                            }}
                          >
                            Huỷ
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && !data.items?.length && (
                <tr><td colSpan={7} className="py-10"><Empty title="Không có booking" /></td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
          <div className="text-sm text-slate-600">
            Tổng: <b>{data.total}</b> • Trang <b>{page}</b>/<b>{totalPages}</b>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Trước</Button>
            <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Sau</Button>
          </div>
        </div>
      </Card>

      {/* Sheet */}
      <ApproveAssignSheet
        open={sheet.open}
        onClose={() => setSheet({ open: false, booking: null })}
        booking={sheet.booking}
        reload={load}
      />
    </div>
  );
}
