// frontend/src/pages/AdminCampaigns.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { useToast } from "../components/ui/Toast";
import { apiGet, API_BASE } from "../lib/api";
import { buildVietQR } from "../lib/vietqr";
import {
  Search, Plus, Edit3, Archive, Image as ImageIcon, X, Check, ChevronLeft,
  ChevronRight, RefreshCw, Loader2, QrCode, Wallet, UploadCloud,
  Calendar, MapPin, Users, ChevronDown, ChevronUp, Info, Clock4, Eye, XCircle
} from "lucide-react";

/* ============= Helpers ============= */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const VND = (n) => (Number(n || 0)).toLocaleString("vi-VN") + "đ";
const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("vi-VN") : "—");

// Nhãn filter
const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "draft", label: "Nháp (draft)" },
  { value: "active", label: "Đang chạy (active)" },
  { value: "archived", label: "Lưu trữ (archived)" },
];
const TYPE_OPTIONS = [
  { value: "", label: "Tất cả loại" },
  { value: "money", label: "Gây quỹ tiền" },
  { value: "meal", label: "Bữa ăn" },
];
const PAYMENT_METHOD_OPTIONS = [
  { value: "momo", label: "MoMo (chuyển hướng)", icon: Wallet },
  { value: "vietqr", label: "VietQR (từ STK)", icon: QrCode },
  { value: "custom_qr", label: "QR tự upload", icon: UploadCloud },
];

// Các trạng thái đơn cần duyệt
const PENDING_STATUSES = ["pending", "pledged", "scheduled"];

// Nhận diện donate là meal/food (bao quát nhiều schema)
const isMealDonation = (d = {}) => {
  const t = (d.type || d.kind || "").toLowerCase();
  if (t === "food" || t === "meal") return true;
  // fallback: có qty > 0 nhưng không có amount
  if (Number(d.qty || 0) > 0 && !Number(d.amount || 0)) return true;
  return false;
};

/* ============= Small UI bits ============= */
const Chip = ({ children, className = "", title }) => (
  <span
    title={title}
    className={
      "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ring-1 ring-slate-200 bg-white text-slate-800 " +
      className
    }
  >
    {children}
  </span>
);

function StatusBadge({ value }) {
  const map = {
    draft: "ring-amber-300 bg-amber-50 text-amber-800",
    active: "ring-emerald-300 bg-emerald-50 text-emerald-800",
    archived: "ring-slate-300 bg-slate-50 text-slate-800",
  };
  const key = value === "active" ? "active" : value === "archived" ? "archived" : "draft";
  return <Chip className={map[key]}>{key}</Chip>;
}

function TypePill({ value }) {
  const map = {
    money: "ring-emerald-300 bg-emerald-50",
    meal: "ring-violet-300 bg-violet-50",
  };
  return <Chip className={map[value] || "ring-slate-300 bg-slate-50"}>{value || "—"}</Chip>;
}

function PaymentPill({ method }) {
  const map = {
    momo: "ring-pink-300 bg-pink-50",
    vietqr: "ring-emerald-300 bg-emerald-50",
    custom_qr: "ring-slate-300 bg-slate-50",
  };
  const lbl = method === "momo" ? "MoMo" : method === "custom_qr" ? "QR upload" : "VietQR";
  return <Chip className={map[method] || "ring-slate-300 bg-slate-50"}>{lbl}</Chip>;
}

function LinearProgress({ value, max, title }) {
  const m = Number(max || 0);
  const v = Number(value || 0);
  const pct = m > 0 ? clamp((v / m) * 100, 0, 100) : 0;
  return (
    <div className="w-full" title={title}>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden ring-1 ring-slate-200">
        <div className="h-full bg-[linear-gradient(90deg,#10b981,#22d3ee)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ============= Network helpers ============= */
async function parseErrorResponse(r) {
  const status = r.status;
  const statusText = r.statusText || "";
  let msg = "";
  let payload = null;
  try {
    payload = await r.clone().json();
    msg = payload?.message || payload?.error || payload?.errors || "";
  } catch {
    try { msg = await r.clone().text(); } catch {}
  }
  if (status === 401) msg ||= "Phiên đăng nhập đã hết hạn hoặc thiếu quyền (401).";
  if (status === 403) msg ||= "Bạn không có quyền thực hiện thao tác này (403).";
  if (status === 404) msg ||= "API không tồn tại hoặc tài nguyên không tìm thấy (404).";
  if (status === 413) msg ||= "Tệp quá lớn (413).";
  if (status === 422) {
    if (payload?.errors && typeof payload.errors === "object") {
      const lines = [];
      for (const [field, val] of Object.entries(payload.errors)) {
        lines.push(`${field}: ${Array.isArray(val) ? val.join(", ") : String(val)}`);
      }
      msg = lines.length ? `Dữ liệu không hợp lệ:\n- ${lines.join("\n- ")}` : (msg || "Dữ liệu không hợp lệ (422).");
    } else msg ||= "Dữ liệu không hợp lệ (422).";
  }
  return `${status} ${statusText} – ${msg || `Yêu cầu thất bại (${status}).`}`.trim();
}

/* ============= Upload helpers ============= */
async function uploadDataUrl(dataUrl, token) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return uploadBlob(blob, token);
}
async function uploadBlob(blob, token) {
  const fd = new FormData();
  const filename = `file-${Date.now()}.${(blob.type || "image/jpeg").split("/")[1] || "jpg"}`;
  fd.append("file", new File([blob], filename, { type: blob.type || "image/jpeg" }));
  fd.append("folder", "campaigns");
  const up = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: fd,
  });
  if (!up.ok) throw new Error(await parseErrorResponse(up));
  const resp = await up.json().catch(() => null);
  const url = resp?.url || resp?.data?.url;
  if (!url) throw new Error("Upload ảnh thành công nhưng không nhận được URL trả về.");
  return url;
}

