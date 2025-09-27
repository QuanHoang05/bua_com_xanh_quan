// src/pages/AdminUsers.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";
import {
  Search, RefreshCcw, Crown, Loader2, Mail, Shield,
  ShieldQuestion, Filter, Edit3, Trash2, Ban, Unlock,
  FileSearch, UserCog, Check, X, Users as UsersIcon, Wifi, WifiOff,
  Download, UploadCloud, ListFilter, Eye, EyeOff, CalendarClock, KeyRound, Send, UserRoundCheck
} from "lucide-react";
import { useToast } from "../components/ui/Toast";

/* ========= Constants ========= */
const ROLE_OPTIONS   = ["all", "user", "donor", "receiver", "shipper", "admin"];
const STATUS_OPTIONS = ["all", "active", "banned", "deleted"];
const EXTRA_ROLES    = ["donor", "receiver", "shipper"];
const DEFAULT_COLUMNS = [
  { key: "user",        label: "User",        width: "minmax(280px,1.2fr)",  fixed: true,  default: true },
  { key: "role",        label: "Role",        width: "140px",                 default: true },
  { key: "extraRoles",  label: "Extra roles", width: "220px",                 default: true },
  { key: "status",      label: "Status",      width: "120px",                 default: true },
  { key: "created_at",  label: "Created",     width: "160px",                 default: false },
  { key: "last_login",  label: "Last login",  width: "160px",                 default: false },
  { key: "actions",     label: "Actions",     width: "minmax(260px,0.8fr)",  fixed: true,  default: true },
];

