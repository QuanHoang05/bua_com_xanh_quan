// src/admin/AdminLayout.jsx
// Admin shell: topbar tách riêng, sidebar tái sử dụng, màu sắc rõ ràng

import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Users, Settings, Landmark } from "lucide-react";

import MENU from "./menu";
import { AdminSidebar, SidebarSlideIn } from "./Admin_Sidebar";
import Topbar from "./layout/Topbar";

export default function AdminLayout() {
  const loc = useLocation();
  const navigate = useNavigate();

  const [openMobile, setOpenMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("admin.sidebar.collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "system";
    } catch {
      return "system";
    }
  });
  const [query, setQuery] = useState("");

  const SBW = collapsed ? 80 : 280;

  // đóng drawer khi đổi route
  useEffect(() => setOpenMobile(false), [loc.pathname]);

  // nhớ trạng thái thu gọn sidebar
  useEffect(() => {
    try {
      localStorage.setItem("admin.sidebar.collapsed", collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  // theme
  useEffect(() => {
    const root = document.documentElement;
    const sysDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && sysDark);
    root.classList.toggle("dark", isDark);
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  // filter menu theo ô search
  const filteredMenu = useMemo(() => {
    if (!query.trim()) return MENU;
    const q = query.toLowerCase();
    return MENU
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((i) => i.label.toLowerCase().includes(q)),
      }))
      .filter((sec) => sec.items.length);
  }, [query]);

  // hotkey "/" hoặc Ctrl+K để focus search
  useEffect(() => {
    const onKey = (e) => {
      const a = document.activeElement;
      const typing =
        a &&
        (a.tagName === "INPUT" ||
          a.tagName === "TEXTAREA" ||
          a.getAttribute("contenteditable") === "true");
      if (typing) return;
      if (e.key === "/" || (e.ctrlKey && /k/i.test(e.key))) {
        const el = document.querySelector('input[data-admin-search="1"]');
        if (el) {
          e.preventDefault();
          el.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // quick actions trong sidebar
  const actions = [
    { label: "Tạo chiến dịch", icon: Plus, onClick: () => navigate("/admin/campaigns?create=1") },
    { label: "Mời user", icon: Users, onClick: () => navigate("/admin/users?invite=1") },
    { label: "Cài đặt", icon: Settings, onClick: () => navigate("/admin/settings") },
    { label: "Báo cáo", icon: Landmark, onClick: () => navigate("/admin/payments") },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 subpixel-antialiased">
      {/* Topbar */}
      <Topbar
        query={query}
        setQuery={setQuery}
        theme={theme}
        setTheme={setTheme}
        notifications={3}
        openMobile={openMobile}
        setOpenMobile={setOpenMobile}
      />

      {/* Sidebar desktop */}
      <aside
        className="hidden md:block fixed top-14 left-0 z-40 h-[calc(100vh-56px)] bg-white border-r border-slate-300"
        style={{ width: SBW }}
      >
        <AdminSidebar
          menu={filteredMenu}
          actions={actions}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          query={query}
          setQuery={setQuery}
          withHeader
        />
      </aside>

      {/* Sidebar mobile (drawer) */}
      <AnimatePresence>
        {openMobile && (
          <motion.div
            key="mobile-drawer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-40"
          >
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setOpenMobile(false)}
            />
            <SidebarSlideIn>
              <div className="h-[100vh] bg-white border-r border-slate-300">
                <AdminSidebar
                  menu={filteredMenu}
                  actions={actions}
                  collapsed={false}
                  setCollapsed={() => {}}
                  query={query}
                  setQuery={setQuery}
                  withHeader
                />
              </div>
            </SidebarSlideIn>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nội dung (transition mượt) */}
      <main className="pt-14">
        <div className="px-3 sm:px-4 md:px-6">
          <div className="rounded-2xl border border-slate-300 bg-white shadow-sm">
            <div className="mx-auto w-full max-w-7xl p-3 sm:p-4 md:p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={loc.pathname}
                  initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(2px)" }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Đồng bộ padding theo độ rộng sidebar khi ≥ md */}
      <style>{`
        @media (min-width: 768px) {
          header { padding-left: ${SBW}px; }
          main   { margin-left: ${SBW}px; }
        }
      `}</style>
    </div>
  );
}