/* ============= Normalize (khớp DB) ============= */
function parseMeta(rawMeta, rawTags) {
  let meta = {};
  const src = rawMeta ?? rawTags;
  if (!src) return meta;
  if (typeof src === "string") { try { meta = JSON.parse(src) || {}; } catch { meta = {}; } }
  else if (typeof src === "object") meta = src || {};
  return meta;
}
function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((c) => {
    const meta = parseMeta(c.meta, c.tags);
    const type = (meta?.type || c.type || "money").toString();
    const mealUnit = meta?.meal?.unit || "phần";
    const mealTarget = toNum(meta?.meal?.target_qty, 0);
    const mealReceived = toNum(meta?.meal?.received_qty, toNum(c.meal_received_qty, 0));
    const payment_method = meta?.payment?.method || "momo";
    return {
      ...c,
      meta,
      type,
      cover_url: c.cover_url ?? c.cover ?? "",
      target_amount: toNum(c.target_amount ?? c.goal, 0),
      raised_amount: toNum(c.raised_amount ?? c.raised, 0),
      meal_unit: mealUnit,
      meal_target_qty: mealTarget,
      meal_received_qty: mealReceived,
      payment_method,
      status: c.status || "draft",
      title: c.title || "",
      description: c.description || "",
      location: c.location || "",
      supporters: toNum(c.supporters, 0),
      start_at: meta?.start_at || null,
      end_at: meta?.end_at || c.deadline || null,
      meal_price: toNum(meta?.meal?.price ?? c.meal_price, 0),
    };
  });
}
function normalizeResponse(res, fallback = {}) {
  const base = res?.items ? res : (res?.data?.items ? res.data : fallback);
  const items = normalizeItems(base.items || []);
  const total = Number(base.total ?? fallback.total ?? 0);
  const page = Number(base.page ?? fallback.page ?? 1);
  const pageSize = Number(base.pageSize ?? fallback.pageSize ?? 10);
  return { items, total, page, pageSize };
}

