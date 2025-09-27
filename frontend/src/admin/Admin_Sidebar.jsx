// src/admin/Admin_Sidebar.jsx
// Sidebar (black theme, high-contrast). Drop-in replacement.

import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, ChevronRight, ChevronLeft, Leaf } from "lucide-react";

export function AdminSidebar({
  menu = [],
  actions = [],
  collapsed = false,
  setCollapsed = () => {},
  query = "",
  setQuery = () => {},
  className = "",
  withHeader = true,
  footer = null,
  storageKey = "admin.sidebar",
}) {
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        setCollapsed((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCollapsed]);

  const filteredMenu = useMemo(() => {
    if (!query.trim()) return menu;
    const q = query.toLowerCase();
    return menu
      .map((sec) => ({
        ...sec,
        items: (sec.items || []).filter((i) => i.label.toLowerCase().includes(q)),
      }))
      .filter((sec) => sec.items?.length);
  }, [menu, query]);

  return (
    <div
      className={[
        "h-full flex flex-col",
        // === BLACK SIDEBAR ===
        "bg-neutral-950 text-neutral-100",
        "border-r border-neutral-800",
        className,
      ].join(" ")}
    >
      {/* ----- Header ----- */}
      {withHeader && (
        <>
          <div className="px-3 pt-3 pb-2">
            <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
              <div
                className={[
                  "flex items-center gap-2 font-semibold transition-all",
                  collapsed ? "opacity-0 pointer-events-none w-0" : "",
                ].join(" ")}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_10px_28px_-10px_rgba(16,185,129,0.65)]">
                  <Leaf className="h-4 w-4" />
                </span>
                <span className="text-white">Bữa Cơm Xanh • Admin</span>
              </div>
              <button
                onClick={() => {
                  setCollapsed((v) => {
                    const nv = !v;
                    try { localStorage.setItem(`${storageKey}.collapsed`, nv ? "1" : "0"); } catch {}
                    return nv;
                  });
                }}
                title="Thu gọn/Mở rộng (Ctrl/Cmd + B)"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-200 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 pb-2">
            {collapsed ? (
              <div className="group relative flex items-center justify-center">
                <div className="h-10 w-10 rounded-lg bg-neutral-800 flex items-center justify-center">
                  <Search className="h-4 w-4 text-neutral-300" />
                </div>
                <span className="pointer-events-none absolute left-12 text-xs text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  / hoặc Ctrl+K
                </span>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-300" />
                <input
                  data-admin-search="1"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm trong menu…"
                  className={[
                    "h-10 w-full rounded-lg border",
                    "border-neutral-700 bg-neutral-900",
                    "px-3 pl-9 text-sm text-neutral-100",
                    "placeholder:text-neutral-400",
                    "outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                  ].join(" ")}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* ----- Quick Actions ----- */}
      <div className="px-3 pb-2">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            {actions.slice(0, 3).map((a, i) => (
              <Tooltip key={i} label={a.label}>
                <button
                  onClick={a.onClick}
                  className="h-10 w-10 rounded-lg border border-neutral-700 bg-gradient-to-b from-emerald-600 to-teal-600 text-white hover:brightness-110 active:brightness-95 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <a.icon className="h-5 w-5" />
                </button>
              </Tooltip>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {actions.map((a, i) => (
              <button
                key={i}
                onClick={a.onClick}
                className="group flex items-center gap-2 px-3 h-10 rounded-xl border border-neutral-700 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:brightness-110 active:brightness-95 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <a.icon className="h-4 w-4" />
                <span className="text-sm text-white">{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ----- Menu ----- */}
      <nav className="px-2 flex-1 overflow-y-auto">
        {filteredMenu.map((sec) => (
          <SidebarSection key={sec.label} label={sec.label} collapsed={collapsed}>
            {sec.items.map((it) => (
              <SidebarItem
                key={it.to}
                to={it.to}
                icon={it.icon}
                exact={it.exact}
                badge={it.badge}
                collapsed={collapsed}
              >
                {it.label}
              </SidebarItem>
            ))}
          </SidebarSection>
        ))}
      </nav>

      {/* ----- Footer ----- */}
      <div className="p-3 border-t border-neutral-800">
        {footer ?? (
          <div className={`rounded-xl ${collapsed ? "p-2" : "p-3"} border border-neutral-800 bg-neutral-900`}>
            {collapsed ? (
              <Leaf className="h-5 w-5 text-emerald-400 mx-auto" />
            ) : (
              <div className="text-xs text-neutral-300 leading-relaxed">
                <div className="font-semibold text-emerald-400 mb-1">Mẹo</div>
                Nhấn <kbd className="px-1 rounded border border-neutral-700">/</kbd> hoặc <kbd className="px-1 rounded border border-neutral-700">Ctrl+K</kbd> để tìm nhanh. <br />
                <kbd className="px-1 rounded border border-neutral-700">Ctrl</kbd>/<kbd className="px-1 rounded border border-neutral-700">⌘</kbd>+<kbd className="px-1 rounded border border-neutral-700">B</kbd> để thu gọn.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Internals ===== */

function SidebarSection({ label, children, collapsed }) {
  return (
    <div className="mb-2">
      <div
        className={[
          "px-3 pt-3 text-[11px] uppercase tracking-wide select-none",
          "text-neutral-400",
          collapsed ? "text-center" : "",
        ].join(" ")}
      >
        {collapsed ? label.split(" ")[0] : label}
      </div>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

function SidebarItem({
  to,
  children,
  icon: Icon = ChevronRight,
  exact = false,
  collapsed = false,
  badge,
}) {
  return (
    <Tooltip label={collapsed ? children : ""}>
      <NavLink
        to={to}
        end={exact}
        className={({ isActive }) =>
          [
            "group relative flex items-center gap-3 rounded-xl transition",
            "outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
            collapsed ? "px-2 py-2 justify-center" : "px-3 py-2",
            isActive
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md border border-emerald-500/60"
              : "text-neutral-100 hover:bg-neutral-900 border border-transparent",
          ].join(" ")
        }
      >
        {/* Active ribbon */}
        <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-gradient-to-b from-emerald-400 to-teal-500 opacity-100" />
        <Icon className="h-4 w-4" />
        {!collapsed && (
          <>
            <span className="flex-1 text-sm">{children}</span>
            {Number.isFinite(badge) && (
              <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-100 border border-neutral-700">
                {badge}
              </span>
            )}
          </>
        )}
      </NavLink>
    </Tooltip>
  );
}

function Tooltip({ label, children }) {
  const [open, setOpen] = useState(false);
  if (!label) return children;
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute top-1/2 left-full -translate-y-1/2 ml-2 z-50"
          >
            <div className="whitespace-nowrap rounded-lg px-2 py-1 text-xs bg-neutral-900 text-white shadow-lg border border-neutral-800">
              {label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ----- Mobile drawer container ----- */
export function SidebarSlideIn({ children }) {
  return (
    <motion.div
      initial={{ x: -320 }}
      animate={{ x: 0 }}
      exit={{ x: -320 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] bg-neutral-950 border-r border-neutral-800 shadow-2xl"
    >
      {children}
    </motion.div>
  );
}
