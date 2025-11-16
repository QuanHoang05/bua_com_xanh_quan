﻿// src/pages/Settings.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCog, Shield, ListChecks, FileLock2,
  KeyRound, Activity, Home, ChevronRight,
} from "lucide-react";

// Import các component con cho từng tab (sử dụng alias)
import ProfileSettings from "@/components/settings/ProfileSettings";
import SecuritySettings from "@/components/settings/SecuritySettings";
import ActivityHistory from "@/components/settings/ActivityHistory";
import PrivacySettings from "@/components/settings/PrivacySettings";
import { useProfile } from "@/hooks/useProfile";

/** ==============================
 *  SETTINGS HUB — UI nâng cấp
 *  ============================== */
export default function Settings() {
  const { setUser, signOut } = useAuth();
  const t = useToast();
  const nav = useNavigate();

  /* ===== STATE ===== */
  const [tab, setTab] = useState("activity"); // 'profile' | 'security' | 'activity' | 'privacy'
  const [isEditing, setIsEditing] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "",
    avatar_url: "", lat: null, lng: null,
  });

  // --- Password change states ---
  const [curPw, setCurPw] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [changing, setChanging] = useState(false);
  const [showCur, setShowCur] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [confirmPwOpen, setConfirmPwOpen] = useState(false);

  // --- Geolocation states ---
  const [locating, setLocating] = useState(false);
  const [locAccuracy, setLocAccuracy] = useState(null); // meters
  const watchIdRef = useRef(null);

  const [sessions, setSessions] = useState([]);
  const [sessLoading, setSessLoading] = useState(false);

  // lịch sử từ API: {given:[], received:[], payments:[]}
  const [history, setHistory] = useState({ given: [], received: [], payments: [] });
  const [histLoading, setHistLoading] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  /* ===== HELPERS ===== */
  function setField(k, v) { setForm((s) => ({ ...s, [k]: v })); }
  const avatar = useMemo(() => (
    form.avatar_url?.trim() ? form.avatar_url : "https://i.pravatar.cc/160?img=12"
  ), [form.avatar_url]);

  function startEdit() { setSnapshot(form); setIsEditing(true); }
  function cancelEdit() { if (snapshot) setForm(snapshot); setIsEditing(false); }
  const disabled = !isEditing || profileLoading;

  const passwordScore = useMemo(() => scorePassword(pw1), [pw1]);
  const passwordOK = passwordScore.score >= 3 && pw1.length >= 8;
  const passwordsMatch = pw1 && pw2 && pw1 === pw2;

  // 🎯 Button styles (đậm nét, rõ ràng)
  const btnPrimary =
    "rounded-full font-semibold border ring-1 border-emerald-600 ring-emerald-600 " +
    "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 " +
    "shadow-[0_8px_24px_rgba(16,185,129,0.28)] hover:shadow-[0_12px_28px_rgba(16,185,129,0.36)] " +
    "transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed";
  const btnSecondary =
    "rounded-full font-semibold border ring-1 border-slate-300 ring-slate-300 text-slate-800 " +
    "bg-white hover:bg-slate-50 active:bg-slate-100 transition-all duration-200 " +
    "disabled:opacity-60 disabled:cursor-not-allowed";

  /* ===== ANIM ===== */
  const fadeUp = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: "easeOut" } };
  const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25 } };

  /* ===== VIEW ===== */
  return (
    <motion.div {...fadeIn} className="max-w-6xl mx-auto p-6 md:p-8">
      {/* Header */}
      <motion.div {...fadeUp} className="mb-6 md:mb-8">
        <div className="flex items-center gap-3 text-slate-500 text-sm md:text-base">
          <Home size={16} /> <ChevronRight size={16} /> <span className="font-medium">Cài đặt</span>
        </div>
        <div className="mt-3 md:mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={avatar} alt="avatar" className="h-14 w-14 md:h-16 md:w-16 rounded-full object-cover ring-2 ring-white border shadow-sm" />
            {profileLoading ? <SkeletonProfileHeader /> : (
              <div>
                <div className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">{profile?.name || "Người dùng"}</div>
                <div className="text-sm md:text-base text-slate-700">{profile?.email || "—"}</div>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="hidden sm:flex flex-wrap gap-3">
            <QuickActionButton icon={KeyRound} onClick={() => setTab("security")} variant="primary">
              Đổi mật khẩu
            </QuickActionButton>
            <QuickActionButton icon={FileLock2} onClick={() => setTab("privacy")} variant="secondary">
              Tải dữ liệu
            </QuickActionButton>
            <QuickActionButton icon={Activity} onClick={() => setTab("activity")} variant="secondary">
              Xem hoạt động
            </QuickActionButton>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-6 md:gap-8">
        {/* Sidebar */}
        <aside className="md:sticky md:top-6 h-fit justify-self-start md:-ml-2">
          <motion.div {...fadeUp}>
            <Card className="w-[240px] md:w-[260px] p-2 md:p-3 rounded-2xl shadow-lg bg-white border border-slate-200">
              <SidebarItem active={tab === "profile"} icon={UserCog} label="Hồ sơ cá nhân" desc="Tên, ảnh, địa chỉ, vị trí" onClick={() => setTab("profile")} />
              <SidebarItem active={tab === "security"} icon={Shield} label="Bảo mật & Đăng nhập" desc="Mật khẩu, phiên đăng nhập" onClick={() => setTab("security")} />
              <SidebarItem active={tab === "activity"} icon={ListChecks} label="Hoạt động" desc="Đã cho, đã nhận, giao dịch" onClick={() => setTab("activity")} />
              <SidebarItem active={tab === "privacy"} icon={FileLock2} label="Quyền riêng tư & TK" desc="Xuất dữ liệu, xóa tài khoản" onClick={() => setTab("privacy")} />
            </Card>
          </motion.div>
        </aside>

        {/* Content */}
        <section className="space-y-6 md:space-y-8">
          <AnimatePresence mode="wait">
            {tab === "profile" && (
              <ProfileSettings key="tab-profile" fadeUp={fadeUp} />
            )}

            {tab === "security" && (
              <SecuritySettings key="tab-security" fadeUp={fadeUp} />
            )}

            {tab === "activity" && (
              <ActivityHistory key="tab-activity" fadeUp={fadeUp} />
            )}

            {tab === "privacy" && (
              <PrivacySettings key="tab-privacy" fadeUp={fadeUp} />
            )}
          </AnimatePresence>
        </section>
      </div>
    </motion.div>
  );
}

/* ===================== Reusable UI ===================== */

// Nút quick action riêng để đảm bảo hover/active đổi màu rõ ràng
function QuickActionButton({ icon: Icon, children, onClick, variant = "primary" }) {
  const base =
    "inline-flex items-center gap-2 px-5 py-2 rounded-full font-semibold border shadow-sm " +
    "transition-colors duration-150 focus-visible:outline-none";
  const variants = {
    primary:
      "bg-emerald-600 text-white border-emerald-600 " +
      "hover:bg-emerald-700 active:bg-emerald-800 " +
      "focus-visible:ring-2 focus-visible:ring-emerald-400",
    secondary:
      "bg-white text-slate-800 border-slate-300 " +
      "hover:bg-slate-50 active:bg-slate-100 " +
      "focus-visible:ring-2 focus-visible:ring-slate-300",
  };
  return (
    <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={onClick} className={`${base} ${variants[variant]}`}>
      {Icon ? <Icon size={16} /> : null}
      {children}
    </motion.button>
  );
}

function SidebarItem({ active, icon: Icon, label, desc, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.995 }}
      className={[
        "w-full rounded-xl px-4 py-4 text-left transition relative group",
        active ? "bg-emerald-50 border border-emerald-200 shadow-sm" : "hover:bg-gray-50"
      ].join(" ")}
    >
      {/* active indicator */}
      <span className={[
        "absolute left-0 top-1/2 -translate-y-1/2 h-7 w-1 rounded-r-full",
        active ? "bg-emerald-500" : "bg-transparent"
      ].join(" ")} />
      <div className="flex items-center gap-3">
        <div className={[
          "h-11 w-11 rounded-xl border flex items-center justify-center transition",
          active ? "bg-white border-emerald-200 shadow-sm" : "bg-white border-slate-200 group-hover:border-slate-300"
        ].join(" ")}>
          <Icon size={20} className={active ? "text-emerald-700" : "text-slate-700"} />
        </div>
        <div>
          <div className={"text-base font-semibold " + (active ? "text-emerald-800" : "text-slate-900")}>{label}</div>
          <div className="text-xs text-slate-500">{desc}</div>
        </div>
      </div>
    </motion.button>
  );
}

function ConfirmDialog({ title, desc, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-[min(92vw,520px)] p-6 border">
        <div className="text-lg md:text-xl font-bold text-slate-900 mb-2">{title}</div>
        <p className="text-sm text-slate-700 mb-4">{desc}</p>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className="px-5 py-2 rounded-full border bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50">
            Hủy
          </button>
          <button onClick={onConfirm} className="px-5 py-2 rounded-full border bg-emerald-600 text-white ring-1 ring-emerald-600 hover:bg-emerald-700">
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Utilities ---------- */

/* ---------- Skeletons ---------- */
function SkeletonProfileHeader() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-6 w-40 bg-slate-200 rounded" />
      <div className="h-4 w-56 bg-slate-200 rounded" />
    </div>
  );
}
