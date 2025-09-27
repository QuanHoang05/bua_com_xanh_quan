// src/admin/AdminPayments.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { apiGet } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { Search, RefreshCw, Download, ChevronLeft, ChevronRight, Eye, Copy, X } from "lucide-react";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const fmt = new Intl.NumberFormat("vi-VN");
const formatVND = (n) => `${fmt.format(Number(n || 0))}đ`;
const formatDateTime = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  return d.toLocaleString("vi-VN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const METHODS = [
  { value: "all", label: "Tất cả phương thức" },
  { value: "momo", label: "MoMo" },
  { value: "vnpay", label: "VNPay" },
  { value: "zalopay", label: "ZaloPay" },
  { value: "vietqr", label: "VietQR" },
  { value: "bank", label: "Chuyển khoản" },
  { value: "cash", label: "Tiền mặt" },
  { value: "other", label: "Khác" },
];
const STATUS_OPTIONS = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "success", label: "Thành công" },
  { value: "pending", label: "Đang chờ" },
  { value: "failed", label: "Thất bại" },
  { value: "canceled", label: "Đã huỷ" },
  { value: "refunded", label: "Đã hoàn" },
];

function StatusBadge({ value }) {
  const v = (value || "").toLowerCase();
  const map = {
    success: { cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", text: "Thành công" },
    pending: { cls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", text: "Đang chờ" },
    failed: { cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200", text: "Thất bại" },
    canceled: { cls: "bg-slate-100 text-slate-700 ring-1 ring-slate-200", text: "Đã huỷ" },
    refunded: { cls: "bg-slate-100 text-slate-700 ring-1 ring-slate-200", text: "Đã hoàn" },
  };
  const m = map[v] || map.pending;
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.cls}`}>{m.text}</span>;
}
function MethodPill({ value }) {
  const v = (value || "").toLowerCase();
  const map = {
    momo: "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200",
    vnpay: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    zalopay: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    vietqr: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    bank: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    cash: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    other: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  };
  const label = v || "unknown";
  return <span className={`px-2 py-1 rounded-full text-xs ${map[v] || "bg-slate-100 text-slate-700 ring-1 ring-slate-200"}`}>{label}</span>;
}
function SourcePill({ src }) {
  if (!src) return null;
  const v = String(src).toLowerCase();
  const map = {
    donation: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    payment: "bg-slate-50 text-slate-700 ring-1 ring-slate-200",
  };
  const label = v === "donation" ? "Donation" : "Payment";
  return <span className={`px-2 py-0.5 rounded-full text-[10px] ${map[v] || map.payment}`}>{label}</span>;
}
function copy(text, t) {
  navigator.clipboard?.writeText(String(text ?? "")).then(
    () => t?.success?.("Đã sao chép"),
    () => t?.error?.("Không sao chép được")
  );
}

export default function AdminPayments() {
  const t = useToast();

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 20, sum_page_amount: 0 });
  const [err, setErr] = useState("");

  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setQDebounced(q.trim()), 350);
    return () => clearTimeout(id);
  }, [q]);

  async function load({ force } = {}) {
    setLoading(true);
    setErr("");
    try {
      const qs = new URLSearchParams({
        q: qDebounced,
        status,
        method,
        date_from: fromDate,
        date_to: toDate,
        page: String(page),
        pageSize: String(pageSize),
        sortBy: "created_at",
        order: "desc",
      }).toString();

      const res = await apiGet(`/api/admin/payments?${qs}${force ? `&_=${Date.now()}` : ""}`);
      const items = Array.isArray(res.items) ? res.items : [];
      setData({
        items,
        total: Number(res.total || 0),
        page,
        pageSize,
        sum_page_amount: Number(res.sum_page_amount || 0),
      });
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Không tải được giao dịch.");
      setData({ items: [], total: 0, page, pageSize, sum_page_amount: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [qDebounced, status, method, fromDate, toDate, page, pageSize]);
  useEffect(() => { load({ force: true }); /* eslint-disable-next-line */ }, []);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(Number(data.total || 0) / Number(pageSize || 20))),
    [data.total, pageSize]
  );

  async function exportCSV() {
    try {
      const qs = new URLSearchParams({
        q: qDebounced,
        status,
        method,
        date_from: fromDate,
        date_to: toDate,
        sortBy: "created_at",
        order: "desc",
      }).toString();

      const token = localStorage.getItem("access_token");
      const res = await fetch(`/api/admin/payments/export?${qs}`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "text/csv", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payments_${fromDate || "start"}_${toDate || "now"}.csv`;
      document.body.appendChild(a);
      a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      t.error("Xuất CSV thất bại hoặc chưa đăng nhập.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Tìm theo mã giao dịch, nội dung, email…"
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
            />
          </div>

          <select className="input lg:w-48" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="input lg:w-56" value={method} onChange={(e) => { setPage(1); setMethod(e.target.value); }}>
            {METHODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <input type="date" className="input" value={fromDate} onChange={(e) => { setPage(1); setFromDate(e.target.value); }} />
            <span className="text-slate-500">→</span>
            <input type="date" className="input" value={toDate} onChange={(e) => { setPage(1); setToDate(e.target.value); }} />
          </div>

          <div className="flex items-center gap-2 lg:ml-auto">
            <label className="text-sm text-slate-600">Hiển thị</label>
            <select className="input w-[90px]" value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
              {[20, 50, 100].map((n) => <option key={n} value={n}>{n}/trang</option>)}
            </select>

            <Button variant="secondary" onClick={() => load({ force: true })} disabled={loading} title="Tải lại">
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Làm mới
            </Button>

            <Button variant="ghost" onClick={exportCSV} title="Xuất CSV" disabled={!data.items?.length}>
              <Download className="h-4 w-4 mr-1" />
              Xuất CSV
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
          <div>Tổng giao dịch: <b className="text-slate-800">{fmt.format(Number(data.total || 0))}</b></div>
          <div>Tổng tiền (trang hiện tại): <b className="text-emerald-700">
            {formatVND((data.items || []).reduce((a, b) => a + Number(b.amount || 0), 0))}
          </b></div>
          {Number(data.sum_page_amount) > 0 && (
            <div>Tổng tiền (theo bộ lọc): <b className="text-emerald-700">{formatVND(data.sum_page_amount)}</b></div>
          )}
        </div>
      </Card>

      {err && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">{err}</div>}

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Đang tải…</div>
        ) : !data.items?.length ? (
          <Empty title="Không có giao dịch" subtitle="Hãy thay đổi bộ lọc hoặc thử làm mới." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-left">
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Thời gian</th>
                    <th className="px-3 py-2">Người trả</th>
                    <th className="px-3 py-2">Chiến dịch</th>
                    <th className="px-3 py-2">Số tiền</th>
                    <th className="px-3 py-2">Phương thức</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2 w-[220px]">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={String(p.id)} className="border-t hover:bg-emerald-50/30 transition-colors">
                      <td className="px-3 py-2 font-medium text-slate-800 break-all">
                        <div className="flex items-center gap-2">
                          <span>{p.id}</span>
                          <SourcePill src={p.src} />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{formatDateTime(p.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.payer_name || p.donor_name || p.payer_id || p.user_id || "—"}</span>
                          {(p.payer_id || p.user_id) ? (
                            <Button variant="ghost" size="sm" title="Copy payer_id" onClick={() => copy(p.payer_id || p.user_id, t)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">{p.campaign_title || p.campaign_id || "—"}</td>
                      <td className="px-3 py-2 font-semibold">{formatVND(p.amount)}</td>
                      <td className="px-3 py-2"><MethodPill value={p.method} /></td>
                      <td className="px-3 py-2"><StatusBadge value={p.status} /></td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => setDetail(p)}>
                            <Eye className="h-4 w-4 mr-1" /> Chi tiết
                          </Button>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">Ref: {p.reference || p.txid || "—"}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t px-4 py-3 bg-white">
              <div className="text-sm text-slate-600">
                Trang <span className="font-medium text-slate-800">{data.page}</span> / {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => { const p = clamp(data.page - 1, 1, totalPages); if (p !== data.page) setPage(p); }} disabled={data.page <= 1}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Trước
                </Button>
                <Button onClick={() => { const p = clamp(data.page + 1, 1, totalPages); if (p !== data.page) setPage(p); }} disabled={data.page >= totalPages}>
                  Sau <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {detail && <DetailModal payment={detail} onClose={() => setDetail(null)} onCopy={(v) => copy(v, t)} />}
    </div>
  );
}

function DetailModal({ payment, onClose, onCopy }) {
  const overlayRef = useRef(null);
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const p = payment || {};

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
    >
      <div className="w-[min(92vw,860px)] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        <div className="p-5 border-b flex items-start justify-between">
          <div>
            <div className="text-lg font-semibold">Chi tiết giao dịch #{p.id}</div>
            <div className="text-sm text-slate-500">
              {formatDateTime(p.created_at)} • <StatusBadge value={p.status} />
              {p.src ? <span className="ml-2"><span className="align-middle"><SourcePill src={p.src} /></span></span> : null}
            </div>
          </div>
          <Button variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="font-medium mb-2">Thông tin chính</div>
            <div className="space-y-2 text-sm">
              <Row label="Số tiền" value={formatVND(p.amount)} />
              <Row label="Phương thức" value={<MethodPill value={p.method} />} />
              <Row label="Chiến dịch" value={p.campaign_title || p.campaign_id || "—"} />
              <Row label="Người trả" value={p.payer_name || p.donor_name || p.payer_id || p.user_id || "—"} />
              <Row label="Mã tham chiếu" value={p.reference || p.txid || "—"} copy />
              {p.src ? <Row label="Nguồn" value={<SourcePill src={p.src} />} /> : null}
            </div>
          </Card>

          <Card className="p-4">
            <div className="font-medium mb-2">Metadata</div>
            <pre className="text-xs bg-slate-50 rounded-lg p-3 overflow-auto max-h-64">
              {JSON.stringify(p.metadata || p.raw || p, null, 2)}
            </pre>
          </Card>
        </div>

        <div className="p-4 border-t text-xs text-slate-500">
          Nếu bạn tích hợp webhook cổng thanh toán, hãy chắc endpoint admin cập nhật đúng trạng thái (success/failed/refunded).
        </div>
      </div>
    </div>
  );

  function Row({ label, value, copy }) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="text-slate-500">{label}</div>
        <div className="flex items-center gap-2">
          <div className="text-slate-800">{value}</div>
          {copy && (
            <Button variant="ghost" size="sm" onClick={() => onCopy?.(typeof value === "string" ? value : (payment.reference || payment.txid))}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }
}
