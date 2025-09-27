// src/pages/Donors.jsx — Donor Hub: Ủng hộ nhanh + Gọi shipper tới lấy
// - UI/UX sáng, rõ, tương phản tốt; layout 1 cột dễ quét
// - GPS: bật 1 chạm, gợi ý điểm nhận gần nhất (Haversine)
// - Form pickup: nhãn rõ, kiểm tra đầu vào, gợi ý nhanh (chips), hiển thị địa chỉ & nguồn (GPS/Địa chỉ mặc định/nhập tay)
// - Skeletons, empty states, lỗi GPS chi tiết, AbortController
// - Không cần xác nhận hai bước ở trang này

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import {
  HandHeart, Truck, MapPin, Compass, ChevronRight,
  AlertTriangle, Bike, Loader2, Navigation, CheckCircle2
} from "lucide-react";
import { motion } from "framer-motion";

/* ================= helpers ================= */
const VND_FMT = new Intl.NumberFormat("vi-VN");
const VND = (n) => (Number.isFinite(+n) ? VND_FMT.format(+n) : "0") + "đ";
const cls = (...a) => a.filter(Boolean).join(" ");
const safeDate = (v) => { try { return new Date(v).toLocaleString("vi-VN"); } catch { return "—"; } };
const kmFmt = (n) => (Number.isFinite(n) ? (n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(1)} km`) : "—");
const toNum = (v) => (v == null || v === "" ? null : Number(v));
const isNonEmpty = (s) => typeof s === "string" && s.trim().length > 0;

/* ================= UI primitives ================= */
const Card = ({ className = "", children }) => (
  <div className={cls("rounded-2xl border-2 border-slate-200 bg-white shadow-sm",
    "transition-all duration-300 hover:shadow-lg", className)}>
    {children}
  </div>
);
const Stat = ({ label, value, hint }) => (
  <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
    <div className="text-sm font-semibold text-slate-700">{label}</div>
    <div className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{value}</div>
    {hint ? <div className="text-xs text-slate-600 mt-1">{hint}</div> : null}
  </div>
);
const Skeleton = ({ className = "" }) => (
  <div className={cls("animate-pulse rounded-xl bg-slate-200/80", className)} />
);
const Field = ({ label, hint, children }) => (
  <label className="block">
    <div className="text-sm font-semibold text-slate-800">{label}</div>
    <div className="mt-1">{children}</div>
    {hint ? <div className="text-xs text-slate-600 mt-1">{hint}</div> : null}
  </label>
);
const Chip = ({ children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="h-8 px-3 rounded-full border-2 border-slate-400 text-slate-900 hover:border-emerald-600 hover:text-emerald-700 active:scale-[.98] transition"
  >
    {children}
  </button>
);

/* ================= page ================= */
export default function DonorsPage() {
  const t = useToast();
  const nav = useNavigate();

  const [me, setMe] = useState(null);
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [pups, setPups] = useState([]);

  const [loading, setLoading] = useState(true);
  const [gps, setGps] = useState({ lat: null, lng: null, acc: null });
  const [gpsBusy, setGpsBusy] = useState(false);

  // state cho request pickup
  const [pickupForm, setPickupForm] = useState({ name: "", qty: 1, note: "", address: "" });
  const [pickupBusy, setPickupBusy] = useState(false);

  /* ===== tải dữ liệu đầu trang ===== */
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const [meRes, statsRes, recentRes, pupsRes] = await Promise.allSettled([
          apiGet("/api/donor/me", { signal: ac.signal }),
          apiGet("/api/donor/stats", { signal: ac.signal }),
          apiGet("/api/donor/recent-donations?limit=5", { signal: ac.signal }),
          apiGet("/api/pickup-points/mine", { signal: ac.signal }),
        ]);
        if (ac.signal.aborted) return;

        setMe(meRes.status === "fulfilled" ? (meRes.value || {}) : {});
        setStats(statsRes.status === "fulfilled" ? (statsRes.value || null) : null);
        setRecent(recentRes.status === "fulfilled" ? (recentRes.value || []) : []);
        setPups(pupsRes.status === "fulfilled" ? (pupsRes.value || []) : []);
      } catch (e) {
        t.error(e?.message || "Không tải được dữ liệu");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [t]);

  /* ===== vị trí của tôi (mặc định từ BE hoặc users.address) ===== */
  const myDefaultPos = useMemo(() => {
    const a = me?.default_address || me?.address;
    const lat = toNum(a?.lat ?? a?.latitude);
    const lng = toNum(a?.lng ?? a?.longitude);
    return lat != null && lng != null ? { lat, lng } : null;
  }, [me]);
  const myPos = gps?.lat != null ? { lat: gps.lat, lng: gps.lng } : myDefaultPos;

  /* ===== gán sẵn địa chỉ hiển thị vào ô input khi có default ===== */
  useEffect(() => {
    // Nếu chưa gõ tay và chưa bật GPS, điền ô address = line1 mặc định
    if (!isNonEmpty(pickupForm.address)) {
      const a = me?.default_address || me?.address;
      const line1 = a?.line1 || a?.label || "";
      if (isNonEmpty(line1) && !gps.lat && !gps.lng) {
        setPickupForm((f) => ({ ...f, address: line1 }));
      }
    }
  }, [me, gps?.lat, gps?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ===== điểm nhận gần nhất ===== */
  const nearestPickup = useMemo(() => {
    if (!myPos || !Array.isArray(pups) || pups.length === 0) return null;
    const hav = (a, b) => {
      const R = 6371;
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLng = ((b.lng - a.lng) * Math.PI) / 180;
      const s = Math.sin(dLat / 2) ** 2
        + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180)
        * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s));
    };
    return pups
      .map((p) => ({
        ...p,
        _lat: toNum(p?.lat ?? p?.latitude ?? p?.geo?.lat),
        _lng: toNum(p?.lng ?? p?.longitude ?? p?.geo?.lng),
      }))
      .map((p) => ({
        ...p,
        _dist: (p._lat != null && p._lng != null) ? hav(myPos, { lat: +p._lat, lng: +p._lng }) : Infinity
      }))
      .sort((a, b) => a._dist - b._dist)[0] ?? null;
  }, [myPos, pups]);

  /* ===== bật GPS ===== */
  const askGps = async () => {
    if (!("geolocation" in navigator)) { t.error("Trình duyệt không hỗ trợ GPS"); return; }
    setGpsBusy(true);
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 12000, maximumAge: 10000,
        })
      );
      const { latitude, longitude, accuracy } = pos?.coords || {};
      if (latitude == null || longitude == null) throw new Error("Không lấy được toạ độ");
      setGps({ lat: +latitude, lng: +longitude, acc: Number.isFinite(+accuracy) ? +accuracy : null });
      t.success("Đã bật GPS");
    } catch (e) {
      const code = e?.code;
      const msg = code === 1 ? "Bạn đã từ chối quyền vị trí"
        : code === 2 ? "Không xác định vị trí"
          : code === 3 ? "Quá thời gian"
            : (e?.message || "Lỗi GPS");
      t.error(msg);
    } finally { setGpsBusy(false); }
  };

  async function setDefaultPickup(p) {
    if (!p?.id) return t.error("Không rõ điểm nhận");
    try {
      const res = await apiPatch("/api/donor/default-pickup", { id: p.id });
      if (res?.ok) {
        t.success("Đã cập nhật điểm nhận mặc định");
        // cập nhật lại /me để FE có default_address mới
        const meNew = await apiGet("/api/donor/me");
        setMe(meNew || {});
        // sync ô address theo mặc định mới nếu người dùng chưa gõ tay
        if (!isNonEmpty(pickupForm.address)) {
          setPickupForm((f) => ({ ...f, address: meNew?.default_address?.line1 || "" }));
        }
      } else t.info("Đã gửi yêu cầu cập nhật");
    } catch (e) {
      t.error(e?.message || "Không cập nhật được. Có thể BE chưa hỗ trợ endpoint này.");
    }
  }

  function goDonate() {
    nav("/donor/donate");
    t.success("Đang chuyển đến trang quyên góp…");
  }

  /* ===== hiển thị địa chỉ đang dùng (UI) ===== */
  const displayPickupSource = () => (gps?.lat ? "GPS" : (isNonEmpty(pickupForm.address) ? "Nhập tay" : "Mặc định"));
  const displayPickupAddress = () => {
    if (gps?.lat && gps?.lng) {
      // Chỉ hiển thị nhãn; địa chỉ cụ thể dùng input address nếu người dùng nhập
      const fallback = me?.default_address?.line1 || me?.address?.line1 || "Vị trí hiện tại (GPS)";
      return isNonEmpty(pickupForm.address) ? pickupForm.address : fallback;
    }
    return isNonEmpty(pickupForm.address)
      ? pickupForm.address
      : (me?.default_address?.line1 || me?.address?.line1 || "Địa chỉ chưa rõ");
  };

  /* ===== gọi shipper ===== */
  async function requestPickup() {
    const name = (pickupForm.name || "").trim();
    const qty = Number(pickupForm.qty);
    if (!name) return t.error("Vui lòng nhập tên món/quyên góp");
    if (!Number.isFinite(qty) || qty <= 0) return t.error("Số suất phải lớn hơn 0");

    // Chuẩn bị address để gửi BE (ưu tiên người dùng nhập tay)
    const pickup_address = (pickupForm.address || "").trim()
      || me?.default_address?.line1
      || me?.address?.line1
      || "";

    if (!isNonEmpty(pickup_address)) {
      return t.error("Chưa có địa chỉ lấy. Hãy bật GPS hoặc nhập địa chỉ.");
    }

    setPickupBusy(true);
    try {
      const res = await apiPost("/api/donor/request-pickup", {
        title: name,
        qty,
        pickup_address,
        lat: gps?.lat ?? me?.default_address?.lat ?? me?.address?.lat ?? null,
        lng: gps?.lng ?? me?.default_address?.lng ?? me?.address?.lng ?? null,
        note: pickupForm.note,
      });
      if (res?.ok) {
        t.success(`Đã tạo yêu cầu lấy đồ • Mã đơn ${res.booking_id}`);
        setPickupForm({ name: "", qty: 1, note: "", address: pickup_address }); // giữ lại address để đặt đơn tiếp
      } else {
        t.info("Hệ thống đã nhận yêu cầu, vui lòng theo dõi mục giao hàng.");
      }
    } catch (e) {
      t.error(e?.message || "Không tạo được yêu cầu lấy đồ");
    } finally {
      setPickupBusy(false);
    }
  }

  /* ================= render ================= */
  return (
    <div className="max-w-6xl mx-auto px-6 py-8 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40">
      {/* Header */}
      <Card className="p-6 mb-6 flex items-center gap-5 border-emerald-500/60 bg-gradient-to-r from-white to-emerald-50">
        <motion.img
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4 }}
          src={me?.avatar_url || "/images/avatar-default.png"}
          onError={(e) => { e.currentTarget.src = "/images/avatar-default.png"; }}
          className="h-16 w-16 rounded-full object-cover border-2 border-emerald-600 shadow-md"
          alt="Avatar nhà hảo tâm"
        />
        <div className="min-w-0">
          <div className="text-sm text-emerald-700 font-semibold">Xin chào,</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-900">{me?.name || "Nhà hảo tâm"}</h1>
          <div className="text-sm text-slate-800 font-medium truncate">
            Cảm ơn bạn đã đồng hành cùng <span className="text-emerald-600 font-bold">Bữa Cơm Xanh 🌱</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            className={cls(
              "h-10 px-4 rounded-xl font-semibold border-2 shadow-sm transition",
              gpsBusy ? "opacity-60 cursor-not-allowed border-slate-300 bg-slate-100 text-slate-500"
                : "border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white"
            )}
            onClick={askGps}
            disabled={gpsBusy}
            aria-live="polite"
          >
            <Compass className="h-4 w-4 inline -mt-0.5" /> {gps?.lat ? "GPS đang bật" : "Bật GPS"}
          </button>
        </div>
      </Card>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <Skeleton className="h-28" /><Skeleton className="h-28" />
          <Skeleton className="h-28" /><Skeleton className="h-28" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <Stat label="Tổng đã ủng hộ" value={VND(stats?.total_amount)} />
          <Stat label="Tổng suất quy đổi" value={Number(stats?.total_meals || 0)} />
          <Stat label="Lần ủng hộ" value={Number(stats?.count || 0)} />
          <Stat label="Điểm lấy mặc định" value={stats?.default_pickup_point?.name || me?.default_address?.label || "—"} />
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <button
          className="rounded-2xl px-5 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold shadow-lg hover:from-emerald-600 hover:to-emerald-700 active:scale-[.99] transition"
          onClick={goDonate}
        >
          <HandHeart className="h-5 w-5 inline -mt-0.5" /> Ủng hộ ngay
        </button>

        <Link
          to="/delivery"
          className="rounded-2xl px-5 py-4 border-2 border-blue-600 text-blue-700 font-semibold shadow hover:bg-blue-50 transition"
        >
          <Truck className="h-5 w-5 inline -mt-0.5" /> Theo dõi giao hàng
        </Link>

        {nearestPickup && Number.isFinite(nearestPickup._dist) ? (
          <button
            className="rounded-2xl px-5 py-4 border-2 border-violet-600 text-violet-700 font-semibold shadow hover:bg-violet-50 transition text-left"
            onClick={() => setDefaultPickup(nearestPickup)}
            title={`Khoảng cách ~ ${kmFmt(nearestPickup._dist)}`}
          >
            <MapPin className="h-5 w-5 inline -mt-0.5" /> Đặt điểm lấy gần nhất ({kmFmt(nearestPickup._dist)})
          </button>
        ) : (
          <div className="rounded-2xl px-5 py-4 border-2 border-slate-300 bg-slate-50 text-slate-700 flex items-center gap-2 font-medium">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Không tìm thấy điểm lấy gần — bật GPS hoặc cập nhật địa chỉ mặc định.
          </div>
        )}
      </div>

      {/* Request pickup form */}
      <Card className="mb-6">
        <div
          className="px-6 py-4 border-b-2 border-slate-200 text-lg font-bold 
             flex items-center gap-2 
             bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 
             text-white shadow-md 
             hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600
             transition-all duration-200 rounded-t-xl"
        >
          <Bike className="h-5 w-5 text-white drop-shadow" />
          <span>🚴‍♂️ Gọi shipper tới lấy đồ</span>
        </div>

        <div className="p-6 space-y-5">
          {/* nguồn vị trí + khoảng cách */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-xl border-2 border-emerald-200 p-3 bg-white">
            <div className="flex items-center gap-2 text-slate-900">
              <Navigation className="h-4 w-4 text-emerald-700" />
              <div className="text-sm">
                <span className="font-bold">Địa điểm lấy:</span>{" "}
                <span className="font-semibold">{displayPickupAddress()}</span>
                <span
                  className={cls(
                    "ml-2 text-xs px-2 py-0.5 rounded-full border font-semibold",
                    gps?.lat
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : (isNonEmpty(pickupForm.address)
                        ? "border-sky-300 bg-sky-50 text-sky-800"
                        : "border-slate-300 bg-slate-100 text-slate-800")
                  )}
                >
                  {displayPickupSource()}
                </span>
              </div>
            </div>
            {nearestPickup && Number.isFinite(nearestPickup._dist) && (
              <div className="text-xs md:text-sm text-slate-900">
                Gần điểm nhận <b className="text-violet-800">{nearestPickup?.name || "—"}</b> · {kmFmt(nearestPickup._dist)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Tên món / nội dung quyên góp">
              <input
                type="text"
                value={pickupForm.name}
                onChange={(e) => setPickupForm({ ...pickupForm, name: e.target.value })}
                placeholder="VD: 20 hộp cơm nóng, nước suối…"
                className="w-full h-11 rounded-xl border-2 border-slate-300 px-3 outline-none focus:border-emerald-600 text-slate-900 placeholder:text-slate-600"
              />
            </Field>
            <Field label="Số suất">
              <input
                type="number" min={1}
                value={pickupForm.qty}
                onChange={(e) => setPickupForm({ ...pickupForm, qty: Math.max(1, Number(e.target.value || 1)) })}
                className="w-full h-11 rounded-xl border-2 border-slate-300 px-3 outline-none focus:border-emerald-600 text-slate-900 placeholder:text-slate-600"
              />
            </Field>
          </div>

          {/* gợi ý nhanh */}
          <div className="flex flex-wrap gap-2">
            <Chip onClick={() => setPickupForm((f) => ({ ...f, name: "Cơm hộp", qty: Math.max(10, f.qty) }))}>Cơm hộp ×10</Chip>
            <Chip onClick={() => setPickupForm((f) => ({ ...f, name: "Bánh mì", qty: Math.max(20, f.qty) }))}>Bánh mì ×20</Chip>
            <Chip onClick={() => setPickupForm((f) => ({ ...f, name: "Nước suối", qty: Math.max(24, f.qty) }))}>Nước suối ×24</Chip>
          </div>

          {/* Địa chỉ lấy — luôn hiển thị để người dùng có thể sửa nhanh */}
          <Field
            label="Địa chỉ lấy"
            hint="Nếu đã bật GPS, có thể giữ nguyên địa chỉ mặc định hoặc sửa lại cho chính xác."
          >
            <input
              type="text"
              value={pickupForm.address}
              onChange={(e) => setPickupForm({ ...pickupForm, address: e.target.value })}
              placeholder="Ví dụ: 12 Nguyễn Văn B, P.X, Q.Y, TP.HCM"
              className="w-full h-11 rounded-xl border-2 border-slate-300 px-3 outline-none focus:border-emerald-600 text-slate-900 placeholder:text-slate-600"
            />
          </Field>

          <Field label="Ghi chú cho shipper (tuỳ chọn)">
            <textarea
              value={pickupForm.note}
              onChange={(e) => setPickupForm({ ...pickupForm, note: e.target.value })}
              placeholder="Ví dụ: gọi trước 10 phút; cổng bảo vệ; có chỗ đậu xe…"
              className="w-full rounded-xl border-2 border-slate-300 px-3 py-2 outline-none focus:border-emerald-600 text-slate-900 placeholder:text-slate-600"
            />
          </Field>

          <button
            onClick={requestPickup}
            disabled={pickupBusy}
            className={cls(
              "w-full h-11 rounded-xl font-bold flex items-center justify-center gap-2",
              pickupBusy ? "bg-slate-400 text-white cursor-not-allowed"
                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow"
            )}
          >
            {pickupBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
            Gửi yêu cầu shipper tới lấy
          </button>
        </div>
      </Card>

      {/* Recent donations */}
      <Card className="border-slate-200">
        <div className="px-6 py-5 border-b-2 border-slate-200 text-[22px] font-extrabold text-slate-900">
          Đóng góp gần đây
        </div>
        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-24" /><Skeleton className="h-24" />
              <Skeleton className="h-24" /><Skeleton className="h-24" />
            </div>
          ) : recent?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recent.map((d, i) => (
                <div key={i}
                  className="rounded-xl border-2 border-slate-200 p-4 bg-white hover:bg-emerald-50/40 transition shadow-sm">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {d?.campaign_title || d?.campaign?.title || "Chiến dịch"}
                  </div>
                  <div className="text-xs text-slate-700">{safeDate(d?.created_at || Date.now())}</div>
                  <div className="mt-1 text-base font-extrabold text-emerald-700">{VND(d?.amount || 0)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border-2 border-slate-200 p-4 bg-slate-50">
              <div className="text-slate-800 font-medium">
                Bạn chưa có ủng hộ nào gần đây. Bắt đầu một đóng góp mới ngay bây giờ!
              </div>
              <button
                className="h-10 px-4 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow"
                onClick={goDonate}
              >
                Ủng hộ ngay <ChevronRight className="inline h-4 w-4 -mt-0.5" />
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
