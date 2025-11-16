const fmt = (n) => new Intl.NumberFormat("vi-VN").format(Number.isFinite(Number(n)) ? Number(n) : 0);

export default function StatCard({ icon: Icon, label, value, change, tone = "emerald" }) {
  const toneMap = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-700">{label}</div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${toneMap[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{fmt(value)}</div>
      {change && <div className="mt-1 text-xs text-slate-600">{change}</div>}
    </div>
  );
}