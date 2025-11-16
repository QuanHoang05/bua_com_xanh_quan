import { useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  Users,
  BadgeDollarSign,
  UtensilsCrossed,
  CalendarClock,
} from "lucide-react";

import { useCampaigns } from "../hooks/useCampaigns.js";
import { isMealCampaign, normalizeCampaign } from "../lib/campaignUtils.js";
import { apiPost } from "../lib/api.js";

import CampaignCard from "../components/campaigns/CampaignCard.jsx";
import DonateMoneyModal from "../components/campaigns/DonateMoneyModal";
import DonateMealModal from "../components/campaigns/DonateMealModal";
import SupportersModal from "../components/campaigns/SupportersModal";
import { useState } from "react";


/* ========================= Motion helpers ========================= */
const useAnim = () => {
  const reduce = useReducedMotion();
  const dur = reduce ? 0 : 0.35;
  const ease = [0.22, 1, 0.36, 1];

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: reduce ? 0 : 12 },
    animate: { opacity: 1, y: 0, transition: { duration: dur, ease, delay } },
    exit: { opacity: 0, y: reduce ? 0 : 12, transition: { duration: 0.24, ease } },
  });

  const listStagger = (stagger = 0.06, delay = 0) => ({
    animate: { transition: { staggerChildren: reduce ? 0 : stagger, delayChildren: delay } },
  });

  const item = {
    initial: { opacity: 0, y: reduce ? 0 : 10 },
    animate: { opacity: 1, y: 0, transition: { duration: dur, ease } },
    exit: { opacity: 0, y: reduce ? 0 : 10, transition: { duration: 0.2, ease } },
  };

  return { fadeUp, listStagger, item };
};

/* ========================= UI PRIMITIVES ========================= */
const Card = ({ className = "", children }) => (
  <div
    className={[
      "rounded-2xl border border-slate-200/90 bg-white shadow-sm",
      "transition-all duration-200 hover:shadow-md",
      className,
    ].join(" ")}
  >
    {children}
  </div>
);

const baseField =
  "w-full rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 " +
  "px-3 py-2 outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 focus-visible:border-emerald-600 " +
  "selection:bg-emerald-100 selection:text-emerald-900";

const Input = (props) => (
  <input {...props} className={[baseField, "text-[15px] leading-6", props.className || ""].join(" ")} />
);
const Select = (props) => (
  <select {...props} className={[baseField, "text-[15px] leading-6", props.className || ""].join(" ")} />
);

const Stat = ({ label, value, icon: Icon, accent = "emerald" }) => {
  const accentMap = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <Card className="p-4 relative">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-600">{label}</div>
        <span
          className={
            "inline-flex h-8 w-8 items-center justify-center rounded-xl border " +
            (accentMap[accent] || accentMap.emerald)
          }
        >
          {Icon ? <Icon size={16} /> : null}
        </span>
      </div>
      <div className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">{value}</div>
    </Card>
  );
};

const SkeletonCard = () => (
  <motion.div layout {...{ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }}>
    <Card className="overflow-hidden animate-pulse">
      <div className="h-44 w-full bg-slate-100" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-slate-200 rounded w-3/4" />
        <div className="h-4 bg-slate-200 rounded w-5/6" />
        <div className="h-2 bg-slate-200 rounded w-full" />
        <div className="flex gap-2">
          <div className="h-5 bg-slate-200 rounded-full w-16" />
          <div className="h-5 bg-slate-200 rounded-full w-14" />
          <div className="h-5 bg-slate-200 rounded-full w-12" />
        </div>
      </div>
    </Card>
  </motion.div>
);


