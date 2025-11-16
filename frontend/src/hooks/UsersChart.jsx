import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { BarChart3 } from "lucide-react";

function ChartCard({ title, children }) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition h-full">
      <div className="flex items-center gap-2 font-semibold text-slate-800 mb-4">
        <BarChart3 size={16} /> {title}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function UsersChart({ data }) {
  return (
    <ChartCard title="Tăng trưởng người dùng (30 ngày qua)">
      <AreaChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: "0.75rem",
            border: "1px solid #e2e8f0",
            fontSize: "0.875rem",
          }}
        />
        <Legend wrapperStyle={{ fontSize: "0.875rem" }} />
        <defs>
          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" name="Người dùng mới" stroke="#10b981" strokeWidth={2} fill="url(#colorUv)" />
      </AreaChart>
    </ChartCard>
  );
}