/* ============= Page ============= */
export default function AdminCampaigns() {
  const t = useToast();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 10 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [openRow, setOpenRow] = useState(null);

  // Bảng donate chờ duyệt theo từng chiến dịch
  const [donationsMap, setDonationsMap] = useState({}); // { [campaignId]: { loading, items, total } }

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  // Load list campaigns
  async function load({ gotoPage, force } = {}) {
    const nextPage = gotoPage ?? page;
    if (gotoPage) setPage(gotoPage);
    setLoading(true);
    try {
      const nonce = force ? `&_=${Date.now()}` : "";
      const baseUrl = `/api/admin/campaigns?q=${encodeURIComponent(debouncedQ)}&status=${encodeURIComponent(
        status || "active"
      )}&page=${nextPage}&pageSize=${pageSize}${typeFilter ? `&type=${encodeURIComponent(typeFilter)}` : ""}${nonce}`;
      const res = await apiGet(baseUrl);
      const normalized = normalizeResponse(res, { items: [], total: 0, page: nextPage, pageSize });
      setData(normalized);
    } catch (e) {
      console.error(e);
      setData({ items: [], total: 0, page: nextPage, pageSize });
      t.error(
        e?.message?.startsWith?.("TypeError")
          ? "Không kết nối được server. Kiểm tra API/CORS."
          : e?.message || "Không tải được danh sách chiến dịch."
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load({ force: true }); /* eslint-disable-next-line */ }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [debouncedQ, status, page, pageSize, typeFilter]);
// ===== Load donations chờ duyệt — CHỈ LẤY MEAL/FOOD, gom nhiều trạng thái =====
const REVIEWABLE_STATUSES = new Set(["pending", "pledged", "scheduled", "awaiting", "created"]);

async function loadPendingDonations(campaignId) {
  if (!campaignId) return;
  setDonationsMap((m) => ({ ...m, [campaignId]: { ...(m[campaignId] || {}), loading: true } }));
  try {
    // Lấy theo campaign_id, KHÔNG truyền status để server trả tất cả
    // rồi lọc client-side theo trạng thái + chỉ meal/food
    const res = await apiGet(`/api/admin/donations?campaign_id=${campaignId}&order=desc&limit=200`);
    const items = (res?.items ?? res?.data?.items ?? (Array.isArray(res) ? res : [])) || [];

    const mealOnlyPending = items
      .filter((d) => {
        const st = String(d.status || "").toLowerCase();
        return REVIEWABLE_STATUSES.has(st) && isMealDonation(d);
      })
      // ưu tiên đơn mới lên đầu
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    setDonationsMap((m) => ({
      ...m,
      [campaignId]: { loading: false, items: mealOnlyPending, total: mealOnlyPending.length },
    }));
  } catch (e) {
    console.error(e);
    t.error(e?.message || "Không tải được donate chờ duyệt.");
    setDonationsMap((m) => ({ ...m, [campaignId]: { loading: false, items: [], total: 0 } }));
  }
}


  // Approve / Reject
  async function patchDonationStatus(id, nextStatus) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    const r = await fetch(`${API_BASE}/api/admin/donations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!r.ok) throw new Error(await parseErrorResponse(r));
    return r.json().catch(() => ({}));
  }

  async function approveDonation(d) {
    try {
      await patchDonationStatus(d.id, "success");
      t.success("✅ Đã chấp nhận đơn meal");
      await loadPendingDonations(d.campaign_id);
      await load({ force: true }); // cập nhật tiến độ chiến dịch
    } catch (e) {
      console.error(e);
      t.error(e?.message || "Không chấp nhận được đơn.");
    }
  }

  async function rejectDonation(d) {
    if (!confirm("Từ chối đơn này?")) return;
    try {
      await patchDonationStatus(d.id, "rejected");
      t.info("Đã từ chối đơn");
      await loadPendingDonations(d.campaign_id);
    } catch (e) {
      console.error(e);
      t.error(e?.message || "Không từ chối được đơn.");
    }
  }

  // Save (create / update)
  async function save(item) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    const isNew = !item?.id;
    setSaving(true);
    try {
      if (!item.title?.trim()) throw new Error("Vui lòng nhập tiêu đề chiến dịch.");

      const type = item.type || "money";
      if (type === "money") {
        if (item.target_amount == null || Number.isNaN(Number(item.target_amount)))
          throw new Error("Mục tiêu gây quỹ không hợp lệ.");
        if (Number(item.target_amount) < 0) throw new Error("Mục tiêu không thể âm.");
      } else {
        if (item.meal_target_qty == null || Number.isNaN(Number(item.meal_target_qty)))
          throw new Error("Mục tiêu số suất không hợp lệ.");
        if (Number(item.meal_target_qty) < 0) throw new Error("Mục tiêu không thể âm.");
      }

      let cover_url = item.cover_url || "";
      if (cover_url.startsWith("data:")) cover_url = await uploadDataUrl(cover_url, token);

      const payment_method = item.payment_method || "momo";
      let payment_qr_url = item.payment_qr_url || "";
      if (payment_method === "custom_qr" && payment_qr_url.startsWith("data:")) {
        payment_qr_url = await uploadDataUrl(payment_qr_url, token);
      }
      const payment =
        payment_method === "momo"
          ? { method: "momo" }
          : payment_method === "custom_qr"
          ? { method: "custom_qr", qr_url: payment_qr_url }
          : {
              method: "vietqr",
              bank: item.payment_bank || "",
              account: item.payment_account || "",
              name: item.payment_name || "",
              memo: item.payment_memo || "",
              qr_url:
                item.payment_qr_url ||
                buildVietQR({
                  bank: item.payment_bank,
                  account: item.payment_account,
                  name: item.payment_name,
                  memo: item.payment_memo,
                }),
            };

      const meta = {
        type,
        start_at: item.start_at || null,
        end_at: item.end_at || null,
        payment,
        meal: {
          unit: item.meal_unit || "phần",
          target_qty: toNum(item.meal_target_qty, 0),
          received_qty: toNum(item.meal_received_qty, 0),
          wish: item.meal_wish || "",
          price: toNum(item.meal_price, 0),
        },
        ledger: { enabled: true },
      };

      const body = {
        title: item.title.trim(),
        description: item.description || "",
        status: item.status || "draft",
        cover_url,
        cover: item.cover || "",
        target_amount: toNum(item.target_amount, 0),
        raised_amount: toNum(item.raised_amount, 0),
        meal_received_qty: toNum(item.meal_received_qty, 0),
        meal_price: toNum(item.meal_price, 0),
        deadline: item.end_at || null,
        meta,
        tags: Array.isArray(item.tags) ? item.tags : [],
        type,
        location: item.location || "",
      };

      const r = await fetch(`${API_BASE}/api/admin/campaigns${isNew ? "" : `/${item.id}`}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await parseErrorResponse(r));

      t.success(isNew ? "🎉 Đã tạo chiến dịch" : "✅ Đã cập nhật chiến dịch");
      setEditing(null);
      await load({ gotoPage: 1, force: true });
    } catch (e) {
      console.error(e);
      t.error(e?.message || "Lỗi không xác định khi lưu chiến dịch.");
    } finally {
      setSaving(false);
    }
  }

  // Archive
  async function archive(id) {
    const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
    if (!confirm("Chuyển chiến dịch sang archived?")) return;
    try {
      const r = await fetch(`${API_BASE}/api/admin/campaigns/${id}`, {
        method: "DELETE",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!r.ok) throw new Error(await parseErrorResponse(r));
      t.info("Đã lưu trữ (archived)");
      load({ force: true });
    } catch (e) {
      t.error(e?.message || "Không lưu trữ được chiến dịch.");
    }
  }

  // Shortcuts
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setEditing({
          title: "", description: "", cover_url: "", status: "draft",
          type: "money", start_at: "", end_at: "",
          target_amount: 0, raised_amount: 0,
          payment_method: "momo", payment_bank: "", payment_account: "",
          payment_name: "", payment_memo: "", payment_qr_url: "",
          meal_unit: "phần", meal_target_qty: 0, meal_received_qty: 0, meal_wish: "", meal_price: 10000,
          location: "",
        });
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        load({ force: true });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(Number(data.total || 0) / Number(pageSize || 10))),
    [data.total, pageSize]
  );

  return (
    <div className="space-y-4">
      {/* Backdrop aura */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-30 bg-emerald-200" />
        <div className="absolute -bottom-28 -right-28 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-25 bg-sky-200" />
      </div>

      {/* Filter bar */}
      <Card className="p-4 border-emerald-100 bg-white/90 backdrop-blur-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" />
            <input
              className="w-full rounded-xl border border-slate-300 bg-white px-10 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              placeholder="Tìm theo tiêu đề/mô tả…"
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
            />
          </div>

          <select
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 md:w-56"
            value={status}
            onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 md:w-56"
            value={typeFilter}
            onChange={(e) => { setPage(1); setTypeFilter(e.target.value); }}
          >
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <div className="flex items-center gap-2 md:ml-auto">
            <label className="text-sm text-slate-700">Hiển thị</label>
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-300 w-[90px]"
              value={pageSize}
              onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}
            >
              {[10, 20, 50].map((n) => (<option key={n} value={n}>{n}/trang</option>))}
            </select>

            <Button variant="secondary" onClick={() => load({ force: true })} disabled={loading} title="Tải lại"
              className="ring-1 ring-slate-200">
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>

            <Button
              onClick={() => setEditing({
                title: "", description: "", cover_url: "", status: "draft",
                type: "money", start_at: "", end_at: "",
                target_amount: 0, raised_amount: 0,
                payment_method: "momo", payment_bank: "", payment_account: "",
                payment_name: "", payment_memo: "", payment_qr_url: "",
                meal_unit: "phần", meal_target_qty: 0, meal_received_qty: 0, meal_wish: "", meal_price: 10000,
                location: "",
              })}
              className="bg-gradient-to-r from-emerald-600 to-sky-600 text-white ring-1 ring-emerald-500"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo chiến dịch
            </Button>
          </div>
        </div>
        <div className="mt-2 text-sm text-slate-700">
          <Chip>Tổng: {Number(data.total || 0)}</Chip>
        </div>
      </Card>

      {/* Table campaigns */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-10 ring-1 ring-slate-200">
              <tr className="text-left text-slate-900">
                <th className="px-3 py-2 w-16">Cover</th>
                <th className="px-3 py-2 min-w-[260px]">Tiêu đề</th>
                <th className="px-3 py-2">Loại</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Thanh toán</th>
                <th className="px-3 py-2">Mục tiêu</th>
                <th className="px-3 py-2">Đã đạt</th>
                <th className="px-3 py-2 w-[230px]">Tiến độ</th>
                <th className="px-3 py-2">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />Địa điểm</span>
                </th>
                <th className="px-3 py-2">
                  <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" />Ủng hộ</span>
                </th>
                <th className="px-3 py-2">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />Tạo</span>
                </th>
                <th className="px-3 py-2">
                  <span className="inline-flex items-center gap-1"><Clock4 className="h-4 w-4" />Hạn</span>
                </th>
                <th className="px-3 py-2 w-56">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t">
                    {Array.from({ length: 13 }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-4 w-24 bg-slate-100 rounded animate-pulse ring-1 ring-slate-200" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !Array.isArray(data.items) || data.items.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8">
                    <Empty
                      title="Chưa có chiến dịch"
                      subtitle="Hãy tạo chiến dịch đầu tiên để bắt đầu."
                      action={
                        <Button onClick={() => setEditing({
                          title: "", description: "", cover_url: "", status: "draft",
                          type: "money", start_at: "", end_at: "",
                          target_amount: 0, raised_amount: 0,
                          payment_method: "momo",
                          payment_bank: "", payment_account: "", payment_name: "", payment_memo: "", payment_qr_url: "",
                          meal_unit: "phần", meal_target_qty: 0, meal_received_qty: 0, meal_wish: "", meal_price: 10000,
                          location: "",
                        })}>
                          <Plus className="h-4 w-4 mr-1.5" />
                          Tạo chiến dịch
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                data.items.map((c) => {
                  const isMealCamp = (c.type || "money") === "meal";
                  const target = isMealCamp ? toNum(c.meal_target_qty, 0) : toNum(c.target_amount, 0);
                  const raised = isMealCamp ? toNum(c.meal_received_qty, 0) : toNum(c.raised_amount, 0);
                  const pct = target > 0 ? Math.round((raised / target) * 100) : 0;
                  const open = openRow === c.id;
                  const dState = donationsMap[c.id] || { loading: false, items: [], total: 0 };

                  return (
                    <>
                      <tr key={c.id} className="border-t even:bg-slate-50/40 hover:bg-emerald-50/50 transition-colors">
                        <td className="px-3 py-2">
                          {c.cover_url ? (
                            <img
                              src={c.cover_url}
                              alt=""
                              className="h-10 w-14 object-cover rounded-md ring-1 ring-slate-200"
                              onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                          ) : (
                            <div className="h-10 w-14 rounded-md bg-slate-100 flex items-center justify-center ring-1 ring-slate-200">
                              <ImageIcon className="h-5 w-5 text-slate-500" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              className="rounded-md p-1 hover:bg-emerald-50 ring-1 ring-slate-200 hover:ring-emerald-300 transition"
                              onClick={() => {
                                const next = open ? null : c.id;
                                setOpenRow(next);
                                if (!open && next) loadPendingDonations(c.id);
                              }}
                              title={open ? "Ẩn chi tiết" : "Xem nhanh chi tiết"}
                            >
                              {open ? <ChevronUp className="h-4 w-4 text-emerald-700" /> : <ChevronDown className="h-4 w-4 text-emerald-700" />}
                            </button>
                            <span className="font-semibold text-slate-900 line-clamp-1">{c.title}</span>
                          </div>
                          {c.description ? (
                            <div className="mt-0.5">
                              <Chip className="text-slate-700">{c.description}</Chip>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2"><TypePill value={c.type || "money"} /></td>
                        <td className="px-3 py-2"><StatusBadge value={c.status} /></td>
                        <td className="px-3 py-2"><PaymentPill method={c.payment_method} /></td>
                        <td className="px-3 py-2">
                          <Chip title={isMealCamp ? `${target} ${c.meal_unit || "phần"}` : VND(target)}>
                            {isMealCamp ? `${target} ${c.meal_unit || "phần"}` : VND(target)}
                          </Chip>
                        </td>
                        <td className="px-3 py-2">
                          <Chip title={isMealCamp ? `${raised}/${target} ${c.meal_unit}` : `${VND(raised)}/${VND(target)}`}>
                            {isMealCamp ? `${raised} ${c.meal_unit || "phần"}` : VND(raised)}
                          </Chip>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-3">
                            <LinearProgress
                              value={raised}
                              max={target || 1}
                              title={isMealCamp ? `${raised}/${target} ${c.meal_unit}` : `${VND(raised)}/${VND(target)}`}
                            />
                            <Chip className="min-w-[44px] justify-center">{pct}%</Chip>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Chip title={c.location || "—"} className="max-w-[180px] truncate">
                            <MapPin className="h-3.5 w-3.5" />
                            {c.location || "—"}
                          </Chip>
                        </td>
                        <td className="px-3 py-2">
                          <Chip title={`${c.supporters || 0} người ủng hộ`}>
                            <Users className="h-3.5 w-3.5" />
                            {c.supporters || 0}
                          </Chip>
                        </td>
                        <td className="px-3 py-2"><Chip>{fmtDate(c.created_at)}</Chip></td>
                        <td className="px-3 py-2"><Chip>{fmtDate(c.end_at || c.deadline)}</Chip></td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => setEditing({
                                ...c,
                                payment_method: c.meta?.payment?.method || "momo",
                                payment_bank: c.meta?.payment?.bank || "",
                                payment_account: c.meta?.payment?.account || "",
                                payment_name: c.meta?.payment?.name || "",
                                payment_memo: c.meta?.payment?.memo || "",
                                payment_qr_url: c.meta?.payment?.qr_url || "",
                                meal_unit: c.meal_unit || c.meta?.meal?.unit || "phần",
                                meal_target_qty: c.meal_target_qty ?? c.meta?.meal?.target_qty ?? 0,
                                meal_received_qty: c.meal_received_qty ?? c.meta?.meal?.received_qty ?? 0,
                                meal_wish: c.meta?.meal?.wish || "",
                                meal_price: toNum(c.meal_price, 0),
                              })}
                              className="ring-1 ring-slate-200"
                            >
                              <Edit3 className="h-4 w-4 mr-1" />
                              Sửa
                            </Button>

                            {/* Chỉ cần xem/duyệt ĐƠN MEAL */}
                            <Button
                              variant="ghost"
                              onClick={() => {
                                const next = open ? null : c.id;
                                setOpenRow(next);
                                if (!open && next) loadPendingDonations(c.id);
                              }}
                              title="Xem đơn meal chờ duyệt"
                              className="ring-1 ring-emerald-200"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Đơn meal chờ duyệt
                            </Button>

                            <Button variant="ghost" onClick={() => archive(c.id)} className="ring-1 ring-slate-200">
                              <Archive className="h-4 w-4 mr-1" />
                              Lưu trữ
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Row details */}
                      {open && (
                        <tr className="bg-emerald-50/40">
                          <td colSpan={13} className="px-4 py-3 border-t">
                            <div className="grid gap-3 lg:grid-cols-3">
                              <Card className="p-3 ring-1 ring-slate-200">
                                <div className="text-xs uppercase tracking-wide text-slate-700 mb-2 flex items-center gap-2">
                                  <Info className="h-4 w-4" /> Thông tin chung
                                </div>
                                <div className="space-y-1 text-sm">
                                  <div><b className="text-slate-900">Loại:</b> <Chip>{c.type === "meal" ? "Bữa ăn" : "Gây quỹ tiền"}</Chip></div>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <b className="text-slate-900">Khoảng thời gian:</b>
                                    <Chip>{fmtDate(c.start_at)}</Chip>
                                    <span className="text-slate-500">→</span>
                                    <Chip>{fmtDate(c.end_at)}</Chip>
                                  </div>
                                  {c.type === "meal" && (
                                    <>
                                      <div><b className="text-slate-900">Đơn vị:</b> <Chip>{c.meal_unit}</Chip></div>
                                      <div><b className="text-slate-900">Đơn giá tham chiếu:</b> <Chip>{c.meal_price ? VND(c.meal_price) : "—"}</Chip></div>
                                      <div><b className="text-slate-900">Mong muốn:</b> {c.meta?.meal?.wish ? <Chip>{c.meta.meal.wish}</Chip> : "—"}</div>
                                    </>
                                  )}
                                </div>
                              </Card>

                              <Card className="p-3 ring-1 ring-slate-200">
                                <div className="text-xs uppercase tracking-wide text-slate-700 mb-2 flex items-center gap-2">
                                  <QrCode className="h-4 w-4" /> Kênh thanh toán
                                </div>
                                <div className="space-y-2 text-sm">
                                  <div><b className="text-slate-900">Phương thức:</b> <PaymentPill method={c.payment_method} /></div>
                                  {c.payment_method === "vietqr" && (
                                    <div className="flex flex-col gap-1">
                                      <div><b className="text-slate-900">Ngân hàng:</b> <Chip>{c.meta?.payment?.bank || "—"}</Chip></div>
                                      <div><b className="text-slate-900">STK:</b> <Chip>{c.meta?.payment?.account || "—"}</Chip></div>
                                      <div><b className="text-slate-900">Tên:</b> <Chip>{c.meta?.payment?.name || "—"}</Chip></div>
                                      <div><b className="text-slate-900">Ghi chú:</b> <Chip>{c.meta?.payment?.memo || "—"}</Chip></div>
                                    </div>
                                  )}
                                </div>
                              </Card>

                              <Card className="p-3 flex items-center justify-center ring-1 ring-slate-200">
                                {c.payment_method !== "momo" && (c.meta?.payment?.qr_url || (c.payment_method === "vietqr")) ? (
                                  <img
                                    src={c.meta?.payment?.qr_url || buildVietQR({
                                      bank: c.meta?.payment?.bank,
                                      account: c.meta?.payment?.account,
                                      name: c.meta?.payment?.name,
                                      memo: c.meta?.payment?.memo,
                                    })}
                                    alt="QR preview"
                                    className="max-h-44 object-contain"
                                  />
                                ) : (
                                  <div className="text-xs text-slate-600">Không có QR xem trước</div>
                                )}
                              </Card>
                            </div>

                            {/* ===== ONLY MEAL DONATIONS ===== */}
                            <div className="mt-3">
                              <div className="text-xs uppercase tracking-wide text-slate-700 mb-2 flex items-center gap-2">
                                <Eye className="h-4 w-4" /> Đơn <b>meal</b> chờ duyệt ({dState.total})
                                <Button
                                  variant="ghost"
                                  className="ml-2 ring-1 ring-slate-200"
                                  onClick={() => loadPendingDonations(c.id)}
                                  title="Làm mới danh sách đơn meal"
                                >
                                  <RefreshCw className="h-4 w-4 mr-1" /> Làm mới
                                </Button>
                              </div>

                              <Card className="p-0 ring-1 ring-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-slate-50">
                                      <tr className="text-left">
                                        <th className="px-3 py-2">ID</th>
                                        <th className="px-3 py-2">Số lượng</th>
                                        <th className="px-3 py-2">Đơn vị</th>
                                        <th className="px-3 py-2">Người ủng hộ</th>
                                        <th className="px-3 py-2">Ghi chú</th>
                                        <th className="px-3 py-2">Tạo lúc</th>
                                        <th className="px-3 py-2 w-40">Thao tác</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(() => {
                                        const rows = Array.isArray(dState.items) ? dState.items : [];

                                        if (dState.loading) {
                                          return Array.from({ length: 4 }).map((_, i) => (
                                            <tr key={i} className="border-t">
                                              {Array.from({ length: 7 }).map((__, j) => (
                                                <td key={j} className="px-3 py-3">
                                                  <div className="h-4 w-24 bg-slate-100 rounded animate-pulse ring-1 ring-slate-200" />
                                                </td>
                                              ))}
                                            </tr>
                                          ));
                                        }

                                        if (rows.length === 0) {
                                          return (
                                            <tr>
                                              <td colSpan={7} className="py-6">
                                                <Empty
                                                  title="Chưa có đơn meal đang chờ duyệt"
                                                  subtitle="Trang này chỉ hiển thị các đơn ủng hộ suất ăn/đồ ăn."
                                                />
                                              </td>
                                            </tr>
                                          );
                                        }

                                        return rows.map((d) => {
                                          return (
                                            <tr key={d.id} className="border-t hover:bg-emerald-50/40">
                                              <td className="px-3 py-2">{d.id}</td>
                                              <td className="px-3 py-2">{Number(d.qty || 0)}</td>
                                              <td className="px-3 py-2">
                                                { /* ưu tiên đơn vị theo chiến dịch */ }
                                                {c.meal_unit || d.unit || "phần"}
                                              </td>
                                              <td className="px-3 py-2">{d.donor_name || "—"}</td>
                                              <td className="px-3 py-2">
                                                <span className="inline-block max-w-[280px] truncate" title={d.memo || d.donor_note || ""}>
                                                  {d.memo || d.donor_note || "—"}
                                                </span>
                                              </td>
                                              <td className="px-3 py-2">{fmtDate(d.created_at)}</td>
                                              <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-2">
                                                  <Button onClick={() => approveDonation(d)} className="bg-emerald-600 text-white ring-1 ring-emerald-300">
                                                    <Check className="h-4 w-4 mr-1" /> Chấp nhận
                                                  </Button>
                                                  <Button variant="ghost" onClick={() => rejectDonation(d)} className="ring-1 ring-slate-200">
                                                    <XCircle className="h-4 w-4 mr-1" /> Từ chối
                                                  </Button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        });
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              </Card>
                            </div>
                            {/* ===== /ONLY MEAL DONATIONS ===== */}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && Array.isArray(data.items) && data.items.length > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 bg-white/90 backdrop-blur">
            <div className="text-sm text-slate-800">
              Trang <Chip className="mx-1">{page}</Chip> / <Chip>{totalPages}</Chip>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => { const p = clamp(page - 1, 1, totalPages); if (p !== page) setPage(p); }}
                disabled={page <= 1}
                className="ring-1 ring-slate-200"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Trước
              </Button>
              <Button
                onClick={() => { const p = clamp(page + 1, 1, totalPages); if (p !== page) setPage(p); }}
                disabled={page >= totalPages}
                className="ring-1 ring-slate-200"
              >
                Sau <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Dialog */}
      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <EditorForm
            value={editing}
            onChange={setEditing}
            onCancel={() => setEditing(null)}
            onSave={save}
            saving={saving}
          />
        </Modal>
      )}
    </div>
  );
}

/* ============= Modal ============= */
function Modal({ children, onClose }) {
  const overlayRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
    >
      <div className="w-[min(92vw,980px)] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {children}
      </div>
    </div>
  );
}

/* ============= Editor Form ============= */
function EditorForm({ value, onChange, onCancel, onSave, saving }) {
  const isNew = !value?.id;

  // paste ảnh cover nhanh
  useEffect(() => {
    function onPaste(e) {
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type.startsWith("image/"));
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onChange({ ...value, cover_url: reader.result });
      reader.readAsDataURL(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [value, onChange]);

  // QR preview theo payment_method
  const qrPreview = (() => {
    const m = value.payment_method || "momo";
    if (m === "vietqr") {
      const built = buildVietQR({
        bank: value.payment_bank,
        account: value.payment_account,
        name: value.payment_name,
        memo: value.payment_memo,
      }) || "";
      return value.payment_qr_url || built;
    }
    if (m === "custom_qr") return value.payment_qr_url || "";
    return "";
  })();

  async function handleUploadCustomQR(ev) {
    const f = ev?.target?.files?.[0];
    if (!f) return;
    try {
      const token = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
      const url = await uploadBlob(f, token);
      onChange({ ...value, payment_qr_url: url });
    } catch (e) {
      alert(e?.message || "Upload ảnh QR thất bại.");
    }
  }

  const inputCls =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-300";

  return (
    <div className="grid grid-rows-[auto_1fr_auto] max-h=[90vh] max-h-[90vh]">
      {/* Header */}
      <div className="p-5 bg-gradient-to-r from-emerald-700 to-sky-700 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-lg font-bold">{isNew ? "Tạo chiến dịch" : "Sửa chiến dịch"}</div>
            <div className="text-sm text-white/90">Thiết lập rõ ràng, tương phản cao, dễ đọc.</div>
          </div>
          <Button variant="ghost" onClick={onCancel} className="text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left */}
          <div className="lg:col-span-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">Loại chiến dịch</label>
                <select
                  className={inputCls}
                  value={value.type || "money"}
                  onChange={(e) => onChange({ ...value, type: e.target.value })}
                >
                  <option value="money">Gây quỹ tiền</option>
                  <option value="meal">Bữa ăn (ủng hộ suất ăn/đồ ăn)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">Trạng thái</label>
                <select
                  className={inputCls}
                  value={value.status || "draft"}
                  onChange={(e) => onChange({ ...value, status: e.target.value })}
                >
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="archived">archived</option>
                </select>
              </div>
            </div>

            <input
              className={inputCls}
              placeholder="Tiêu đề chiến dịch"
              value={value.title || ""}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
            />
            <textarea
              className={`${inputCls} min-h-32`}
              placeholder="Mô tả ngắn gọn, truyền cảm hứng…"
              value={value.description || ""}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
            />

            {/* time & location */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">Bắt đầu</label>
                <input
                  className={inputCls}
                  type="date"
                  value={value.start_at || ""}
                  onChange={(e) => onChange({ ...value, start_at: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">Kết thúc</label>
                <input
                  className={inputCls}
                  type="date"
                  value={value.end_at || ""}
                  onChange={(e) => onChange({ ...value, end_at: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">Địa điểm</label>
                <input
                  className={inputCls}
                  placeholder="VD: Quận 1, TP.HCM"
                  value={value.location || ""}
                  onChange={(e) => onChange({ ...value, location: e.target.value })}
                />
              </div>
            </div>

            {/* goals */}
            {(value.type || "money") === "money" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Mục tiêu gây quỹ (VND)</label>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    placeholder="VD: 50000000"
                    value={value.target_amount ?? 0}
                    onChange={(e) => onChange({ ...value, target_amount: toNum(e.target.value, 0) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Đã gây quỹ (VND) — có thể nhập tay</label>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={value.raised_amount ?? 0}
                    onChange={(e) => onChange({ ...value, raised_amount: toNum(e.target.value, 0) })}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Đơn vị</label>
                  <select
                    className={inputCls}
                    value={value.meal_unit || "phần"}
                    onChange={(e) => onChange({ ...value, meal_unit: e.target.value })}
                  >
                    {["phần","suất","hộp","kg","túi","bữa"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Mục tiêu số lượng</label>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={value.meal_target_qty ?? 0}
                    onChange={(e) => onChange({ ...value, meal_target_qty: toNum(e.target.value, 0) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Đã nhận</label>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={value.meal_received_qty ?? 0}
                    onChange={(e) => onChange({ ...value, meal_received_qty: toNum(e.target.value, 0) })}
                  />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <label className="text-xs font-semibold text-slate-800">Đơn giá tham chiếu (VND / {value.meal_unit || "phần"})</label>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={value.meal_price ?? 0}
                    onChange={(e) => onChange({ ...value, meal_price: toNum(e.target.value, 0) })}
                  />
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="text-xs font-semibold text-slate-800">Danh sách mong muốn (tùy chọn)</label>
                  <textarea
                    className={`${inputCls} min-h-24`}
                    placeholder="Ví dụ: Gạo 5kg; Cá hộp; Sữa tươi..."
                    value={value.meal_wish || ""}
                    onChange={(e) => onChange({ ...value, meal_wish: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right */}
          <div className="lg:col-span-2 space-y-3">
            {/* Cover */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-800">Ảnh cover (URL hoặc data:image)</label>
              <input
                className={inputCls}
                placeholder="Dán URL hoặc data:image/…;base64,… "
                value={value.cover_url || ""}
                onChange={(e) => onChange({ ...value, cover_url: e.target.value })}
              />
              <div className="rounded-xl ring-1 ring-slate-200 overflow-hidden bg-slate-50 aspect-[3/2] flex items-center justify-center">
                {value.cover_url ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <img
                    src={value.cover_url}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-700">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-xs">Paste ảnh trực tiếp từ clipboard để điền nhanh</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment */}
            <Card className="p-3 space-y-2 bg-white/90 backdrop-blur-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                <QrCode className="h-4 w-4" /> Kênh thanh toán của chiến dịch
              </div>

              <select
                className={inputCls}
                value={value.payment_method || "momo"}
                onChange={(e) => onChange({ ...value, payment_method: e.target.value })}
              >
                {PAYMENT_METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              {(value.payment_method || "momo") === "momo" && (
                <div className="text-xs text-slate-700 space-y-1">
                  <Chip>• Người ủng hộ sẽ được chuyển hướng tới trang MoMo.</Chip>
                  <Chip>• Lịch sử giao dịch có thể được cập nhật qua IPN.</Chip>
                </div>
              )}

              {value.payment_method === "vietqr" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input className={inputCls} placeholder="Mã ngân hàng (VD: vietcombank)"
                      value={value.payment_bank || ""}
                      onChange={(e) => onChange({ ...value, payment_bank: e.target.value })}
                    />
                    <input className={inputCls} placeholder="Số tài khoản"
                      value={value.payment_account || ""}
                      onChange={(e) => onChange({ ...value, payment_account: e.target.value })}
                    />
                    <input className={`${inputCls} md:col-span-2`} placeholder="Tên chủ tài khoản"
                      value={value.payment_name || ""}
                      onChange={(e) => onChange({ ...value, payment_name: e.target.value })}
                    />
                    <input className={`${inputCls} md:col-span-2`} placeholder="Ghi chú (VD: Ung ho {title} #{id})"
                      value={value.payment_memo || ""}
                      onChange={(e) => onChange({ ...value, payment_memo: e.target.value })}
                    />
                    <input className={`${inputCls} md:col-span-2`} placeholder="QR URL tuỳ chỉnh (nếu có)"
                      value={value.payment_qr_url || ""}
                      onChange={(e) => onChange({ ...value, payment_qr_url: e.target.value })}
                    />
                  </div>
                  <div className="rounded-xl ring-1 ring-slate-200 bg-white p-2 flex items-center justify-center">
                    {(() => {
                      const built = buildVietQR({
                        bank: value.payment_bank,
                        account: value.payment_account,
                        name: value.payment_name,
                        memo: value.payment_memo,
                      }) || "";
                      const preview = value.payment_qr_url || built;
                      return preview
                        ? <img src={preview} alt="QR preview" className="max-h-44 object-contain" />
                        : <div className="text-xs text-slate-700">Điền bank + số TK để hiện QR preview</div>;
                    })()}
                  </div>
                  <div className="text-xs text-slate-700">
                    <Chip>* QR gợi ý bởi <code>img.vietqr.io</code> (hoặc URL bạn nhập).</Chip>
                  </div>
                </div>
              )}

              {value.payment_method === "custom_qr" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      className={inputCls}
                      placeholder="Dán URL ảnh QR hoặc data:image;base64,…"
                      value={value.payment_qr_url || ""}
                      onChange={(e) => onChange({ ...value, payment_qr_url: e.target.value })}
                    />
                    <label className="inline-flex items-center gap-2 text-sm text-slate-8 00 cursor-pointer">
                      <input type="file" accept="image/*" onChange={handleUploadCustomQR} className="hidden" />
                      <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg ring-1 ring-slate-300 bg-white hover:bg-slate-50">
                        <UploadCloud className="h-4 w-4" /> Tải ảnh QR lên
                      </span>
                    </label>
                  </div>
                  <div className="rounded-xl ring-1 ring-slate-200 bg-white p-2 flex items-center justify-center min-h-[100px]">
                    {value.payment_qr_url
                      ? <img src={value.payment_qr_url} alt="QR preview" className="max-h-44 object-contain" />
                      : <div className="text-xs text-slate-700">Chọn ảnh hoặc dán URL để hiển thị QR</div>}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-white border-t flex items-center justify-end gap-2 sticky bottom-0">
        <Button variant="secondary" onClick={onCancel} className="ring-1 ring-slate-200">Đóng</Button>
        <Button onClick={() => onSave(value)} disabled={saving}
          className="bg-gradient-to-r from-emerald-600 to-sky-600 text-white ring-1 ring-emerald-500">
          {saving ? (<><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Đang lưu…</>) : (<><Check className="h-4 w-4 mr-1" /> Lưu</>)}
        </Button>
      </div>
    </div>
  );
}
