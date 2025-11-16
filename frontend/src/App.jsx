// src/App.jsx
import React, { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";

/* ========================
   Lazy pages & layouts
======================== */
import Layout from "./components/layout/Layout";

// User pages
const Overview = lazy(() => import("./pages/Overview"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const CampaignReport = lazy(() => import("./pages/CampaignReport"));
const Donors = lazy(() => import("./pages/Donors"));
const Recipients = lazy(() => import("./pages/Recipients"));
const Shippers = lazy(() => import("./shipper/Shippers"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Delivery = lazy(() => import("./pages/Delivery"));

// ✨ Donor feature pages
const DonorDonate = lazy(() => import("./pages/DonorDonate"));
const DonorHistory = lazy(() => import("./pages/DonorHistory"));
const DonorPickup  = lazy(() => import("./pages/DonorPickup"));
const SupportChat  = lazy(() => import("./pages/SupportChat"));

// Auth pages
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const VerifyOtp = lazy(() => import("./pages/VerifyOtp"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// Admin
const RequireAdmin = lazy(() => import("./auth/RequireAdmin"));
const AdminLayout = lazy(() => import("./admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./admin/AdminUsers"));
const AdminPlaceholder = lazy(() => import("./admin/AdminPlaceholder"));
const AdminCampaigns = lazy(() => import("./admin/AdminCampaigns"));
const AdminBookings = lazy(() => import("./admin/AdminBookings"));
const AdminDeliveries = lazy(() => import("./admin/AdminDeliveries"));
const AdminPickupPoints = lazy(() => import("./admin/AdminPickupPoints"));
const AdminPages = lazy(() => import("./admin/AdminPages"));
const AdminAnnouncements = lazy(() => import("./admin/AdminAnnouncements"));
const AdminPayments = lazy(() => import("./admin/AdminPayments"));
const AdminAudit = lazy(() => import("./admin/AdminAudit"));

/* ========================
   Small utilities
======================== */
function Loader({ message = "Đang tải..." }) {
  return (
    <div className="w-full py-16 flex items-center justify-center text-slate-500">
      {message}
    </div>
  );
}

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname, location.search, location.hash]);
  return null;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || "Đã xảy ra lỗi." };
  }
  componentDidCatch(error, info) {
    console.error("App ErrorBoundary:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-6 rounded-xl border bg-white shadow-sm text-red-600">
          <div className="font-semibold mb-1">Đã xảy ra lỗi khi hiển thị trang.</div>
          <div className="text-sm">{this.state.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ========================
   Route guards
======================== */
function useAuthState() {
  const ctx = useAuth?.() || {};
  const user = ctx.user ?? null;
  const loading = ctx.loading ?? ctx.isLoading ?? (ctx.user === undefined);
  return { user, loading };
}

function Protected({ children }) {
  const { user, loading } = useAuthState();
  const location = useLocation();

  if (loading) return <Loader message="Đang xác thực..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuthState();
  const location = useLocation();

  if (loading) return <Loader message="Đang tải..." />;
  if (user) {
    const backTo = location.state?.from?.pathname || "/";
    return <Navigate to={backTo} replace />;
  }
  return children;
}

// 🟢 Guard dành riêng cho Shipper
function RequireShipper({ children }) {
  const { user, loading } = useAuthState();
  const location = useLocation();

  if (loading) return <Loader message="Đang xác thực..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  if (user.role !== "shipper") {
    return (
      <div className="p-6 text-center text-red-600">
        Bạn không có quyền truy cập vào trang này.
      </div>
    );
  }

  return children;
}

/* ========================
   App Routes
======================== */
export default function App() {
  return (
    <>
      <ScrollToTop />
      <ErrorBoundary>
        <Suspense fallback={<Loader />}>
          <Routes>
            {/* Guest-only */}
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <Login />
                </PublicOnly>
              }
            />
            <Route
              path="/register"
              element={
                <PublicOnly>
                  <Register />
                </PublicOnly>
              }
            />
            <Route
              path="/forgot"
              element={
                <PublicOnly>
                  <ForgotPassword />
                </PublicOnly>
              }
            />
            <Route
              path="/verify-otp"
              element={
                <PublicOnly>
                  <VerifyOtp />
                </PublicOnly>
              }
            />
            <Route
              path="/reset-password"
              element={
                <PublicOnly>
                  <ResetPassword />
                </PublicOnly>
              }
            />

            {/* User area */}
            <Route
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route index element={<Overview />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="campaigns/:id" element={<CampaignDetail />} />
              <Route path="campaigns/:id/report" element={<CampaignReport />} />

              {/* Donor */}
              <Route path="donors" element={<Donors />} />
              <Route path="donor/donate" element={<DonorDonate />} />
              <Route path="donor/history" element={<DonorHistory />} />
              <Route path="donor/donations" element={<DonorHistory />} />
              <Route path="donor/pickup" element={<DonorPickup />} />
              <Route path="support/chat" element={<SupportChat />} />

              {/* Delivery & Recipients */}
              <Route path="delivery" element={<Delivery />} />
              <Route path="deliveries" element={<Navigate to="/delivery" replace />} />
              <Route path="recipients" element={<Recipients />} />

              {/* 🟢 Shipper riêng */}
              <Route
                path="shippers"
                element={
                  <RequireShipper>
                    <Shippers />
                  </RequireShipper>
                }
              />

              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Admin area */}
            <Route
              path="/admin"
              element={
                <Protected>
                  <RequireAdmin>
                    <AdminLayout />
                  </RequireAdmin>
                </Protected>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="foods" element={<AdminPlaceholder title="Foods Moderation" />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="deliveries" element={<AdminDeliveries />} />
              <Route path="campaigns" element={<AdminCampaigns />} />
              <Route path="pickup-points" element={<AdminPickupPoints />} />
              <Route path="pages" element={<AdminPages />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="announcements" element={<AdminAnnouncements />} />
              <Route path="audit" element={<AdminAudit />} />
              <Route path="settings" element={<AdminPlaceholder title="Site Settings" />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}
