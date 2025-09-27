// ================================================
// src/shipper/Shippers.jsx — Shipper Hub (Grab-like)
// - 1 cột tập trung vào danh sách; bản đồ mở dạng overlay khi cần
// - Header dính, zebra rows, hành động rõ ràng
// - Quy trình POD (ảnh + người nhận + ghi chú) trước khi Delivered
// - Auto refresh 5s khi "Đang hoạt động"
// - Donation-aware: nếu là đơn quyên góp -> cộng số suất vào chiến dịch khi Delivered
// ================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { useToast } from "../components/ui/Toast";
import RouteMap from "../components/map/RouteMap";
import {
  RefreshCcw, Bike, CheckCircle2, XCircle, ClipboardList, Copy,
  MapPin, Navigation, Clock3, Camera, Upload, User, StickyNote,
  ShieldCheck, AlertTriangle
} from "lucide-react";

/* ---------------- Endpoints ---------------- */
const LIST_URL = (status, q) => {
  const sp = new URLSearchParams();
  sp.set("status", status || "active");
  if (q?.trim()) sp.set("q", q.trim());
  return `/api/shipper/deliveries?${sp.toString()}`;
};
const PATCH_URL = (id) => `/api/shipper/deliveries/${id}`;
const POD_URL = (id) => `/api/shipper/deliveries/${id}/proof`;

/* ---------------- Donation helpers ---------------- */
// BE nên trả về 1 trong các flag để nhận biết donation:
//   kind: 'donation' | 'request' (khuyến nghị)
//   hoặc type: 'donation'
//   hoặc is_donation: true
//   hoặc source: 'donor'
const isDonation = (d) =>
  !!d && (
    d.kind === "donation" ||
    d.type === "donation" ||
    d.is_donation === true ||
    d.source === "donor"
  );