/* ======== PAGE ======== */
export default function AdminUsers() {
  /* -------- Filters, paging, sort -------- */
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [order, setOrder] = useState("desc");

  const [data, setData] = useState({ items: [], total: 0, page: 1, pageSize: 10 });
  const [stats, setStats] = useState(null); // {total, active, banned, deleted}
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [refreshing, setRefreshing] = useState(false);
  const [rowBusy, setRowBusy] = useState(null);

  const [selected, setSelected] = useState([]);
  const [editU, setEditU] = useState(null);
  const [logU, setLogU] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [eta, setEta] = useState(0);

  const [columns, setColumns] = useState(() => {
    const saved = localStorage.getItem("admin_users_columns");
    if (saved) return JSON.parse(saved);
    return DEFAULT_COLUMNS.map(c => ({ ...c, visible: c.default !== false }));
  });

  const deb = useRef(null);
  const ctlRef = useRef(null);
  const firstLoadedRef = useRef(false);
  const t = useToast();

  const nf = useMemo(() => new Intl.NumberFormat("vi-VN"), []);
  const totalPages = useMemo(() => Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || 10))), [data.total, data.pageSize]);
  const showingFrom = useMemo(() => (data.total ? (data.page - 1) * data.pageSize + 1 : 0), [data.page, data.pageSize, data.total]);
  const showingTo   = useMemo(() => Math.min(data.total || 0, data.page * (data.pageSize || 10)), [data.page, data.pageSize, data.total]);
  const visibleCols = useMemo(() => columns.filter(c => c.visible), [columns]);

  /* ====== Load ====== */
  async function load({ page = 1, pageSize = data.pageSize, origin = "manual" } = {}) {
    if (ctlRef.current) ctlRef.current.abort();
    const ctl = new AbortController();
    ctlRef.current = ctl;

    try {
      setErr("");
      if (origin === "manual") setLoading(true);

      const qs = new URLSearchParams({
        q,
        page: String(page),
        pageSize: String(pageSize),
        sortBy,
        order,
      });
      if (role !== "all") qs.set("role", role);
      if (status !== "all") qs.set("status", status);

      const res = await apiGet(`/api/admin/users?${qs.toString()}`, { signal: ctl.signal });
      // backend có thể trả kèm stats
      if (res?.stats) setStats(res.stats);
      setData({ items: res.items || [], total: res.total || 0, page, pageSize });
      setSelected([]);
      if (origin === "manual") t.success(`Đã tải ${nf.format(res.total || 0)} người dùng`);
      firstLoadedRef.current = true;

      // Thử fetch stats riêng nếu chưa có
      if (!res?.stats) {
        try {
          const s = await apiGet(`/api/admin/users/stats`, { signal: ctl.signal });
          if (s) setStats(s);
        } catch {}
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
      const msg = e?.message || "Load users failed";
      setErr(msg);
      t.error(`Không tải được danh sách: ${msg}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load({ page: 1, pageSize: data.pageSize, origin: "init" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (deb.current) clearTimeout(deb.current);
    deb.current = setTimeout(() => load({ page: 1, pageSize: data.pageSize, origin: "debounce" }), 350);
    return () => clearTimeout(deb.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role, status, sortBy, order]);

  useEffect(() => {
    if (!autoRefresh) return;
    setEta(20);
    const tick = setInterval(() => setEta((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(tick);
  }, [autoRefresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    if (eta === 0) {
      load({ page: data.page, pageSize: data.pageSize, origin: "auto" });
      setEta(20);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eta, autoRefresh]);

  /* ====== Selection ====== */
  function toggleSelectAll(checked) {
    if (checked) setSelected(data.items.map((u) => u.id));
    else setSelected([]);
  }
  function toggleOne(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  /* ====== Row ops ====== */
  async function setStatusOne(id, next) {
    if (!id) return;
    try {
      setRowBusy(id);
      await apiPatch(`/api/admin/users/${id}`, { status: next });
      t.success(`Đã chuyển trạng thái sang "${next}"`);
      await load({ page: data.page, pageSize: data.pageSize, origin: "silent-after-action" });
    } catch (e) {
      t.error(e?.message || "Cập nhật trạng thái thất bại");
    } finally {
      setRowBusy(null);
    }
  }

  async function deleteOne(id) {
    if (!id) return;
    if (!confirm("Xoá vĩnh viễn user này? Hành động không thể hoàn tác.")) return;
    try {
      setRowBusy(id);
      await apiDelete(`/api/admin/users/${id}`);
      t.success("Đã xoá người dùng");
      await load({ page: 1, pageSize: data.pageSize, origin: "silent-after-action" });
    } catch (e) {
      t.error(e?.message || "Xoá thất bại");
    } finally {
      setRowBusy(null);
    }
  }

  async function makeAdmin(id) {
    if (!confirm("Nâng quyền Admin cho người dùng này?")) return;
    try {
      setRowBusy(id);
      const u = data.items.find((x) => x.id === id);
      const extras = normalizeExtras(u);
      const nextRoles = ["admin", ...extras.filter((x) => x !== "admin")];
      await apiPatch(`/api/admin/users/${id}`, { roles: nextRoles });
      t.success("Đã đặt Admin (giữ vai trò phụ)");
      await load({ page: data.page, pageSize: data.pageSize, origin: "silent-after-action" });
    } catch (e) {
      t.error(e?.message || "Nâng quyền thất bại");
    } finally {
      setRowBusy(null);
    }
  }

  async function resetPassword(u) {
    if (!confirm(`Reset mật khẩu cho ${u.email}?`)) return;
    try {
      setRowBusy(u.id);
      const res = await apiPost(`/api/admin/users/${u.id}/reset-password`, {});
      const temp = res?.tempPassword || "******";
      t.success(`Mật khẩu tạm: ${temp}`);
      alert(`Mật khẩu tạm cho ${u.email}: ${temp}`);
    } catch (e) {
      t.error(e?.message || "Reset mật khẩu thất bại");
    } finally {
      setRowBusy(null);
    }
  }

  async function resendVerify(u) {
    try {
      setRowBusy(u.id);
      await apiPost(`/api/admin/users/${u.id}/resend-verify`, {});
      t.success("Đã gửi lại email xác thực");
    } catch (e) {
      t.error(e?.message || "Gửi email xác thực thất bại");
    } finally {
      setRowBusy(null);
    }
  }

  async function impersonate(u) {
    if (!confirm(`Đăng nhập giả lập (impersonate) tài khoản ${u.email}?`)) return;
    try {
      setRowBusy(u.id);
      const res = await apiPost(`/api/admin/users/${u.id}/impersonate`, {});
      const token = res?.token;
      if (token) {
        // ví dụ: lưu token và chuyển trang
        localStorage.setItem("impersonate_token", token);
        window.location.href = "/"; // hoặc route dashboard của user
      } else {
        t.error("Không nhận được token");
      }
    } catch (e) {
      t.error(e?.message || "Impersonate thất bại");
    } finally {
      setRowBusy(null);
    }
  }

  async function openLogs(u) {
    setLogU(u);
    setLogs([]);
    setLogsLoading(true);
    try {
      const res = await apiGet(`/api/admin/audit?actor=${encodeURIComponent(u.id)}&pageSize=30&page=1`);
      const rows = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
      setLogs(rows);
    } catch (e) {
      setLogs([{ id: "err", action: e?.message || "Load audit failed", created_at: new Date().toISOString() }]);
      t.error(e?.message || "Không tải được audit log");
    } finally {
      setLogsLoading(false);
    }
  }

  /* ====== Bulk ====== */
  async function bulkStatus(next) {
    if (!selected.length) return;
    if (!confirm(`Áp dụng trạng thái "${next}" cho ${selected.length} user?`)) return;
    let ok = 0, fail = 0;
    for (const id of selected) {
      try { await apiPatch(`/api/admin/users/${id}`, { status: next }); ok++; } catch { fail++; }
    }
    await load({ page: data.page, pageSize: data.pageSize, origin: "silent-after-action" });
    if (fail === 0) t.success(`Đã cập nhật ${ok}/${selected.length} user`);
    else t.error(`Hoàn tất: ${ok} thành công, ${fail} lỗi`);
  }

  async function bulkDelete() {
    if (!selected.length) return;
    if (!confirm(`Xoá ${selected.length} user? Hành động không thể hoàn tác.`)) return;
    let ok = 0, fail = 0;
    for (const id of selected) {
      try { await apiDelete(`/api/admin/users/${id}`); ok++; } catch { fail++; }
    }
    await load({ page: 1, pageSize: data.pageSize, origin: "silent-after-action" });
    if (fail === 0) t.success(`Đã xoá ${ok}/${selected.length} user`);
    else t.error(`Hoàn tất: ${ok} thành công, ${fail} lỗi`);
  }

  async function bulkExport() {
    try {
      const qs = new URLSearchParams({
        q, sortBy, order,
        role: role === "all" ? "" : role,
        status: status === "all" ? "" : status,
      });
      if (selected.length) qs.set("ids", selected.join(","));
      const blob = await apiGetBlob(`/api/admin/users/export?${qs.toString()}`);
      downloadBlob(blob, `users_${new Date().toISOString().slice(0,10)}.csv`);
      t.success("Đã xuất CSV");
    } catch (e) {
      t.error(e?.message || "Xuất CSV thất bại");
    }
  }

  async function handleImport(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      setRefreshing(true);
      const res = await apiPost(`/api/admin/users/import`, fd, { headers: { "Content-Type": undefined } });
      const ok = res?.inserted || 0, dup = res?.duplicated || 0, fail = res?.failed || 0;
      t.success(`Import xong: ${ok} thêm mới, ${dup} trùng, ${fail} lỗi`);
      await load({ page: 1, pageSize: data.pageSize, origin: "manual" });
    } catch (e) {
      t.error(e?.message || "Import thất bại");
    } finally {
      setRefreshing(false);
    }
  }

  /* ====== Columns manager ====== */
  function toggleColumn(key) {
    const next = columns.map(c => c.key === key ? { ...c, visible: !c.visible } : c);
    setColumns(next);
    localStorage.setItem("admin_users_columns", JSON.stringify(next));
  }

  function setAllColumns(v) {
    const next = columns.map(c => c.fixed ? { ...c, visible: true } : { ...c, visible: v });
    setColumns(next);
    localStorage.setItem("admin_users_columns", JSON.stringify(next));
  }

  function onHeaderSort(k) {
    // map key -> backend sort field
    const map = { user: "name", role: "role", status: "status", created_at: "created_at", last_login: "last_login" };
    const field = map[k] || "created_at";
    if (sortBy === field) setOrder(o => (o === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setOrder("asc"); }
  }

  /* ====== Render ====== */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-emerald-200/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 size-40 rounded-full bg-teal-200/25 blur-3xl" />
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Users</h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-800">
              <UsersIcon className="h-3.5 w-3.5" />
              Directory
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                autoRefresh ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              }`}
              title="Bật/tắt tự động làm mới"
            >
              {autoRefresh ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4 text-slate-600" />}
              {autoRefresh ? `Tự làm mới (${eta}s)` : "Tự làm mới: tắt"}
            </button>

            <button
              onClick={() => { setRefreshing(true); load({ page: data.page, pageSize: data.pageSize, origin: "manual" }); }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 active:scale-[.98] transition"
              disabled={refreshing || loading}
              title="Làm mới"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <a
              href="/admin/reports"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              title="Xử lý báo cáo & khiếu nại"
            >
              <FileSearch className="h-4 w-4" />
              Reports
            </a>
          </div>
        </div>

        {/* Quick stats */}
        {stats && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ChipStat label="Tổng"     value={nf.format(stats.total || 0)}    />
            <ChipStat label="Active"   value={nf.format(stats.active || 0)}   tone="emerald" />
            <ChipStat label="Banned"   value={nf.format(stats.banned || 0)}   tone="rose" />
            <ChipStat label="Deleted"  value={nf.format(stats.deleted || 0)}  tone="slate" />
          </div>
        )}

        {/* Filters */}
        <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative w-full max-w-[360px]">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-0"
                placeholder="Tìm tên / email…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load({ page: 1, pageSize: data.pageSize, origin: "manual" })}
              />
            </div>

            <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
              <Filter className="h-4 w-4 text-slate-600" />
              <select
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-500"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r === "all" ? "Tất cả vai trò" : r}</option>)}
              </select>
              <select
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-500"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === "all" ? "Tất cả trạng thái" : s}</option>)}
              </select>

              {/* sort */}
              <select
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                title="Sắp xếp theo"
              >
                <option value="created_at">Created</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="last_login">Last login</option>
                <option value="role">Role</option>
                <option value="status">Status</option>
              </select>
              <select
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-500"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                title="Thứ tự"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>

            {/* Column manager */}
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
              <ListFilter className="h-4 w-4 text-slate-600" />
              <button className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs hover:bg-slate-50" onClick={() => setAllColumns(true)}>
                <Eye className="mr-1 inline h-3.5 w-3.5" /> Hiện tất cả
              </button>
              <button className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs hover:bg-slate-50" onClick={() => setAllColumns(false)}>
                <EyeOff className="mr-1 inline h-3.5 w-3.5" /> Ẩn tất cả
              </button>
              {columns.map(c => (
                <label key={c.key} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs">
                  <input type="checkbox" checked={c.visible} onChange={() => toggleColumn(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Import */}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              <UploadCloud className="h-4 w-4" />
              Import
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => handleImport(e.target.files?.[0])}
              />
            </label>
            {/* Export */}
            <button
              onClick={bulkExport}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            {/* page size */}
            <select
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
              value={data.pageSize}
              onChange={(e) => load({ page: 1, pageSize: Number(e.target.value), origin: "manual" })}
            >
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}/trang</option>)}
            </select>
          </div>
        </div>

        {err && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">Không tải được dữ liệu</div>
              <div className="text-sm">{err}</div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-800">
            Đã chọn {nf.format(selected.length)}
          </span>
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50" onClick={() => bulkStatus("banned")} title="Khoá (ban)">
            <Ban className="mr-1 inline h-4 w-4" /> Khoá
          </button>
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50" onClick={() => bulkStatus("active")} title="Mở khoá">
            <Unlock className="mr-1 inline h-4 w-4" /> Mở khoá
          </button>
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50" onClick={bulkExport} title="Xuất CSV">
            <Download className="mr-1 inline h-4 w-4" /> Export CSV
          </button>
          <button className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-100" onClick={bulkDelete} title="Xoá">
            <Trash2 className="mr-1 inline h-4 w-4" /> Xoá
          </button>
        </div>
      )}

      {/* Table */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading && !data.items.length ? (
          <SkeletonTable />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <colgroup>
                <col style={{ width: "46px" }} />
                {visibleCols.map(c => <col key={c.key} style={{ width: c.width || "auto" }} />)}
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={data.items.length > 0 && selected.length === data.items.length}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                  </th>
                  {visibleCols.map((c) => (
                    <th key={c.key} className="px-3 py-2">
                      <button
                        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-[13px] font-semibold text-slate-800"
                        onClick={() => onHeaderSort(c.key)}
                        title={`Sắp xếp theo ${c.label}`}
                      >
                        {c.label}
                        {sortIcon(sortBy, order, c.key)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {data.items.map((u) => {
                  const extras = normalizeExtras(u);
                  return (
                    <tr key={u.id} className="border-b border-slate-200 last:border-0">
                      {/* checkbox */}
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selected.includes(u.id)}
                          onChange={() => toggleOne(u.id)}
                        />
                      </td>

                      {/* dynamic cells */}
                      {visibleCols.map(col => {
                        if (col.key === "user") {
                          return (
                            <td key={col.key} className="px-3 py-2">
                              <div className="flex items-center gap-3">
                                <Avatar url={u.avatar_url} name={u.name || u.email} />
                                <div className="space-y-1">
                                  <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-2 py-0.5 font-medium text-slate-900">
                                    {u.name || "—"}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs">
                                    <span className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-slate-800">
                                      <Mail className="h-3.5 w-3.5 text-slate-600" />
                                      <a href={`mailto:${u.email}`} className="hover:underline">{u.email}</a>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          );
                        }
                        if (col.key === "role") return <td key={col.key} className="px-3 py-2"><RoleBadge role={u.role} /></td>;
                        if (col.key === "extraRoles") {
                          return (
                            <td key={col.key} className="px-3 py-2">
                              <div className="flex flex-wrap gap-1.5">
                                {EXTRA_ROLES.map((r) => {
                                  const active = extras.includes(r);
                                  return (
                                    <ToggleChip
                                      key={r}
                                      active={active}
                                      label={r}
                                      onToggle={async (next) => {
                                        try {
                                          setRowBusy(u.id);
                                          let nextExtras = active ? extras.filter((x) => x !== r) : Array.from(new Set([...extras, r]));
                                          nextExtras = nextExtras.filter((x) => x !== u.role);
                                          const nextRoles = [u.role, ...nextExtras];
                                          await apiPatch(`/api/admin/users/${u.id}`, { roles: nextRoles });
                                          t.success(`Đã ${next ? "bật" : "tắt"} vai trò "${r}"`);
                                          await load({ page: data.page, pageSize: data.pageSize, origin: "silent-after-action" });
                                        } catch (e) {
                                          t.error(e?.message || "Cập nhật vai trò phụ thất bại");
                                        } finally {
                                          setRowBusy(null);
                                        }
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            </td>
                          );
                        }
                        if (col.key === "status") return <td key={col.key} className="px-3 py-2"><StatusBadge status={u.status} /></td>;
                        if (col.key === "created_at") return <td key={col.key} className="px-3 py-2"><TimeBadge value={u.created_at} /></td>;
                        if (col.key === "last_login") return <td key={col.key} className="px-3 py-2"><TimeBadge value={u.last_login} empty="—" /></td>;
                        if (col.key === "actions") {
                          return (
                            <td key={col.key} className="px-3 py-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {u.role !== "admin" && (
                                  <BtnGhost onClick={() => makeAdmin(u.id)} title="Set Admin">
                                    {rowBusy === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                                    Admin
                                  </BtnGhost>
                                )}
                                <BtnGhost onClick={() => setEditU(u)} title="Chỉnh sửa">
                                  <Edit3 className="h-4 w-4" /> Edit
                                </BtnGhost>

                                {u.status !== "banned" ? (
                                  <BtnGhost onClick={() => setStatusOne(u.id, "banned")} title="Khoá">
                                    <Ban className="h-4 w-4" /> Khoá
                                  </BtnGhost>
                                ) : (
                                  <BtnGhost onClick={() => setStatusOne(u.id, "active")} title="Mở khoá">
                                    <Unlock className="h-4 w-4" /> Mở
                                  </BtnGhost>
                                )}

                                <BtnDanger onClick={() => deleteOne(u.id)} title="Xoá">
                                  <Trash2 className="h-4 w-4" /> Xoá
                                </BtnDanger>

                                <BtnGhost onClick={() => openLogs(u)} title="Audit log">
                                  <UserCog className="h-4 w-4" /> Log
                                </BtnGhost>

                                <BtnGhost onClick={() => resetPassword(u)} title="Reset mật khẩu">
                                  <KeyRound className="h-4 w-4" /> Reset
                                </BtnGhost>

                                <BtnGhost onClick={() => resendVerify(u)} title="Gửi lại email xác thực">
                                  <Send className="h-4 w-4" /> Verify
                                </BtnGhost>

                                <BtnGhost onClick={() => impersonate(u)} title="Impersonate">
                                  <UserRoundCheck className="h-4 w-4" /> Impersonate
                                </BtnGhost>
                              </div>
                            </td>
                          );
                        }
                        return <td key={col.key} className="px-3 py-2">—</td>;
                      })}
                    </tr>
                  );
                })}

                {!data.items.length && (
                  <tr>
                    <td className="px-3 py-6 text-center text-slate-700" colSpan={visibleCols.length + 1}>
                      {firstLoadedRef.current ? "Không có dữ liệu" : "Đang tải…"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer: pagination */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-slate-800">
          Hiển thị {nf.format(showingFrom)}–{nf.format(showingTo)} / {nf.format(data.total)}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            disabled={data.page <= 1 || loading}
            onClick={() => load({ page: data.page - 1, pageSize: data.pageSize, origin: "manual" })}
          >Prev</button>
          <div className="min-w-[120px] text-center text-sm font-semibold text-slate-900">
            Trang {nf.format(data.page)} / {nf.format(totalPages)}
          </div>
          <button
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            disabled={data.page >= totalPages || loading}
            onClick={() => load({ page: data.page + 1, pageSize: data.pageSize, origin: "manual" })}
          >Next</button>
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={!!editU} onClose={() => setEditU(null)} title="Chỉnh sửa user">
        {editU && (
          <EditUserForm
            u={editU}
            onClose={() => setEditU(null)}
            onSaved={async () => {
              setEditU(null);
              t.success("Đã lưu thay đổi người dùng");
              await load({ page: data.page, pageSize: data.pageSize, origin: "silent-after-action" });
            }}
          />
        )}
      </Modal>

      {/* Audit log modal */}
      <Modal open={!!logU} onClose={() => setLogU(null)} title={`Audit log • ${logU?.name || logU?.email || ""}`}>
        {logsLoading ? (
          <div className="flex items-center gap-2 text-slate-700"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải…</div>
        ) : (
          <div className="max-h-[60vh] overflow-auto space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-sm font-semibold text-slate-900">{l.action || "—"}</div>
                <div className="text-xs text-slate-700">
                  {l.target_id ? `target#${l.target_id} • ` : ""}{formatTime(l.created_at)}
                </div>
                {l.detail && (
                  <pre className="mt-2 whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800">
                    {safePretty(l.detail)}
                  </pre>
                )}
              </div>
            ))}
            {!logs.length && <div className="text-sm text-slate-700">Không có log</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ==================== Subcomponents ==================== */

function ChipStat({ label, value, tone = "slate" }) {
  const toneMap = {
    emerald: "border-emerald-300 bg-emerald-50 text-emerald-700",
    rose:    "border-rose-300 bg-rose-50 text-rose-700",
    slate:   "border-slate-300 bg-slate-50 text-slate-700",
  };
  return (
    <div className={`flex items-center justify-between rounded-xl border ${toneMap[tone]} px-3 py-2`}>
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-base font-bold">{value}</span>
    </div>
  );
}

function Avatar({ url, name }) {
  const fallback = "https://i.pravatar.cc/64?img=12";
  return (
    <div className="h-9 w-9 overflow-hidden rounded-xl border border-slate-200">
      <img
        src={url || fallback}
        alt={name || "avatar"}
        className="h-full w-full object-cover"
        onError={(e) => { e.currentTarget.src = fallback; }}
      />
    </div>
  );
}

function RoleBadge({ role }) {
  if (!role) return <span className="text-xs text-slate-600">—</span>;
  const map = {
    admin:    "border-amber-300 bg-amber-50 text-amber-800",
    donor:    "border-sky-300 bg-sky-50 text-sky-700",
    receiver: "border-emerald-300 bg-emerald-50 text-emerald-700",
    shipper:  "border-violet-300 bg-violet-50 text-violet-700",
    user:     "border-slate-300 bg-slate-50 text-slate-700",
  };
  const cls = map[role] || map.user;
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${cls}`}>
      {role === "admin" ? <Crown className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
      {role}
    </span>
  );
}

function StatusBadge({ status }) {
  if (!status) return <span className="text-xs text-slate-600">—</span>;
  const map = {
    active:  "border-emerald-300 bg-emerald-50 text-emerald-700",
    banned:  "border-rose-300 bg-rose-50 text-rose-700",
    deleted: "border-slate-300 bg-slate-50 text-slate-700",
  };
  const cls = map[status] || "border-slate-300 bg-slate-50 text-slate-700";
  return <span className={`inline-block rounded-lg border px-2 py-1 text-xs font-semibold ${cls}`}>{status}</span>;
}

function TimeBadge({ value, empty = "" }) {
  if (!value) return <span className="text-xs text-slate-600">{empty}</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-900">
      <CalendarClock className="h-3.5 w-3.5" />
      {formatTime(value)}
    </span>
  );
}

function ToggleChip({ active, label, onToggle }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!active)}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition
        ${active ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
      title={`Bật/tắt vai trò phụ: ${label}`}
    >
      {active ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function BtnGhost({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}
function BtnDanger({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
    >
      {children}
    </button>
  );
}

function SkeletonTable() {
  return (
    <div className="p-3">
      <div className="mb-2 h-5 w-48 animate-pulse rounded bg-slate-200" />
      <div className="overflow-hidden rounded-xl border border-slate-200">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-slate-200 p-3 last:border-0">
            <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
            <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-200" />
            <div className="flex-1">
              <div className="mb-2 h-3 w-1/3 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-1/5 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-6 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-6 w-28 animate-pulse rounded bg-slate-100" />
            <div className="h-8 w-44 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-2 py-1 text-sm font-semibold hover:bg-slate-50">Đóng</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditUserForm({ u, onSaved, onClose }) {
  const [form, setForm] = useState({
    name: u.name || "",
    phone: u.phone || "",
    address: u.address || "",
    role: u.role || "user",
    status: u.status || "active",
    extraRoles: normalizeExtras(u),
  });
  const [saving, setSaving] = useState(false);
  const t = useToast();

  async function save() {
    try {
      setSaving(true);
      const uniqExtras = Array.from(new Set(form.extraRoles.filter((x) => x !== form.role)));
      const payload = { name: form.name, phone: form.phone, address: form.address, status: form.status, roles: [form.role, ...uniqExtras] };
      await apiPatch(`/api/admin/users/${u.id}`, payload);
      t.success("Đã lưu thay đổi");
      onSaved?.();
    } catch (e) {
      t.error(e?.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  function toggleExtra(r) {
    setForm((f) => {
      const has = f.extraRoles.includes(r);
      const next = has ? f.extraRoles.filter((x) => x !== r) : [...f.extraRoles, r];
      return { ...f, extraRoles: next };
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên">
          <input className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Số điện thoại">
          <input className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Địa chỉ" className="sm:col-span-2">
          <input className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Field label="Role chính">
          <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLE_OPTIONS.filter((r) => r !== "all").map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Trạng thái">
          <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUS_OPTIONS.filter((s) => s !== "all").map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Vai trò phụ (user_roles)" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {EXTRA_ROLES.map((r) => (
              <ToggleChip key={r} active={form.extraRoles.includes(r)} label={r} onToggle={() => toggleExtra(r)} />
            ))}
          </div>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50" onClick={onClose}>Huỷ</button>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          onClick={save}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Lưu thay đổi
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] font-semibold text-slate-800">{label}</div>
      {children}
    </label>
  );
}

/* ============= Utilities ============= */

function normalizeExtras(u) {
  const src =
    Array.isArray(u?.roles) ? u.roles :
    Array.isArray(u?.extraRoles) ? u.extraRoles :
    Array.isArray(u?.user_roles) ? u.user_roles : [];
  const extras = src.filter((x) => EXTRA_ROLES.includes(x));
  return extras.filter((x) => x !== u.role);
}

function safePretty(detail) {
  try {
    const obj = typeof detail === "string" ? JSON.parse(detail) : detail;
    if (obj && typeof obj === "object") return JSON.stringify(obj, null, 2);
    return String(detail);
  } catch {
    return String(detail);
  }
}

function formatTime(d) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric"
    }).format(new Date(d));
  } catch {
    return String(d);
  }
}

function sortIcon(sortBy, order, key) {
  const map = { user: "name", role: "role", status: "status", created_at: "created_at", last_login: "last_login", actions: "" };
  const field = map[key] ?? "";
  if (!field || sortBy !== field) return null;
  return <span className="text-[11px]">{order === "asc" ? "▲" : "▼"}</span>;
}

/* helper: GET blob (download) */
async function apiGetBlob(url) {
  const res = await fetch(url, {
    method: "GET",
    headers: { "Accept": "text/csv,application/octet-stream" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.blob();
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
