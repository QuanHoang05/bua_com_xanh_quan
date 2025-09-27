import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../lib/api";
import { BarChart3, TrendingUp, RefreshCcw } from "lucide-react";

export default function AdminDeliveryAnalytics() {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [basis, setBasis] = useState("completed"); // completed|all
  const [group, setGroup] = useState("day");       // day|shipper|campaign|none
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    setLoading(true);
    const q = new URLSearchParams({ basis, group_by: group, scope: "all", ...(from?{from}:{}) , ...(to?{to}:{}) }).toString();
    const res = await apiGet(`/api/analytics/delivery-rate?${q}`);
    setItems(res.items || []);
    setSummary(res.summary || null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const headers = useMemo(() => ([
    group === "day" ? "Ngày" : group === "shipper" ? "Shipper" : group === "campaign" ? "Chiến dịch" : "Nhóm",
    "Delivered", "Cancelled", "Tổng", "Tỷ lệ thành công"
  ]), [group]);

  return (
    <div className="mx-auto max-w-6xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-200 to-teal-200">
            <BarChart3 className="h-6 w-6 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Delivery Analytics</h1>
            <p className="text-xs text-slate-600">Tỷ lệ giao hàng thành công theo thời gian/shipper/campaign</p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
          <RefreshCcw className="h-4 w-4" /> Tải lại
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-col">
          <label className="text-xs text-slate-500">Từ ngày</label>
          <input value={from} onChange={e=>setFrom(e.target.value)} type="datetime-local" className="rounded-lg border border-slate-300 p-2 text-sm" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500">Đến ngày</label>
          <input value={to} onChange={e=>setTo(e.target.value)} type="datetime-local" className="rounded-lg border border-slate-300 p-2 text-sm" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500">Nhóm theo</label>
          <select value={group} onChange={e=>setGroup(e.target.value)} className="rounded-lg border border-slate-300 p-2 text-sm">
            <option value="day">Ngày</option>
            <option value="shipper">Shipper</option>
            <option value="campaign">Campaign</option>
            <option value="none">Tổng</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs text-slate-500">Mẫu số</label>
          <select value={basis} onChange={e=>setBasis(e.target.value)} className="rounded-lg border border-slate-300 p-2 text-sm">
            <option value="completed">Đơn đã kết thúc (delivered+cancelled)</option>
            <option value="all">Tất cả đơn</option>
          </select>
        </div>
        <button onClick={load} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Áp dụng</button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KPI title="Delivered" value={summary?.delivered ?? 0} />
        <KPI title="Cancelled" value={summary?.cancelled ?? 0} />
        <KPI title="Success Rate" value={(summary?.success_rate ?? 0) + "%"} icon={TrendingUp} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              {headers.map(h => (<th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-3 text-slate-500" colSpan={headers.length}>Đang tải…</td></tr>
            ) : items.length === 0 ? (
              <tr><td className="px-3 py-3 text-slate-500" colSpan={headers.length}>Không có dữ liệu</td></tr>
            ) : items.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="px-3 py-2 font-medium text-slate-900">{r.grp_name}</td>
                <td className="px-3 py-2">{r.delivered}</td>
                <td className="px-3 py-2">{r.cancelled}</td>
                <td className="px-3 py-2">{r.total}</td>
                <td className="px-3 py-2 font-semibold">{r.success_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ title, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5 text-emerald-600" />}
        <div className="text-xl font-bold text-slate-900">{value}</div>
      </div>
    </div>
  );
}