// Số suất bữa quy đổi để cộng vào chiến dịch
const getMealQty = (d) => {
  const n = Number(d?.qty ?? d?.booking_qty ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Endpoint cộng suất vào chiến dịch (tuỳ BE implement)
const INC_CAMPAIGN_MEALS_URL = (campaignId) =>
  `/api/campaigns/${campaignId}/meals/increment`;

/* ---------------- Small UI ---------------- */
const Pill = ({ tone = "slate", children }) => {
  const map = {
    amber: "bg-amber-50 text-amber-800 ring-amber-300",
    sky: "bg-sky-50 text-sky-800 ring-sky-300",
    violet: "bg-violet-50 text-violet-800 ring-violet-300",
    emerald: "bg-emerald-50 text-emerald-800 ring-emerald-300",
    rose: "bg-rose-50 text-rose-800 ring-rose-300",
    slate: "bg-slate-50 text-slate-800 ring-slate-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${map[tone]}`}>
      {children}
    </span>
  );
};
const StatusPill = ({ value }) => {
  const tone =
    value === "assigned" ? "sky" :
    value === "picking"  ? "violet" :
    value === "delivered"? "emerald" :
    value === "cancelled"? "rose" : "slate";
  return <Pill tone={tone}>{value}</Pill>;
};

/* ---------------- Map Overlay (Grab-like) ---------------- */
function MapOverlay({ open, onClose, delivery }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="absolute bottom-0 left-0 right-0 h-[82vh] bg-white rounded-t-3xl shadow-2xl overflow-hidden border-t-2"
      >
        <div className="p-3 border-b-2 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <div className="font-bold text-slate-900">Bản đồ & chỉ đường</div>
          <div className="ml-auto text-xs text-slate-900 flex items-center gap-2">
            <Navigation className="h-3.5 w-3.5" /> Dùng vị trí hiện tại để tính ETA
          </div>
          <Button variant="secondary" className="ml-3" onClick={onClose}>Đóng</Button>
        </div>

        {/* Gợi ý khi thiếu API key */}
        <div className="px-3 pt-3">
          {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? null : (
            <div className="mb-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div>
                <b>Thiếu Google Maps API key.</b> Thêm <code>VITE_GOOGLE_MAPS_API_KEY</code> vào <code>.env</code> và bật Billing + Maps JavaScript API.
              </div>
            </div>
          )}
        </div>

        <div className="h-[calc(82vh-90px)] w-full">
          <RouteMap selected={delivery} />
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------- POD Drawer ---------------- */
function ProofDrawer({ open, onClose, onSubmit, delivery }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [receiver, setReceiver] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setFile(null); setPreview(""); setReceiver(""); setNote(""); setBusy(false); }
  }, [open]);

  function onPick(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setFile(f); setPreview(URL.createObjectURL(f));
  }
  async function submit() {
    if (!receiver.trim()) return;
    setBusy(true);
    try { await onSubmit({ file, receiver: receiver.trim(), note }); }
    finally { setBusy(false); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid grid-cols-[1fr_auto]">
      <div className="bg-black/40" onClick={busy ? undefined : onClose} />
      <motion.div
        initial={{ x: 480 }} animate={{ x: 0 }} exit={{ x: 480 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="w-[420px] h-full bg-white shadow-2xl border-l-2 border-slate-200 flex flex-col"
      >
        <div className="p-4 border-b-2">
          <div className="text-lg font-bold text-slate-900">Xác nhận giao hàng</div>
          <div className="text-xs text-slate-700">Đơn <span className="font-mono">{delivery?.id}</span></div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="text-sm text-slate-900">
            Chụp/đính ảnh bàn giao và nhập tên người nhận trước khi hoàn tất.
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-900">Ảnh bàn giao</div>
            {preview ? (
              <img alt="proof" src={preview} className="w-full aspect-video object-cover rounded-xl border-2" />
            ) : (
              <div className="w-full aspect-video rounded-xl border-2 border-dashed grid place-items-center text-slate-700">
                <div className="flex items-center gap-2 text-sm"><Camera className="h-4 w-4" /> Chưa có ảnh</div>
              </div>
            )}
            <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border-2 bg-red-500 hover:bg-red-400 cursor-pointer w-fit">
              <Upload className="h-4 w-4" /> {preview ? "Chọn lại ảnh" : "Chọn ảnh / Chụp ảnh"}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
            </label>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">Tên người nhận</div>
            <div className="flex gap-2">
              <span className="inline-flex items-center justify-center h-11 w-11 rounded-xl border-2 bg-slate-50"><User className="h-5 w-5 text-slate-700" /></span>
              <input
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                placeholder="VD: Anh Tùng (bảo vệ cổng 3)"
                className="flex-1 h-11 rounded-xl border-2 border-slate-300 px-3 outline-none focus:border-emerald-600 text-slate-900 placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">Ghi chú (tuỳ chọn)</div>
            <div className="flex gap-2">
              <span className="inline-flex items-center justify-center h-11 w-11 rounded-xl border-2 bg-slate-50"><StickyNote className="h-5 w-5 text-slate-700" /></span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: để tại lễ tân theo yêu cầu."
                className="flex-1 rounded-xl border-2 border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 text-slate-900 placeholder:text-slate-600"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t-2 flex items-center gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Đóng</Button>
          <Button onClick={submit} disabled={busy || !receiver.trim()}>
            <ShieldCheck className="h-4 w-4 mr-1" /> {busy ? "Đang gửi..." : "Xác nhận giao xong"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------- Main ---------------- */
export default function Shippers() {
  const t = useToast();
  const [status, setStatus] = useState("active");
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);
  const [selected, setSelected] = useState(null);
  const [podOpen, setPodOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    return sp.toString();
  }, [status, q]);

  async function load() {
    setLoading(true);
    try {
      const res = await apiGet(LIST_URL(status, q));
      const list = Array.isArray(res?.items) ? res.items : [];
      setItems(list);
      if (selected) {
        const fresh = list.find((d) => d.id === selected.id);
        setSelected(fresh || list[0] || null);
      } else setSelected(list[0] || null);
    } catch {
      t.error("Không tải được danh sách đơn");
      setItems([]); setSelected(null);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [query]);

  const timerRef = useRef(null);
  useEffect(() => {
    if (!auto || status !== "active") return;
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(load, 5000);
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [auto, status, query]);

  // Ghi nhận đóng góp vào chiến dịch (chỉ khi là đơn quyên góp)
  async function recordDonationToCampaign(d) {
    try {
      if (!isDonation(d)) return;
      const cid = d.campaign_id || d.campaignId;
      const qty = getMealQty(d);
      if (!cid || !qty) return;
      await apiPost(INC_CAMPAIGN_MEALS_URL(cid), {
        delta: qty,
        reason: "donation_delivery",
        delivery_id: d.id
      });
      t.success(`Đã cộng ${qty} suất vào chiến dịch.`);
    } catch {
      // Không chặn luồng shipper
      t.info("Không cộng được suất vào chiến dịch (BE chưa bật hoặc lỗi).");
    }
  }

  async function updateStatus(id, next) {
    try {
      await apiPatch(PATCH_URL(id), { status: next });
      t.success(`Đã cập nhật: ${next}`);
      // nếu sang delivered -> cộng suất (nếu là quyên góp)
      if (next === "delivered") {
        const d = items.find((x) => x.id === id) || selected;
        if (d) await recordDonationToCampaign(d);
      }
      await load();
    } catch (e) {
      const m = String(e?.message||"");
      t.error(m.includes("invalid_transition") ? "Chuyển trạng thái không hợp lệ." : (e.message||"Không cập nhật được"));
      await load();
    }
  }
  async function cancelDelivery(id) {
    try { await apiPatch(PATCH_URL(id), { status: "cancelled" }); t.info("Đã huỷ đơn"); await load(); }
    catch (e) { t.error(e.message || "Không huỷ được"); }
  }
  function copy(text, label="Đã sao chép") { navigator.clipboard?.writeText(String(text||""))?.then(()=>t.success(label)); }

  async function submitPod({ file, receiver, note }) {
    const d = selected; if (!d) return;
    if (file) {
      try {
        const fd = new FormData();
        fd.append("file", file); fd.append("receiver", receiver); fd.append("note", note||"");
        await apiPost(POD_URL(d.id), fd, { headers: { "Content-Type": "multipart/form-data" } });
        t.success("Đã tải ảnh bàn giao");
      } catch {
        t.info("BE chưa hỗ trợ upload ảnh. Vẫn xác nhận giao xong.");
      }
    }
    // 1) chuyển trạng thái sang delivered
    await updateStatus(d.id, "delivered");
    // 2) cộng suất cho chiến dịch nếu là đơn quyên góp
    await recordDonationToCampaign(d);
    setPodOpen(false);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <Card className="p-4 border-2">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-slate-900">Trạng thái</label>
          <select className="input font-semibold text-slate-900 border-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Đang hoạt động</option>
            <option value="assigned">Đã gán</option>
            <option value="picking">Đang lấy</option>
            <option value="delivered">Hoàn tất</option>
            <option value="cancelled">Huỷ</option>
            <option value="all">Tất cả</option>
          </select>

          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔎</span>
            <input
              className="input w-72 pl-8 border-2 text-slate-900 placeholder:text-slate-600"
              placeholder="Tìm ID / địa chỉ…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 select-none">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              Tự làm mới 5s (khi đang hoạt động)
            </label>
            <Button onClick={load}><RefreshCcw className="h-4 w-4 mr-1" /> Làm mới</Button>
          </div>
        </div>
      </Card>

      {/* List */}
      <Card className="p-0 border-2 overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-700">Đang tải…</div>
        ) : !items.length ? (
          <Empty title="Không có đơn" subtitle="Không có đơn ở trạng thái đã chọn." />
        ) : (
          <table className="w-full text-[13px] text-slate-900">
            <thead className="sticky top-0 bg-white border-b-2">
              <tr className="[&>th]:px-3 [&>th]:py-2 text-left font-bold">
                <th>ID</th><th>Pickup → Dropoff</th><th>Người nhận</th><th>Điện thoại</th><th>Trạng thái</th><th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d, idx) => {
                const done = new Set(["delivered", "cancelled"]).has(d.status);
                const isActive = selected?.id === d.id;
                return (
                  <tr key={d.id}
                    className={`border-t ${idx%2?"bg-slate-50/40":"bg-white"} ${isActive?"outline outline-2 outline-emerald-300":""}`}>
                    <td className="px-3 py-2 font-mono text-xs">
                      <button className="underline decoration-dotted" onClick={() => setSelected(d)} title="Xem chi tiết">{d.id}</button>
                      <Button variant="ghost" className="ml-1 px-1 py-0 h-6" title="Sao chép ID" onClick={() => copy(d.id)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                    <td className="px-3 py-2 truncate max-w-[420px]">
                      {d.pickup_name || d.pickup_address || "—"} <span className="mx-1 text-slate-500">→</span>
                      {d.dropoff_name || d.dropoff_address || "—"}
                    </td>
                    <td className="px-3 py-2">{d.dropoff_name || "—"}</td>
                    <td className="px-3 py-2">
                      {d.dropoff_phone || "—"}
                      {d.dropoff_phone && (
                        <Button variant="ghost" className="ml-1 px-1 py-0 h-6" title="Sao chép SĐT" onClick={() => copy(d.dropoff_phone, "Đã sao chép SĐT")}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                    <td className="px-3 py-2"><StatusPill value={d.status} /></td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="secondary" title="Chi tiết" onClick={() => setSelected(d)}>
                          <ClipboardList className="h-4 w-4 mr-1" /> Chi tiết
                        </Button>
                        {/* Xem bản đồ khi cần */}
                        <Button variant="secondary" title="Xem bản đồ" onClick={() => { setSelected(d); setMapOpen(true); }}>
                          <MapPin className="h-4 w-4 mr-1" /> Xem bản đồ
                        </Button>
                        <Button disabled={done || d.status !== "assigned"} onClick={() => updateStatus(d.id, "picking")} title="Bắt đầu lấy hàng">
                          <Bike className="h-4 w-4 mr-1" /> Bắt đầu lấy
                        </Button>
                        <Button disabled={done || d.status !== "picking"} onClick={() => { setSelected(d); setPodOpen(true); }} title="Xác nhận giao (POD)">
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Xác nhận giao
                        </Button>
                        <Button variant="danger" disabled={done} onClick={() => cancelDelivery(d.id)} title="Huỷ đơn">
                          <XCircle className="h-4 w-4 mr-1" /> Huỷ
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Selected summary row under the list */}
      <Card className="p-4 border-2">
        {selected ? (
          <div className="text-sm space-y-1 text-slate-900">
            <div><span className="text-slate-700">Đơn: </span><span className="font-mono">{selected.id}</span></div>
            <div className="truncate"><span className="text-slate-700">Pickup: </span>{selected.pickup_name || selected.pickup_address || "—"}</div>
            <div className="truncate"><span className="text-slate-700">Dropoff: </span>{selected.dropoff_name || selected.dropoff_address || "—"}</div>
            <div className="truncate"><span className="text-slate-700">Ghi chú: </span>{selected.note || "—"}</div>
            <div className="pt-2">
              <Button variant="secondary" onClick={() => setMapOpen(true)}>
                <MapPin className="h-4 w-4 mr-1" /> Xem bản đồ
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-700">Chọn một đơn để xem chi tiết hoặc mở bản đồ.</div>
        )}
      </Card>

      <Card className="p-3 text-xs text-slate-900 border-2">
        <Clock3 className="inline h-3.5 w-3.5 mr-1" />
        Tự làm mới mỗi 5 giây khi ở “Đang hoạt động”. Quy trình: <b>assigned → picking → (POD) → delivered</b>.
      </Card>

      {/* POD Drawer */}
      <AnimatePresence>
        {podOpen && (
          <ProofDrawer
            open={podOpen}
            onClose={() => setPodOpen(false)}
            onSubmit={submitPod}
            delivery={selected}
          />
        )}
      </AnimatePresence>

      {/* Map Overlay */}
      <AnimatePresence>
        {mapOpen && (
          <MapOverlay
            open={mapOpen}
            onClose={() => setMapOpen(false)}
            delivery={selected}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
