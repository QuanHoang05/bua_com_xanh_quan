// Menu điều hướng (đổi/gộp tại đây là áp toàn hệ thống)
import {
  LayoutDashboard, Users, Utensils, CalendarCheck2, Truck,
  Layers, Landmark, FileText, Megaphone, ScrollText, Settings
} from "lucide-react";

const MENU = [
  {
    label: "Trang chính",
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Quản trị",
    items: [
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/bookings", label: "Bookings", icon: CalendarCheck2 },
      { to: "/admin/deliveries", label: "Deliveries", icon: Truck },
    ],
  },
  {
    label: "Chiến dịch & CMS",
    items: [
      { to: "/admin/campaigns", label: "Campaigns", icon: Layers },
      { to: "/admin/pickup-points", label: "Pickup points", icon: Landmark },
      { to: "/admin/pages", label: "CMS Pages", icon: FileText },
    ],
  },
  {
    label: "Tài chính & Hệ thống",
    items: [
      { to: "/admin/payments", label: "Payments", icon: Landmark },
      { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { to: "/admin/audit", label: "Audit logs", icon: ScrollText },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default MENU;
