// frontend/src/pages/AdminDeliveries.jsx
// Admin Deliveries: monitor + quản lý khiếu nại/báo cáo.
// - Danh sách & lọc
// - Xem chi tiết đơn, timeline (placeholder)
// - Báo cáo: xem, lọc, cập nhật trả lời & trạng thái

import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Empty from "../components/ui/Empty";
import { useToast } from "../components/ui/Toast";
import { apiGet, apiPatch } from "../lib/api";
import {
  Search,
  RotateCw,
  ClipboardList,
  Clock3,
  ChevronRight,
  Copy,
  Save,
  CheckCircle2,
  XCircle,
} from "lucide-react";

/* ===================== Small UI helpers ===================== */
const Pill = ({ tone = "slate", children }) => {
  const map = {
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${
        map[tone] || map.slate
      }`}
    >
      {children}
    </span>
  );
};

const StatusPill = ({ value }) => {
  const tone =
    value === "pending"
      ? "amber"
      : value === "assigned"
      ? "sky"
      : value === "picking"
      ? "violet"
      : value === "delivered"
      ? "emerald"
      : value === "cancelled"
      ? "rose"
      : "slate";
  return <Pill tone={tone}>{value}</Pill>;
};

const ReportStatusPill = ({ s }) => {
  const tone =
    s === "resolved"
      ? "emerald"
      : s === "rejected"
      ? "rose"
      : s === "in_progress"
      ? "sky"
      : s === "reviewing"
      ? "indigo"
      : "amber"; // open/closed → amber/slate
  return <Pill tone={tone}>{s}</Pill>;
};

const Dot = ({ ok, className = "" }) => (
  <span
    title={ok ? "Online" : "Offline"}
    className={[
      "inline-block h-2.5 w-2.5 rounded-full border",
      ok ? "bg-emerald-500 border-emerald-600" : "bg-slate-300 border-slate-400",
      className,
    ].join(" ")}
  />
);

/* ===================== Drawer (Detail) ===================== */
function Drawer({ open, onClose, children, title, subtitle, actions }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid grid-cols-[1fr_auto]">
      <div className="bg-black/40" onClick={onClose} />
      <div className="w-[920px] max-w-[98vw] h-full bg-white shadow-2xl border-l border-slate-200 animate-[slideIn_.15s_ease]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <div className="text-lg font-bold">{title}</div>
            {subtitle ? <div className="text-xs text-slate-500">{subtitle}</div> : null}
          </div>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
        <div className="p-5 overflow-y-auto h-[calc(100vh-56px)]">{children}</div>
      </div>
    </div>
  );
}

/* ===================== Page ===================== */
export default function AdminDeliveries() {
  const t = useToast();
  const [status, setStatus] = useState("active"); // active = pending|assigned|picking
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);

  // drawer state
  const [drawer, setDrawer] = useState({
    open: false,
    id: null,
    data: null,
    loading: false,
    reports: [],
    reportsLoading: false,
    reportFilter: "all",
  });

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    sp.set("page", String(page));
    sp.set("page_size", String(pageSize));
    return `?${sp.toString()}`;
  }, [status, q, page, pageSize]);

  async function load() {
    setLoading(true);
    try {
      const res = await apiGet(`/api/admin/deliveries${query}`);
      const arr = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
      setItems(arr);
      setTotal(Number(res?.total ?? arr.length ?? 0));
    } catch (e) {
      console.error(e);
      t.error("Không tải được danh sách giao hàng");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(); /* eslint-disable-line */
  }, [status, q, page, pageSize]);

  // auto refresh when viewing active
  const timerRef = useRef(null);
  useEffect(() => {
    if (!auto || status !== "active") return;
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(load, 5000);
    return () => timerRef.current && clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, status, query]);

  async function fetchDetail(id) {
    setDrawer((s) => ({ ...s, loading: true, reportsLoading: true, open: true, id }));
    try {
      const data = await apiGet(`/api/admin/deliveries/${id}`);
      let reports = [];
      try {
        const res = await apiGet(`/api/deliveries/${id}/reports?mine=1`);
        reports = Array.isArray(res?.items) ? res.items : [];
      } catch (e) {
        console.warn("load reports failed:", e);
      }
      setDrawer((s) => ({
        ...s,
        data,
        loading: false,
        reports,
        reportsLoading: false,
      }));
    } catch (e) {
      t.error("Không tải được chi tiết đơn");
      setDrawer((s) => ({ ...s, loading: false, reportsLoading: false }));
    }
  }

  /* ==================== Reports helpers ==================== */
  const REPORT_STATUSES = [
    "open",
    "reviewing",
    "in_progress",
    "resolved",
    "rejected",
    "closed",
  ];

  function filteredReports() {
    if (!drawer.reports?.length) return [];
    if (drawer.reportFilter === "all") return drawer.reports;
    return drawer.reports.filter((r) => r.status === drawer.reportFilter);
  }

  function countByStatus() {
    const counts = Object.fromEntries(["all", ...REPORT_STATUSES].map((k) => [k, 0]));
    for (const r of drawer.reports) {
      counts.all++;
      counts[r.status] = (counts[r.status] || 0) + 1;
    }
    return counts;
  }

  async function saveReport(rid, reply, statusNext) {
    try {
      await apiPatch(`/api/deliveries/${drawer.id}/reports/${rid}/reply`, {
        reply,
        status: statusNext || undefined,
      });
      t.success("Đã cập nhật báo cáo");

      // refresh reports
      const res = await apiGet(`/api/deliveries/${drawer.id}/reports?mine=1`);
      setDrawer((s) => ({ ...s, reports: Array.isArray(res?.items) ? res.items : [] }));
    } catch (e) {
      console.error(e);
      t.error("Cập nhật báo cáo thất bại");
    }
  }

  function ReportCard({ r }) {
    const [reply, setReply] = useState(r.admin_reply || r.admin_note || "");
    const [saving, setSaving] = useState(false);
    const createdAt = r.created_at ? new Date(r.created_at).toLocaleString() : "—";
    const updatedAt = r.updated_at ? new Date(r.updated_at).toLocaleString() : "—";

    const copyText = async () => {
      try {
        await navigator.clipboard.writeText(
          `# Report ${r.id}\nType: ${r.type}\nStatus: ${r.status}\nBy: ${r.reporter_name || r.reporter_id || "—"}\n\n${r.details || r.content || ""}`
        );
        t.success("Đã copy nội dung");
      } catch {
        t.error("Không copy được");
      }
    };

    const action = async (statusNext) => {
      setSaving(true);
      await saveReport(r.id, reply, statusNext);
      setSaving(false);
    };

    return (
      <Card className="p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                {r.type} <ChevronRight className="h-3.5 w-3.5" />
                <ReportStatusPill s={r.status} />
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Người báo: <b>{r.reporter_name || r.reporter_id || "—"}</b>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" onClick={copyText} title="Copy nội dung">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {r.details || r.content ? (
            <div className="text-sm text-slate-800 whitespace-pre-wrap">{r.details || r.content}</div>
          ) : (
            <div className="text-sm text-slate-500 italic">Không có mô tả chi tiết.</div>
          )}

          {!!r.images?.length && (
            <div className="flex flex-wrap gap-2 mt-1">
              {r.images.map((src, i) => (
                <a
                  key={i}
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-28 h-20 rounded-lg border bg-slate-50 overflow-hidden"
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}

          {/* Admin reply box */}
          <div className="mt-2 grid gap-2">
            <label className="text-xs font-medium text-slate-600">Phản hồi / ghi chú admin</label>
            <textarea
              className="input min-h-[84px] resize-y"
              placeholder="Nhập ghi chú/huớng xử lý…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="input w-48"
                defaultValue={r.status}
                onChange={(e) => action(e.target.value)}
                title="Đổi trạng thái"
              >
                {REPORT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <Button onClick={() => action()} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                Lưu ghi chú
              </Button>

              <Button
                variant="secondary"
                onClick={() => action("resolved")}
                disabled={saving}
                title="Đánh dấu đã xử lý"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Đã xử lý
              </Button>

              <Button
                variant="danger"
                onClick={() => action("rejected")}
                disabled={saving}
                title="Từ chối báo cáo"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Từ chối
              </Button>
            </div>
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Tạo: {createdAt} • Cập nhật: {updatedAt}
          </div>
        </div>
      </Card>
    );
  }

  /* ==================== Render ==================== */
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="active">Đang hoạt động</option>
          <option value="pending">Chờ xử lý</option>
          <option value="assigned">Đã gán</option>
          <option value="picking">Đang lấy</option>
          <option value="delivered">Hoàn tất</option>
          <option value="cancelled">Huỷ</option>
          <option value="all">Tất cả</option>
        </select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="input w-72 pl-9"
            placeholder="Tìm ID / booking / địa chỉ…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 select-none">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Tự làm mới 5s (khi đang hoạt động)
          </label>
          <Button onClick={load}>
            <RotateCw className="h-4 w-4 mr-1" /> Làm mới
          </Button>
        </div>
      </div>

      {/* List */}
      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Đang tải…</div>
        ) : !items.length ? (
          <Empty
            title="Không có đơn phù hợp"
            subtitle="Khi admin gán shipper ở trang Booking, đơn sẽ hiển thị tại đây để theo dõi."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white/85 backdrop-blur border-b">
              <tr className="text-left">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Booking</th>
                <th className="px-3 py-2">Pickup → Dropoff</th>
                <th className="px-3 py-2">Shipper</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2 w-[220px]">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-t hover:bg-emerald-50/40 transition-colors">
                  <td className="px-3 py-2 font-mono text-xs">{d.id}</td>
                  <td className="px-3 py-2 font-mono text-xs">{d.booking_id}</td>
                  <td className="px-3 py-2 truncate max-w-[420px]">
                    {(d.pickup_name || d.pickup_address) || "—"}
                    <span className="mx-1 text-slate-400">→</span>
                    {(d.dropoff_name || d.dropoff_address) || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Dot ok={!!d.shipper_online} />
                      <span>{d.shipper_name || d.shipper_id || <i>chưa gán</i>}</span>
                      {d.shipper_phone ? <span className="text-slate-500">• {d.shipper_phone}</span> : null}
                      {d.shipper_busy ? <Pill tone="indigo">đang giao</Pill> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill value={d.status} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="secondary" onClick={() => fetchDetail(d.id)}>
                        <ClipboardList className="h-4 w-4 mr-1" /> Chi tiết
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-slate-500">Tổng: {total}</span>
        <select
          className="input w-24"
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
        >
          {[10, 20, 30, 50].map((n) => (
            <option key={n} value={n}>
              {n}/trang
            </option>
          ))}
        </select>
        <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          ← Trước
        </Button>
        <span className="px-2">Trang {page}</span>
        <Button
          variant="secondary"
          disabled={items.length < pageSize && total <= page * pageSize}
          onClick={() => setPage((p) => p + 1)}
        >
          Sau →
        </Button>
      </div>

      {/* Drawer: Detail + Reports */}
      <Drawer
        open={drawer.open}
        onClose={() =>
          setDrawer({
            open: false,
            id: null,
            data: null,
            loading: false,
            reports: [],
            reportsLoading: false,
            reportFilter: "all",
          })
        }
        title={drawer.data ? `Delivery #${drawer.data.id}` : "Chi tiết đơn"}
        subtitle={drawer.data ? `Booking ${drawer.data.booking_id || "—"}` : ""}
        actions={drawer.data ? <StatusPill value={drawer.data.status} /> : null}
      >
        {drawer.loading ? (
          <div className="text-sm text-slate-500">Đang tải chi tiết…</div>
        ) : !drawer.data ? null : (
          <div className="space-y-5">
            {/* Info blocks */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="text-xs text-slate-500">Shipper</div>
                <div className="mt-1 flex items-center gap-2">
                  <Dot ok={!!drawer.data.shipper_online} />
                  <div className="font-semibold">
                    {drawer.data.shipper_name || drawer.data.shipper_id || "—"}
                  </div>
                  {drawer.data.shipper_phone ? (
                    <div className="text-slate-500">• {drawer.data.shipper_phone}</div>
                  ) : null}
                </div>
                <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" /> Cập nhật:{" "}
                  {drawer.data.updated_at ? new Date(drawer.data.updated_at).toLocaleString() : "—"}
                </div>
              </Card>

              <Card className="p-4">
                <div className="text-xs text-slate-500">Lộ trình</div>
                <div className="mt-1 text-sm">
                  <b>Pickup:</b> {drawer.data.pickup_name || drawer.data.pickup_address || "—"}
                </div>
                <div className="text-sm">
                  <b>Dropoff:</b> {drawer.data.dropoff_name || drawer.data.dropoff_address || "—"}
                </div>
                {drawer.data.note ? (
                  <div className="mt-2 text-sm text-slate-600">
                    <b>Ghi chú:</b> {drawer.data.note}
                  </div>
                ) : null}
              </Card>
            </div>

            {/* Events timeline (placeholder) */}
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3">Dòng thời gian</div>
              {!drawer.data?.events?.length ? (
                <div className="text-sm text-slate-500">Chưa có sự kiện.</div>
              ) : (
                <div className="space-y-2">
                  {drawer.data.events.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="mt-1">
                        <Dot ok />
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{ev.event}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(ev.created_at || ev.time || Date.now()).toLocaleString()}
                        </div>
                        {ev.meta ? (
                          <div className="text-xs text-slate-600 mt-1">{JSON.stringify(ev.meta)}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Reports */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold flex items-center gap-2">
                  Khiếu nại / Báo cáo <ChevronRight className="h-3.5 w-3.5" />
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const c = countByStatus();
                    return (
                      <>
                        <Pill tone="slate">Tổng: {c.all}</Pill>
                        <select
                          className="input h-8"
                          value={drawer.reportFilter}
                          onChange={(e) =>
                            setDrawer((s) => ({ ...s, reportFilter: e.target.value }))
                          }
                        >
                          <option value="all">Tất cả ({c.all})</option>
                          {REPORT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s} ({c[s] || 0})
                            </option>
                          ))}
                        </select>
                      </>
                    );
                  })()}
                </div>
              </div>

              {drawer.reportsLoading ? (
                <div className="text-sm text-slate-500">Đang tải báo cáo…</div>
              ) : !filteredReports().length ? (
                <div className="text-sm text-slate-500">Chưa có khiếu nại.</div>
              ) : (
                <div className="space-y-3">
                  {filteredReports().map((r) => (
                    <ReportCard key={r.id} r={r} />
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
}