/* ============================ Page ============================ */
export default function Campaigns() {
  const { fadeUp, listStagger, item } = useAnim();
  
  const { 
    list, 
    loading, 
    error, 
    q, 
    setQ, 
    sortBy, 
    setSortBy, 
    filters, 
    setFilters, 
    gateways, 
    mealPrice 
  } = useCampaigns();

  const [donateMoneyOpen, setDonateMoneyOpen] = useState(false);
  const [donateMealOpen, setDonateMealOpen] = useState(false);
  const [supportersOpen, setSupportersOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  const totalSupporters = useMemo(() => list.reduce((a, c) => a + (c.supporters || 0), 0), [list]);
  const totalRaised = useMemo(() => list.reduce((a, c) => a + (Number(c.raised_amount) || 0), 0), [list]);
  const totalMeals = useMemo(() => list.reduce((a, c) => a + (Number(c.meal_received_qty) || 0), 0), [list]);

  return (
    <motion.div
      className="space-y-6 antialiased [text-rendering:optimizeLegibility] [font-feature-settings:'ss01','case'] text-slate-900"
      {...fadeUp(0)}
    >
      {/* Banner */}
      <motion.div {...fadeUp(0.02)}>
        <Card className="p-5 bg-gradient-to-br from-slate-50 to-white border-slate-200/80">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-2xl md:text-3xl font-black leading-tight tracking-tight">Chiến dịch</div>
              <div className="mt-1 text-[15px] text-slate-700">Tìm kiếm, lọc và ủng hộ các chiến dịch đang hoạt động.</div>
            </div>
            {/* Search big */}
            <div className="w-full md:w-[480px]">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-2.5 text-slate-500" />
                <Input
                  className="pl-9"
                  placeholder="Tìm kiếm chiến dịch, địa điểm, tag…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Toolbar */}
      <motion.div {...fadeUp(0.06)}>
        <Card className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <SlidersHorizontal size={16} />
              Bộ lọc & sắp xếp
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="newest">Mới nhất</option>
                <option value="progress">Tiến độ</option>
                <option value="supporters">Nhiều ủng hộ</option>
                <option value="endingSoon">Sắp kết thúc</option>
              </Select>

              <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white">
                <input
                  type="checkbox"
                  checked={filters.activeOnly}
                  onChange={() => setFilters((f) => ({ ...f, activeOnly: !f.activeOnly }))}
                />
                Đang hoạt động
              </label>
              <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white">
                <input type="checkbox" checked={filters.diet} onChange={() => setFilters((f) => ({ ...f, diet: !f.diet }))} />
                Ăn chay
              </label>
              <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white">
                <input
                  type="checkbox"
                  checked={filters.expiring}
                  onChange={() => setFilters((f) => ({ ...f, expiring: !f.expiring }))}
                />
                Sắp hết hạn
              </label>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" {...listStagger(0.05, 0.08)}>
        <motion.div {...item}>
          <Stat label="Người ủng hộ" value={totalSupporters.toLocaleString("vi-VN")} icon={Users} accent="emerald" />
        </motion.div>
        <motion.div {...item}>
          <Stat label="Đã gây quỹ" value={totalRaised.toLocaleString("vi-VN") + " đ"} icon={BadgeDollarSign} accent="violet" />
        </motion.div>
        <motion.div {...item}>
          <Stat label="Khẩu phần" value={totalMeals.toLocaleString("vi-VN")} icon={UtensilsCrossed} accent="sky" />
        </motion.div>
        <motion.div {...item}>
          <Stat label="Chiến dịch" value={list.length} icon={CalendarClock} accent="amber" />
        </motion.div>
      </motion.div>

      {/* Body */}
      {error ? (
        <motion.div {...fadeUp(0.1)}>
          <Card className="p-8 text-center text-rose-600">{error}</Card>
        </motion.div>
      ) : loading ? (
        <motion.div className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch" {...listStagger(0.05, 0.1)}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </motion.div>
      ) : list.length === 0 ? (
        <motion.div {...fadeUp(0.1)}>
          <Card className="p-8 text-center text-slate-700">Chưa có chiến dịch phù hợp.</Card>
        </motion.div>
      ) : (
        <motion.div
          className="grid gap-5 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          {...listStagger(0.06, 0.08)}
          layout
        >
          <AnimatePresence>
            {list.map((c) => (
              <motion.div
                key={c.id}
                className="relative"
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -2 }}
              >
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.995 }} transition={{ duration: 0.12 }}>
                  <CampaignCard
                    c={c}
                    onDonate={(x) => {
                      setSelectedCampaign(x);
                      isMealCampaign(x) ? setDonateMealOpen(true) : setDonateMoneyOpen(true);
                    }}
                    onSupporters={(x) => {
                      setSelectedCampaign(x);
                      setSupportersOpen(true);
                    }}
                  />
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modals */}
      <DonateMoneyModal
        open={donateMoneyOpen}
        onClose={() => setDonateMoneyOpen(false)}
        campaign={selectedCampaign}
        globalGateways={gateways}
        apiPost={apiPost}
      />
      <DonateMealModal
        open={donateMealOpen}
        onClose={() => setDonateMealOpen(false)}
        campaign={selectedCampaign}
        globalGateways={gateways}
        mealPrice={mealPrice}
        apiPost={apiPost}
      />
      <SupportersModal 
        open={supportersOpen} 
        onClose={() => setSupportersOpen(false)} 
        campaign={selectedCampaign} 
      />
    </motion.div>
  );
}
