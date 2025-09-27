import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, LogOut, Settings, ScrollText, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * UserMenu — Premium Admin
 * - Không hardcode text: nhận user qua props (full_name/name/email/avatar/role).
 * - Dark mode hoàn chỉnh.
 * - Framer Motion: popover mượt.
 * - A11y + Keyboard: Enter mở, ↑/↓ di chuyển, Esc/ClickOutside đóng.
 * - API/route: truyền callback onLogout hoặc tự điều hướng /login.
 *
 * Props:
 *   - user: { full_name?, name?, email?, avatar?, role? | role_name? }
 *   - loading?: boolean
 *   - onLogout?: () => Promise<void> | void
 *   - routes?: { account?: string; activity?: string; }
 */
export default function UserMenu({ user, loading = false, onLogout, routes = {} }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // ====== Derived data ======
  const displayName = useMemo(() => {
    return user?.full_name || user?.name || user?.email || "Tài khoản";
  }, [user]);

  const roleLabel = useMemo(() => {
    return user?.role_name || user?.role || "User";
  }, [user]);

  const initials = useMemo(() => {
    const s = (user?.full_name || user?.name || user?.email || "U").trim();
    const parts = s.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || "U";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }, [user]);

  // ====== Close on outside click ======
  useEffect(() => {
    function onDocClick(e) {
      if (!open) return;
      const inMenu = menuRef.current?.contains(e.target);
      const inBtn = btnRef.current?.contains(e.target);
      if (!inMenu && !inBtn) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // ====== Keyboard nav for items ======
  const items = [
    {
      key: "account",
      icon: Settings,
      label: "Cài đặt tài khoản",
      onClick: () => (window.location.href = routes.account || "/account"),
    },
    {
      key: "activity",
      icon: ScrollText,
      label: "Nhật ký hoạt động",
      onClick: () => (window.location.href = routes.activity || "/account/activity"),
    },
    { type: "divider", key: "divider1" },
    {
      key: "logout",
      icon: LogOut,
      label: "Đăng xuất",
      destructive: true,
      onClick: async () => {
        try {
          if (onLogout) await onLogout();
        } finally {
          // fallback điều hướng
          window.location.href = "/login";
        }
      },
    },
  ];

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (!["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;
      e.preventDefault();
      const keys = items.filter((i) => i.type !== "divider");
      if (e.key === "ArrowDown") setActiveIdx((i) => (i + 1) % keys.length);
      if (e.key === "ArrowUp") setActiveIdx((i) => (i - 1 + keys.length) % keys.length);
      if (e.key === "Enter") keys[activeIdx]?.onClick?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, activeIdx]);

  // ====== Button style (premium) ======
  const Btn = (
    <button
      ref={btnRef}
      onClick={() => setOpen((v) => !v)}
      className={[
        "inline-flex h-9 items-center gap-2 rounded-xl pl-2 pr-2.5",
        "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800",
        "ring-1 ring-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
        "transition-colors",
      ].join(" ")}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label="Mở menu người dùng"
    >
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt={displayName}
          className="h-7 w-7 rounded-full object-cover ring-2 ring-white dark:ring-slate-900"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          className={[
            "inline-grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold text-white",
            "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500",
            "shadow-sm",
          ].join(" ")}
        >
          {initials}
        </span>
      )}
      <ChevronDown className="h-4 w-4 opacity-70" />
    </button>
  );

  return (
    <div className="relative">
      {Btn}

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="menu"
            aria-label="Menu người dùng"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={[
              "absolute right-0 mt-2 w-72 overflow-hidden",
              "rounded-2xl border border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80",
              "shadow-[0_20px_60px_-15px_rgba(2,6,23,0.35)]",
              "dark:border-slate-700 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/80",
            ].join(" ")}
          >
            {/* Header */}
            <div className="relative px-3.5 py-3.5">
              {/* gradient edge */}
              <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
              <div className="flex items-center gap-3">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={displayName}
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                  />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white text-sm font-semibold">
                    {initials}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {loading ? "Đang tải…" : displayName}
                    </span>
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {user?.email || "—"}
                  </div>
                </div>
              </div>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:text-slate-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {roleLabel}
              </div>
            </div>

            <div className="h-px bg-slate-200/80 dark:bg-slate-700/80" />

            {/* Items */}
            <nav className="p-1" aria-label="Hành động tài khoản">
              {items.map((it, idx) =>
                it.type === "divider" ? (
                  <div
                    key={it.key}
                    className="my-1 h-px bg-slate-200/80 dark:bg-slate-700/80"
                  />
                ) : (
                  <MenuItem
                    key={it.key}
                    icon={it.icon}
                    active={idx === activeIdx}
                    destructive={it.destructive}
                    onClick={() => {
                      setOpen(false);
                      it.onClick?.();
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    {it.label}
                  </MenuItem>
                )
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ icon: Icon, children, active, destructive, onClick, onMouseEnter }) {
  return (
    <button
      role="menuitem"
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={[
        "group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm",
        "transition-colors",
        active
          ? "bg-slate-100 dark:bg-slate-800"
          : "hover:bg-slate-100 dark:hover:bg-slate-800",
        destructive
          ? "text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
          : "text-slate-800 dark:text-slate-200",
      ].join(" ")}
    >
      <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
      <span className="flex-1">{children}</span>
      {/* ripple accent */}
      <span className="pointer-events-none absolute -z-10 hidden" />
    </button>
  );
}
