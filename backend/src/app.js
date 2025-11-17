// src/app.js (ESM)
import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";

/* ---------- Schema bootstrap (MySQL) ---------- */
import { ensureMySQLSchema } from "./lib/ensure-mysql.js";

/* ---------- Routers ---------- */
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import { authResetRouter } from "./routes/auth.reset.js";
import usersRouter from "./routes/users.js";
import overviewRouter from "./routes/overview.js";
import foodsRouter from "./routes/foods.js";
import mealsRouter from "./routes/meals.js";
import campaignsRouter from "./routes/campaigns.js";
import adminCampaignsRouter, {
  donationsRouter,
} from "./routes/admincampaigns.js";
import donorsRouter from "./routes/donors.js";
import recipientsRouter from "./routes/recipients.js";
import shippersRouter from "./routes/shippers.js";
import uploadRouter from "./routes/upload.js";
import adminRouter from "./routes/admin.js";
import vietqrWebhook from "./routes/webhooks.vietqr.js";
import paymentsRouter from "./routes/payments.js";
import momoRouter from "./routes/payments.momo.js";
import siteSettingsRouter from "./routes/site_settings.js";
import pickupPointsRouter from "./routes/pickup_points.js";
import reportsPublicRouter from "./routes/reports.public.js";
import paymentsImportRouter from "./routes/payments.import.js";
import testReportRouter from "./routes/testReport.js";
import announcementsRouter from "./routes/announcements.js";
import deliveriesRouter from "./routes/deliveries.js";
import { bookingsRouter } from "./routes/bookings.js";
import adminDeliveriesRouter from "./routes/admin.deliveries.js";
import adminBookingRouter from "./routes/admin_booking.js";
import adminPaymentsRouter from "./routes/admin.payments.js";
import adminManaUserRouter from "./routes/admin_manauser.js";
import { requireAuth, requireRole } from "./middlewares/auth.js";
import adminSettingsRouter from "./routes/admin_settings.js";
import analyticsDeliveriesRouter from "./routes/analytics.deliveries.js";

/* ====== Init schema (MySQL only) ====== */
// Ensure MySQL schema is in place when using MySQL driver (required for integration tests).
// This runs migrations/schema creation when DB_DRIVER is 'mysql'.
if ((process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql") {
  await ensureMySQLSchema();
}

const app = express();
// In test environment we disable 'trust proxy' to avoid express-rate-limit
// throwing ERR_ERL_PERMISSIVE_TRUST_PROXY when running locally.
const trustProxyValue = process.env.NODE_ENV === "test" ? false : true;
app.set("trust proxy", trustProxyValue);

/* ---------- CORS ---------- */
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4000",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "http://127.0.0.1:4000",
];
const ENV_ORIGINS = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = [...new Set([...DEFAULT_ORIGINS, ...ENV_ORIGINS])];

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test"
        ? function (_origin, cb) {
            return cb(null, true);
          }
        : function (origin, cb) {
            if (!origin) return cb(null, true);
            if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
            return cb(new Error("Not allowed by CORS: " + origin));
          },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "Cache-Control",
      "Pragma",
      "X-Requested-With",
    ],
    exposedHeaders: ["Content-Length"],
    maxAge: 86400,
  })
);
app.options(
  "*",
  cors({
    origin: (_origin, cb) => cb(null, true),
    credentials: true,
  })
);

// Security headers
app.use(helmet());

// Global rate limiter (moderate)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Stricter limiter for auth endpoints (prevent brute-force)
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth", authLimiter);

/* ---------- Parsers & logger ---------- */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
// Disable morgan logging in test environment for cleaner test output
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

/* ---------- ESM __dirname ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------- Static uploads ---------- */
app.use(
  "/uploads",
  express.static(path.resolve(__dirname, "..", "uploads"), {
    maxAge: "7d",
    immutable: false,
  })
);

