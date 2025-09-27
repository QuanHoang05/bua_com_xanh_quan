import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Leaf, Bell, Menu, X } from "lucide-react";
import ThemeSwitcher from "./ThemeSwitcher";
import UserMenu from "./UserMenu";
import { apiGet } from "../../lib/api";

/**
 * Topbar Admin:
 *  - Lấy user hiện tại từ /api/me
 *  - Lấy số thông báo chưa đọc từ /api/admin/notifications/unread-count
 *    (nếu không có endpoint này, fallback sang /api/notifications?unread=1&mine=1&limit=50)
 *
 * Props:
 *  - query, setQuery
 *  - theme, setTheme
 *  - openMobile, setOpenMobile
 */
export default function Topbar({
  query,
  setQuery,
  theme,
  setTheme,
  openMobile,
  setOpenMobile,
}) {
  const [user, setUser] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef(null);

  // Focus search bằng "/" hoặc Ctrl/Cmd + K
  useEffect(() => {
    function onKey(e) {
      const tag = (e.target?.tagName || "").toLowerCase();
      const isEditable =
        e.target?.isContentEditable ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select";
      if (isEditable) return;

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fetch user + unread notifications
  useEffect(() => {
    let stop = false;
    const ac = new AbortController();

    async function fetchUser() {
      try {
        const me = await apiGet("/api/me", { signal: ac.signal });
        if (!stop) setUser(me?.user || me || null);
      } catch {
        if (!stop) setUser(null);
      }
    }

    async function fetchUnreadCount() {
      try {
        const res = await apiGet("/api/admin/notifications/unread-count", {
          signal: ac.signal,
        });
        if (!stop) setNotifCount(Number(res?.count || 0));
      } catch {
        try {
          const list = await apiGet("/api/notifications?unread=1&mine=1&limit=50", {
            signal: ac.signal,
          });
          const items = Array.isArray(list) ? list : list?.items || [];
          if (!stop) setNotifCount(items.length || 0);
        } catch {
          if (!stop) setNotifCount(0);
        }
      }
    }

    (async () => {
      setLoading(true);
      await Promise.allSettled([fetchUser(), fetchUnreadCount()]);
      if (!stop) setLoading(false);
    })();

    // Auto refresh badge 60s/lần
    const iv = setInterval(() => {
      fetchUnreadCount();
    }, 60000);

    return () => {
      stop = true;
      ac.abort();
      clearInterval(iv);
    };
  }, []);

  const displayName = useMemo(() => {
    if (!user) return "";
    return user.full_name || user.name || user.email || "Admin";
  }, [user]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-300 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50">
      <div className="h-14 flex items-center gap-2 px-3 sm:px-4">
        {/* Mobile menu */}
        <button
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={() => setOpenMobile((v) => !v)}
          aria-label="Toggle sidebar"
        >
          {openMobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-600 text-white dark:bg-emerald-500">
            <Leaf className="h-4 w-4" />
          </span>
          <span className="hidden sm:block">
            Bữa Cơm Xanh • Admin
            {displayName ? (
              <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                ({displayName})
              </span>
            ) : null}
          </span>
        </div>

        {/* Search (desktop) */}
        <div className="hidden md:flex ml-4 flex-1 max-w-2xl">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              ref={searchRef}
              data-admin-search="1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm nhanh… (/, Ctrl+K)"
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeSwitcher theme={theme} setTheme={setTheme} />

          <button
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            title={notifCount > 0 ? `${notifCount} thông báo chưa đọc` : "Thông báo"}
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/admin/notifications";
              }
            }}
          >
            <Bell className="h-5 w-5" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] leading-4">
                {notifCount}
              </span>
            )}
          </button>

          <UserMenu user={user} loading={loading} />
        </div>
      </div>
    </header>
  );
}
