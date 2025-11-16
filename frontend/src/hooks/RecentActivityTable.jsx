import { ArrowRight } from "lucide-react";

export default function RecentActivityTable({ title, icon: Icon, items, linkTo, isTable = false, headers = [], renderRow }) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition h-full">
      <div className="flex items-center justify-between font-semibold text-slate-800 mb-4">
        <div className="flex items-center gap-2"><Icon size={16} /> {title}</div>
        <a href={linkTo} className="text-sm text-emerald-600 hover:underline flex items-center gap-1">
          Xem tất cả <ArrowRight size={14} />
        </a>
      </div>
      {isTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-600">
              <tr>
                {headers.map(h => <th key={h} className="p-2">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id || index} className="border-t border-slate-200">
                  {renderRow(item)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li key={item.id || index} className="flex items-center gap-3">
              {renderRow(item)}
            </li>
          ))}
        </ul>
      )}
      {items.length === 0 && (
        <div className="text-sm text-slate-500 text-center py-4">Không có hoạt động nào.</div>
      )}
    </div>
  );
}