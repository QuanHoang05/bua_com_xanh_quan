// src/components/layout/Topbar.jsx
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import { useEffect, useRef, useState } from "react";
import NotificationBell from "../ui/NotificationBell.jsx";
import {
  Home, Users, Store, PlayCircle, Gamepad2, Search,
  MessageSquare, Grid, Settings as Cog, Package, BarChart3
} from "lucide-react";

function initials(name = "") {
  const p = name.trim().split(/\s+/);
  return (p[0]?.[0] || "").toUpperCase() + (p[1]?.[0] || "").toUpperCase();
}

const centerNav = [
  { to: "/", icon: Home, label: "Trang chủ", exact: true },
  { to: "/campaigns", icon: Store, label: "Chiến dịch" },
  { to: "/donors", icon: Users, label: "Nhà hảo tâm" },
  { to: "/recipients", icon: PlayCircle, label: "Người nhận" },
  { to: "/delivery", icon: Gamepad2, label: "Giao nhận" }, // đổi thành /deliveries nếu cần
];

export default function Topbar() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200 shadow-sm">
      <div className="h-14 px-3 flex items-center justify-between">
        {/* LEFT: Logo + Search */}
        <div className="flex items-center gap-2 flex-1">
          <Link to="/" className="flex items-center gap-2" aria-label="Trang chủ">
            <div className="w-10 h-10 rounded-full grid place-items-center text-white font-extrabold text-xl bg-emerald-600">
              B
            </div>
          </Link>

          {/* Search */}
          <div className="hidden md:flex items-center relative ml-2">
            <Search className="absolute left-3 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm kiếm trên Bữa Cơm Xanh"
              className="pl-10 pr-3 py-2 w-64 rounded-full bg-slate-100 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Tìm kiếm"
            />
          </div>
        </div>

        {/* CENTER: Nav icons */}
        <nav className="flex-1 flex justify-center gap-2 text-slate-600">
          {centerNav.map(({ to, icon: Icon, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={!!exact}
              className={({ isActive }) =>
                [
                  "relative group px-5 h-12 grid place-items-center rounded-xl transition",
                  "hover:bg-slate-100",
                  isActive ? "text-emerald-600" : "text-slate-600",
                ].join(" ")
              }
              aria-label={label}
              title={label}
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-6 h-6" />
                  <span
                    className={[
                      "pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-1 rounded-full",
                      "transition-all duration-300",
                      isActive ? "w-10 bg-emerald-600" : "w-0 bg-transparent group-hover:w-6 group-hover:bg-slate-300",
                    ].join(" ")}
                  />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* RIGHT: Actions */}
        <div className="flex items-center gap-3">
          <NavLink
            to="/reports"
            className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center hover:bg-slate-200"
            aria-label="Báo cáo" title="Báo cáo"
          >
            <Grid className="w-5 h-5" />
          </NavLink>

          <NavLink
            to="/messages"
            className="w-10 h-10 rounded-full bg-slate-100 grid place-items-center hover:bg-slate-200"
            aria-label="Tin nhắn" title="Tin nhắn"
          >
            <MessageSquare className="w-5 h-5" />
          </NavLink>

          <NotificationBell />

          {/* Avatar dropdown */}
          <div className="relative" ref={ref}>
            <button
              className="w-10 h-10 rounded-full overflow-hidden grid place-items-center border bg-slate-100 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              onClick={() => setOpen(v => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Mở menu tài khoản"
            >
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-slate-700">
                  {initials(user?.name || user?.email || "U S")}
                </span>
              )}
            </button>

            {open && (
              <div
                className="absolute right-0 mt-3 w-80 rounded-2xl border border-slate-200 bg-white shadow-[0_8px_32px_rgba(2,6,23,0.15)] p-2 z-50"
                role="menu"
              >
                {/* Header profile row */}
                <div className="px-3 py-3 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-200 grid place-items-center ring-2 ring-emerald-100">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-slate-700">
                        {initials(user?.name || user?.email || "U S")}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-slate-900 truncate">
                      {user?.name || "Người dùng"}
                    </div>
                    <div className="text-[13px] text-slate-600 truncate">
                      {user?.email}
                    </div>
                  </div>
                </div>

                <div className="my-2 h-px bg-slate-200" />

                {/* Menu items — chữ to, đậm, rõ; có icon trái */}
                <NavLink
                  to="/settings"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-slate-800 hover:bg-slate-50 focus:bg-slate-50"
                  role="menuitem"
                >
                  <Cog className="w-5 h-5 text-slate-500" />
                  <span className="font-medium">Cài đặt</span>
                </NavLink>

                <NavLink
                  to="/campaigns"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-slate-800 hover:bg-slate-50 focus:bg-slate-50"
                  role="menuitem"
                >
                  <Store className="w-5 h-5 text-slate-500" />
                  <span className="font-medium">Chiến dịch</span>
                </NavLink>

                <NavLink
                  to="/delivery"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-slate-800 hover:bg-slate-50 focus:bg-slate-50"
                  role="menuitem"
                >
                  <Package className="w-5 h-5 text-slate-500" />
                  <span className="font-medium">Giao nhận</span>
                </NavLink>

                <NavLink
                  to="/reports"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[15px] text-slate-800 hover:bg-slate-50 focus:bg-slate-50"
                  role="menuitem"
                >
                  <BarChart3 className="w-5 h-5 text-slate-500" />
                  <span className="font-medium">Báo cáo</span>
                </NavLink>

                <div className="mt-3 p-1">
                  <button
                    onClick={signOut}
                    className="w-full px-4 py-2.5 rounded-xl bg-rose-600 text-white text-[15px] font-semibold shadow hover:bg-rose-700 active:translate-y-px"
                  >
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
