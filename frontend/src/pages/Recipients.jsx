// src/pages/Recipients.jsx — GPS support, single confirm, robust try/catch + toasts
// Modern UI: vivid colors, clear borders, strong buttons, a11y labels
// Show campaign address from DB; strong error handling & per-card loading

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { apiGet, apiPost } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { HandHeart, Search, AlertTriangle, Soup, MapPin, Compass, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ================= utils ================= */
const cls = (...a) => a.filter(Boolean).join(" ");
const dt = (s) => (s ? new Date(s).toLocaleString("vi-VN") : "—");
const kmFmt = (n) => (n == null || !isFinite(n) ? "—" : n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(1)} km`);
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : s);

const API = {
  me: "/api/recipients/me",
  myBookings: (q = "") => `/api/recipients/me/bookings${q ? `?${q}` : ""}`,
  campaigns: "/api/campaigns?type=meal&status=active",
  createBooking: "/api/recipients/me/bookings",
};

const getMealType = (c) => c?.meta?.meal?.type || c?.meal_type || c?.type || null;
const getMealDesc = (c) => c?.meta?.meal?.desc || c?.desc || c?.description || null;

/** Lấy địa chỉ từ nhiều khả năng khóa trong campaigns */
const getCampaignAddress = (c) =>
  c?.address?.line1 ||
  c?.address_line1 ||
  c?.addr_line1 ||
  c?.addr ||
  c?.address ||
  c?.location ||
  c?.meta?.address ||
  c?.meta?.location ||
  c?.place ||
  null;

const getCampaignCoords = (c) => {
  const lat = c?.lat ?? c?.latitude ?? c?.meta?.lat ?? c?.meta?.latitude ?? c?.geo?.lat ?? null;
  const lng = c?.lng ?? c?.longitude ?? c?.meta?.lng ?? c?.meta?.longitude ?? c?.geo?.lng ?? null;
  return lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null;
};
const haversine = (a, b) => {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s1));
};

/* =============== confirm modal (single-step) =============== */
function useConfirm() {
  const [state, setState] = useState({ open: false, payload: null });
  const resolverRef = useRef(null);

  const ask = useCallback((payload) => {
    setState({ open: true, payload });
    return new Promise((resolve) => { resolverRef.current = resolve; });
  }, []);

  const close = useCallback(() => {
    setState({ open: false, payload: null });
    resolverRef.current?.(false);
  }, []);

  const confirm = useCallback(() => {
    setState({ open: false, payload: null });
    resolverRef.current?.(true);
  }, []);

  const Modal = () => !state.open ? null : (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 grid grid-cols-[1fr_auto]">
        <div className="bg-black/50 backdrop-blur-[1px]" onClick={close} />
        <motion.div
          initial={{ x: 520, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 520, opacity: 0 }}
          transition={{ type: "tween", duration: 0.18 }}
          className="w-[520px] max-w-[96vw] h-full bg-white shadow-2xl border-l-2 border-slate-200"
        >
          <div className="p-5 border-b-2 border-slate-200">
            <div className="text-lg font-extrabold tracking-tight text-slate-900">Xác nhận yêu cầu</div>
            <div className="text-xs text-slate-600">Kiểm tra kỹ thông tin trước khi gửi.</div>
          </div>
          <div className="p-5 space-y-2 text-[15px] text-slate-800">
            <div><span className="font-semibold">Chiến dịch:</span> {state.payload?.campaignTitle}</div>
            <div><span className="font-semibold">Số suất:</span> {state.payload?.qty}</div>
            <div><span className="font-semibold">Địa chỉ giao:</span> {state.payload?.dropoffAddress || "(chưa có)"}</div>
            {state.payload?.distance != null && (
              <div><span className="font-semibold">Khoảng cách ước tính:</span> {kmFmt(state.payload.distance)}</div>
            )}
          </div>
          <div className="px-5 py-4 border-t-2 border-slate-200 flex items-center gap-2">
            <button className="h-10 px-4 rounded-xl border-2 border-red-500 text-red-600 hover:bg-red-50" onClick={close}>Huỷ</button>
            <button className="h-10 px-4 rounded-xl text-white font-semibold shadow-md bg-emerald-600 hover:bg-emerald-700" onClick={confirm}>
              Xác nhận & gửi
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return { ask, Modal };
}

/* =============== Card =============== */
function CampaignCard({ campaign, highlight = false, distance, onRequest, busy }) {
  const [qty, setQty] = useState(1);
  const onInc = () => setQty((n) => Math.min(99, Math.max(1, (Number(n) || 1) + 1)));
  const onDec = () => setQty((n) => Math.max(1, (Number(n) || 1) - 1));

  const title = campaign?.title || campaign?.name || "Chiến dịch";
  const img = campaign?.image || campaign?.cover || "/images/logo.jpg";
  const type = cap(getMealType(campaign) || "meal");
  const desc = getMealDesc(campaign) || "Bữa ăn cho người khó khăn";
  const addr = getCampaignAddress(campaign);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <div
        className={cls(
          "p-5 rounded-2xl border-2 shadow-md bg-white transition-all duration-300",
          "hover:shadow-xl hover:border-emerald-400/80",
          highlight ? "border-emerald-500 ring-2 ring-emerald-400/70" : "border-slate-200"
        )}
      >
        <div className="flex items-start gap-4">
          <img
            src={img}
            alt="ảnh chiến dịch"
            className="h-16 w-16 rounded-xl object-cover border-2 border-slate-300"
            onError={(e) => (e.currentTarget.src = "/images/logo.jpg")}
          />
          <div className="min-w-0 flex-1">
            <div className="text-lg font-extrabold text-slate-900 truncate" title={title}>{title}</div>
            <div className="text-sm text-slate-700 truncate">{desc}</div>

            <div className="mt-2 flex items-center gap-3 text-sm text-slate-800">
              <span className="inline-flex items-center gap-1"><Soup className="h-4 w-4 text-emerald-600" /> {type}</span>
              {distance != null && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-rose-500" /> {kmFmt(distance)}
                </span>
              )}
            </div>

            {addr ? (
              <div className="mt-1 text-sm text-slate-700 truncate inline-flex items-center gap-1" title={String(addr)}>
                <MapPin className="h-4 w-4 text-rose-500" />
                <span className="truncate">{String(addr)}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm text-slate-800 font-medium" htmlFor={`qty-${campaign?.id ?? title}`}>Số suất:</label>
          <div className="flex items-stretch rounded-xl border-2 border-slate-300 overflow-hidden">
            <button className="px-3 text-slate-700 font-bold hover:bg-slate-100" onClick={onDec} aria-label="Giảm" type="button">-</button>
            <input
              id={`qty-${campaign?.id ?? title}`}
              type="number"
              min={1}
              max={99}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              className="h-10 w-16 text-center font-semibold text-slate-900 outline-none"
            />
            <button className="px-3 text-slate-700 font-bold hover:bg-slate-100" onClick={onInc} aria-label="Tăng" type="button">+</button>
          </div>
          <button
            className={cls(
              "ml-auto h-10 px-5 rounded-xl font-semibold text-white shadow-md inline-flex items-center gap-2",
              busy ? "bg-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
            )}
            disabled={busy}
            onClick={() => onRequest(campaign, qty)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandHeart className="h-4 w-4" />}
            {busy ? "Đang gửi..." : "Xin bữa"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* =============== Page =============== */
export default function RecipientsPage() {
  const t = useToast();
  const { ask, Modal: ConfirmModal } = useConfirm();

  const [me, setMe] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  // GPS state
  const [gps, setGps] = useState({ lat: null, lng: null, acc: null });
  const [gpsBusy, setGpsBusy] = useState(false);

  const myDefaultPos = useMemo(() => {
    const a = me?.default_address || me?.address || me?.defaultAddress;
    const lat = a?.lat ?? a?.latitude ?? null;
    const lng = a?.lng ?? a?.longitude ?? null;
    return lat != null && lng != null ? { lat: +lat, lng: +lng } : null;
  }, [me]);

  const myPos = gps?.lat != null ? { lat: gps.lat, lng: gps.lng } : myDefaultPos;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [meRes, campRes, bkRes] = await Promise.allSettled([
        apiGet(API.me),
        apiGet(API.campaigns),
        apiGet(API.myBookings("page=1&page_size=50")),
      ]);
      setMe(meRes.status === "fulfilled" ? meRes.value : {});

      const campsRaw = campRes.status === "fulfilled" ? campRes.value : [];
      const arr = Array.isArray(campsRaw) ? campsRaw : Array.isArray(campsRaw?.items) ? campsRaw.items : [];
      setCampaigns(arr);

      const bkRaw = bkRes.status === "fulfilled" ? bkRes.value : [];
      const bks = Array.isArray(bkRaw?.items) ? bkRaw.items : Array.isArray(bkRaw) ? bkRaw : [];
      setBookings(bks);
    } catch (e) {
      const msg = e?.message || "Không tải được dữ liệu";
      setError(msg);
      t.error(msg);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const askGps = async () => {
    if (!("geolocation" in navigator)) {
      t.error("Trình duyệt không hỗ trợ GPS");
      return;
    }
    setGpsBusy(true);
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 12000, maximumAge: 10000,
        })
      );
      const { latitude, longitude, accuracy } = pos.coords || {};
      if (latitude == null || longitude == null) throw new Error("Không lấy được toạ độ");
      setGps({ lat: +latitude, lng: +longitude, acc: Number.isFinite(+accuracy) ? +accuracy : null });
      t.success("Đã lấy vị trí hiện tại");
    } catch (e) {
      const code = e?.code;
      const msg = code === 1
        ? "Bạn đã từ chối quyền vị trí"
        : code === 2
        ? "Không xác định được vị trí"
        : code === 3
        ? "Lấy vị trí quá thời gian"
        : e?.message || "Không lấy được vị trí";
      t.error(msg);
    } finally { setGpsBusy(false); }
  };

  const filteredCampaigns = useMemo(() => {
    const term = q.trim().toLowerCase();
    let arr = Array.isArray(campaigns) ? campaigns.slice() : [];
    if (myPos) arr = arr.map((c) => ({ ...c, _dist: (getCampaignCoords(c) ? haversine(myPos, getCampaignCoords(c)) : null) }));
    if (term) arr = arr.filter((c) => String(c?.title || c?.name || "").toLowerCase().includes(term));
    arr.sort((a, b) => {
      const da = a._dist ?? Number.POSITIVE_INFINITY, db = b._dist ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db; // nearer first
      return String(a?.title || "").localeCompare(String(b?.title || ""));
    });
    return arr;
  }, [campaigns, q, myPos]);

  const [submittingId, setSubmittingId] = useState(null);

  const mapBackendError = (codeOrMsg) => {
    const s = String(codeOrMsg || "").toUpperCase();
    if (s.includes("PHONE_REQUIRED")) return "Vui lòng cập nhật số điện thoại trước khi gửi yêu cầu.";
    if (s.includes("NO_DEFAULT_ADDRESS")) return "Bạn chưa có địa chỉ nhận mặc định. Hãy thêm địa chỉ.";
    if (s.includes("CAMPAIGN_NOT_ACTIVE")) return "Chiến dịch này chưa hoạt động.";
    if (s.includes("CAMPAIGN_NOT_FOUND")) return "Không tìm thấy chiến dịch.";
    return codeOrMsg || "Không tạo được yêu cầu.";
  };

  async function createBooking(campaign, qty) {
    if (!campaign) return t.error("Thiếu thông tin chiến dịch");
    if (submittingId) return; // chặn double
    try {
      const phone = me?.phone || me?.tel || me?.contact_phone;
      const dropAddr = me?.default_address?.line1 || me?.address?.line1 || me?.address || "";
      if (!phone) return t.error("Cập nhật SĐT trước khi gửi yêu cầu");
      if (!dropAddr) return t.error("Vui lòng thêm địa chỉ nhận mặc định");

      // Một lần xác nhận duy nhất
      const ok = await ask({
        campaignTitle: campaign?.title || campaign?.name || "Chiến dịch",
        qty,
        dropoffAddress: dropAddr,
        distance: myPos && getCampaignCoords(campaign) ? haversine(myPos, getCampaignCoords(campaign)) : null,
      });
      if (!ok) return;

      setSubmittingId(campaign.id);
      const payload = {
        campaign_id: campaign.id,
        qty: Math.max(1, Number(qty) || 1),
        method: "delivery",
        note: `Yêu cầu từ trang người nhận – chiến dịch ${campaign?.title || campaign?.name || ""}`,
        dropoff_address: dropAddr,
        dropoff_lat: myPos?.lat ?? me?.default_address?.lat ?? null,
        dropoff_lng: myPos?.lng ?? me?.default_address?.lng ?? null,
        // tùy chọn gửi kèm phone (backend vẫn lấy từ users.phone)
        dropoff_phone: phone,
      };

      const res = await apiPost(API.createBooking, payload);
      if (res?.id) t.success("Đã tạo yêu cầu thành công");
      else t.info("Đã gửi yêu cầu (đang chờ phản hồi)");
      await fetchAll();
    } catch (e) {
      const msg = mapBackendError(e?.error || e?.message);
      t.error(msg);
    } finally {
      setSubmittingId(null);
    }
  }

  /* =============== UI =============== */
  return (
    <div className="max-w-6xl mx-auto px-6 py-7">
      <ConfirmModal />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Xin bữa • Người nhận</h1>
          <p className="text-slate-700">Chọn chiến dịch gần bạn và gửi yêu cầu với một lần xác nhận.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={cls(
              "h-11 px-4 rounded-xl border-2 bg-white text-slate-900 font-semibold shadow-sm inline-flex items-center gap-2",
              gpsBusy ? "opacity-60 cursor-not-allowed border-slate-300" : "border-slate-300 hover:bg-slate-50"
            )}
            onClick={askGps}
            disabled={gpsBusy}
            title="Bật định vị GPS"
          >
            {gpsBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Compass className="h-5 w-5 text-emerald-600" />}
            {gps?.lat ? "Đã bật GPS" : "Bật GPS"}
          </button>
        </div>
      </div>

      {/* Search + KPIs */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="h-11 w-72 rounded-xl border-2 border-slate-300 bg-white pl-9 pr-3 text-[15px] placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-200"
            placeholder="Tìm chiến dịch…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Tìm chiến dịch"
          />
        </div>
        <div className="text-sm text-slate-700 flex items-center gap-2">
          {myPos ? <span>Đang dùng {gps?.lat ? "GPS" : "địa chỉ mặc định"} •</span> : <span>Chưa có toạ độ •</span>}
          <span>{bookings?.length || 0} yêu cầu gần đây</span>
        </div>
      </div>

      {/* Error state */}
      {error ? (
        <div className="mb-4 p-4 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> {error}
        </div>
      ) : null}

      {/* Campaign list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl border-2 border-slate-200 animate-pulse bg-slate-100" />
          ))
        ) : filteredCampaigns.length ? (
          filteredCampaigns.map((c, idx) => (
            <CampaignCard
              key={c.id ?? idx}
              campaign={c}
              highlight={idx === 0}
              distance={c._dist}
              onRequest={createBooking}
              busy={submittingId === c.id}
            />
          ))
        ) : (
          <div className="col-span-full p-6 rounded-2xl border-2 bg-white text-slate-700 border-slate-200">
            Không có chiến dịch phù hợp. Hãy thử bật GPS hoặc đổi từ khoá tìm kiếm.
          </div>
        )}
      </div>

      {/* Recent bookings */}
      <div className="mt-8">
        <div className="text-base font-semibold mb-2 text-slate-900">Yêu cầu gần đây</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(bookings || []).slice(0, 6).map((b) => (
            <div key={b.id} className="p-4 rounded-xl border-2 border-slate-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">#{String(b?.id ?? "").toString().slice(0, 8)}</div>
                <div className="text-xs text-slate-600">{dt(b?.created_at)}</div>
              </div>
              <div className="mt-1 text-sm text-slate-800 truncate">
                {b?.campaign_title || b?.campaign?.title || "Chiến dịch"}
              </div>
              <div className="text-xs text-slate-700">Số suất: {b?.qty || 1} • Trạng thái: {cap(b?.status || "pending")}</div>
            </div>
          ))}
          {(!bookings || bookings.length === 0) && !loading ? (
            <div className="col-span-full p-4 rounded-xl border-2 border-slate-200 bg-white text-slate-700">Chưa có yêu cầu nào.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