/* ---------- Attach req.user from JWT (Header hoặc Cookie) ---------- */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
app.use((req, _res, next) => {
  try {
    const h = req.headers.authorization || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    let token = m?.[1];
    if (!token && req.cookies?.token) token = req.cookies.token; // fallback cookie
    if (token) req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    // ignore invalid/expired token
  }
  next();
});

/* ---------- Route riêng cho shipper (mẫu) ---------- */
app.get("/api/shipper/me", requireAuth, requireRole("shipper"), (req, res) => {
  res.json({ message: "Xin chào shipper!", user: req.user });
});

/* ---------- Webhooks ---------- */
app.use("/api/webhooks", express.json({ type: "*/*" }), vietqrWebhook);

/* ---------- Public & feature routers ---------- */
app.use("/api/health", healthRouter);

// Conditionally mount testing routes only in 'test' environment
if (process.env.NODE_ENV === "test") {
  const testingRouter = (await import("./routes/testing.js")).default;
  app.use("/api/testing", testingRouter);
  console.log("✅ [INFO] Testing routes are enabled for E2E tests.");
}

app.use("/api/auth", authRouter);
app.use("/api/auth", authResetRouter);

app.use("/api/users", usersRouter);
app.use("/api/foods", foodsRouter);
app.use("/api/meals", mealsRouter);
app.use("/api/donor", donorsRouter);
app.use("/api/recipients", recipientsRouter);
app.use("/api/shipper", shippersRouter);

app.use("/api/campaigns", campaignsRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/pickup-points", pickupPointsRouter);
app.use("/api/site-settings", siteSettingsRouter);

app.use("/api/deliveries", deliveriesRouter);
app.use("/api", bookingsRouter);
app.use("/api/reports", reportsPublicRouter);
app.use("/api", paymentsImportRouter);

// Route phục vụ báo cáo test (HTML) — chỉ hiển thị file tạo bởi IntegrationTest
app.use("/test-report", testReportRouter);

app.use("/api/payments", paymentsRouter);
app.use("/api/payments/momo", momoRouter);
app.use("/api", adminSettingsRouter);

app.use("/api", uploadRouter);

/* ---------- Admin routers (CHÚ Ý THỨ TỰ) ---------- */
/* Đặt router cụ thể TRƯỚC các router admin tổng hợp để tránh bắt nhầm route */
app.use("/api/admin/campaigns", adminCampaignsRouter); // /api/admin/campaigns/...
app.use("/api/admin/donations", donationsRouter); // /api/admin/donations/...
app.use("/api/admin/deliveries", adminDeliveriesRouter); // /api/admin/deliveries/...
app.use(
  "/api/admin/payments",
  requireAuth,
  requireRole("admin"),
  adminPaymentsRouter
); // /api/admin/payments
app.use("/api/admin", adminBookingRouter); // /api/admin/bookings...
app.use(
  "/api/admin/users",
  requireAuth,
  requireRole("admin"),
  adminManaUserRouter
); // /api/admin/users...
app.use("/api/admin", adminRouter); // cuối cùng
app.use("/api/analytics", analyticsDeliveriesRouter);

/* ---------- Overview (tổng hợp) ---------- */
app.use("/api", overviewRouter);

/* ---------- Friendly root ---------- */
app.get("/", (_req, res) => {
  res.send("BuaComXanh API is running. Try GET /api/health");
});
app.get("/favicon.ico", (_req, res) => res.status(204).end());

/* ---------- 404 ---------- */
app.use((req, res) =>
  res.status(404).json({ error: "Not Found", path: req.originalUrl })
);

/* ---------- Error handler ---------- */
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.message === "ONLY_IMAGE_ALLOWED") {
    return res.status(415).json({
      error: "Chỉ cho phép file ảnh (png, jpg, jpeg, webp, gif, svg)",
    });
  }
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File quá lớn (tối đa 5MB)" });
  }
  res
    .status(err?.statusCode || err?.status || 500)
    .json({ error: err?.message || "Internal Server Error" });
});

export default app;
