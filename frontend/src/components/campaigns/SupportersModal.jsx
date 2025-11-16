import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSupporters } from "../../hooks/useSupporters";

import Card from "../ui/Card";
import Button from "../ui/Button";

const Input = (props) => <input {...props} className="input w-full" />;
const Select = (props) => <select {...props} className="input w-full" />;

const useAnim = () => ({
  pop: { initial: { opacity: 0, scale: 0.98 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 } },
  backdrop: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  listStagger: (stagger = 0.06, delay = 0) => ({ animate: { transition: { staggerChildren: stagger, delayChildren: delay } } }),
  item: { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 10 } },
});

const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

const Avatar = ({ name = "?", src }) =>
  src ? (
    <img src={src} alt={name} className="h-9 w-9 rounded-full object-cover border border-slate-300" />
  ) : (
    <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-xs font-bold">
      {(name || "?").split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?"}
    </div>
  );

export default function SupportersModal({ open, onClose, campaign }) {
  const { pop, backdrop, listStagger, item } = useAnim();
  const { items, total, loading, error } = useSupporters(campaign?.id);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");

  const view = useMemo(() => {
    let arr = items.slice();
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      arr = arr.filter((x) => (x.name || "").toLowerCase().includes(s) || (x.message || "").toLowerCase().includes(s));
    }
    if (sort === "newest") arr.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    else if (sort === "amount") arr.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    return arr;
  }, [items, q, sort]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] grid place-items-center" {...backdrop}>
          <motion.div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto" {...pop}>
            <Card>
              <div className="p-6 border-b border-slate-200">
                <div className="text-lg font-bold text-slate-900">Chi tiết ủng hộ</div>
                <div className="text-sm text-slate-700">{campaign?.title}</div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Card className="p-3">
                    <div className="text-xs font-medium text-slate-600">Tổng số tiền</div>
                    <div className="text-lg font-bold text-emerald-700">{total.toLocaleString("vi-VN")} đ</div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-xs font-medium text-slate-600">Số lượt ủng hộ</div>
                    <div className="text-lg font-bold text-slate-900">{items.length.toLocaleString("vi-VN")}</div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-xs font-medium text-slate-600">Tiến độ hiện tại</div>
                    <div className="text-lg font-bold text-slate-900">
                      {toNum(campaign?.raised_amount ?? campaign?.raised, 0).toLocaleString("vi-VN")} đ
                      {campaign?.target_amount ? <> / {toNum(campaign?.target_amount, 0).toLocaleString("vi-VN")} đ</> : null}
                    </div>
                  </Card>
                </div>
              </div>

              <div className="px-5 pt-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <Input placeholder="Tìm theo tên hoặc ghi chú…" value={q} onChange={(e) => setQ(e.target.value)} />
                  <Select className="w-full sm:w-52" value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="newest">Mới nhất</option>
                    <option value="amount">Số tiền (cao → thấp)</option>
                  </Select>
                </div>
              </div>

              <div className="p-5 max-h-[70vh] overflow-auto">
                {loading ? (
                  <div className="flex items-center gap-3 text-slate-800"><div className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />Đang tải danh sách ủng hộ…</div>
                ) : error ? (
                  <div className="text-sm text-rose-600">{error}</div>
                ) : view.length === 0 ? (
                  <div className="text-sm text-slate-700">Chưa có dữ liệu ủng hộ.</div>
                ) : (
                  <motion.ul className="divide-y divide-slate-200 rounded-xl border border-slate-300 overflow-hidden bg-white" {...listStagger(0.04)}>
                    {view.map((x) => (
                      <motion.li key={x.id} className="p-3 sm:p-4" {...item}>
                        <div className="flex items-start gap-3">
                          <Avatar name={x.anonymous ? "Ẩn danh" : x.name} src={x.avatar} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <div className="font-semibold text-slate-900 truncate">{x.anonymous ? "Ẩn danh" : x.name}</div>
                              <div className="text-xs text-slate-600">{x.at ? new Date(x.at).toLocaleString("vi-VN") : ""}</div>
                            </div>
                            {x.message && <div className="text-sm text-slate-800 mt-0.5 break-words">{x.message}</div>}
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-emerald-700 font-semibold">{toNum(x.amount, 0).toLocaleString("vi-VN")} đ</div>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </div>

              <div className="p-5 border-t border-slate-200 flex items-center justify-end gap-2"><Button variant="ghost" onClick={onClose}>Đóng</Button></div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}