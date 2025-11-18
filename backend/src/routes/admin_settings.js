// ESM — Admin Settings (GET/POST), driver-agnostic (MySQL | SQLite)
import { Router } from "express";
import "dotenv/config";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const useMySQL = (process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.js"));
else ({ db } = await import("../lib/db.js"));

/* --- small helpers --- */
async function dbGet(sql, params = []) {
  if (useMySQL) {
    if (typeof db.get === "function") return await db.get(sql, params);
    const [rows] = await db.query(sql, params);
    return rows?.[0] ?? null;
  }
  return db.prepare(sql).get(...params);
}
async function dbAll(sql, params = []) {
  if (useMySQL) {
    if (typeof db.all === "function") return await db.all(sql, params);
    const [rows] = await db.query(sql, params);
    return rows || [];
  }
  return db.prepare(sql).all(...params);
}
async function dbRun(sql, params = []) {
  if (useMySQL) {
    if (typeof db.run === "function") return await db.run(sql, params);
    const [ret] = await db.query(sql, params);
    return ret;
  }
  return db.prepare(sql).run(...params);
}

/* --- ensure table (id INT AUTO_INCREMENT for MySQL; INTEGER PRIMARY KEY for SQLite) --- */
const ensureTableSQL = useMySQL
  ? `CREATE TABLE IF NOT EXISTS site_settings (
       id INT PRIMARY KEY AUTO_INCREMENT,
       key_name VARCHAR(100) UNIQUE NOT NULL,
       value_json JSON NULL,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
     )`
  : `CREATE TABLE IF NOT EXISTS site_settings (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       key_name TEXT UNIQUE NOT NULL,
       value_json TEXT,
       updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`;

await dbRun(ensureTableSQL);

/* --- JSON utils --- */
const parseJson = (raw, fb = {}) => {
  try {
    if (raw == null) return fb;
    if (typeof raw === "object") return raw;
    return JSON.parse(raw);
  } catch {
    return fb;
  }
};
const toJSONValue = (obj) =>
  useMySQL ? JSON.stringify(obj) : JSON.stringify(obj);

/* --- default payload shape --- */
const DEFAULT_SETTINGS = {
  general: {
    site_name: "Bữa Cơm Xanh",
    site_email: "hello@greengive.local",
    hotline: "",
    address: "",
    theme: "system", // system | light | dark
    locale: "vi-VN",
    timezone: "Asia/Ho_Chi_Minh",
    currency: "VND",
  },
  branding: {
    logo_url: "",
    favicon_url: "",
    primary_color: "#10b981",
    secondary_color: "#0ea5e9",
  },
  email: {
    from_name: "Bữa Cơm Xanh",
    from_email: "no-reply@greengive.local",
    smtp_host: "",
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: "",
    smtp_pass: "",
    test_recipient: "",
  },
  payments: {
    enable_vietqr: true,
    vietqr_account: "",
    enable_momo: false,
    momo_partner_code: "",
    momo_access_key: "",
    momo_secret_key: "",
  },
  seo: {
    site_title: "Bữa Cơm Xanh • Admin",
    site_description: "Nền tảng thiện nguyện minh bạch và hiệu quả.",
    twitter_handle: "",
    og_image: "",
  },
  advanced: {
    maintenance_mode: false,
    allow_signup: true,
    telemetry: false,
  },
};

async function readAllSettings() {
  const rows = await dbAll("SELECT key_name, value_json FROM site_settings");
  const map = {};
  for (const r of rows) {
    map[r.key_name] = parseJson(useMySQL ? r.value_json : r.value_json);
  }
  // merge defaults (deep)
  return {
    ...DEFAULT_SETTINGS,
    ...map,
    general: { ...DEFAULT_SETTINGS.general, ...(map.general || {}) },
    branding: { ...DEFAULT_SETTINGS.branding, ...(map.branding || {}) },
    email: { ...DEFAULT_SETTINGS.email, ...(map.email || {}) },
    payments: { ...DEFAULT_SETTINGS.payments, ...(map.payments || {}) },
    seo: { ...DEFAULT_SETTINGS.seo, ...(map.seo || {}) },
    advanced: { ...DEFAULT_SETTINGS.advanced, ...(map.advanced || {}) },
  };
}
async function upsertSetting(key, valueObj) {
  const row = await dbGet("SELECT id FROM site_settings WHERE key_name = ?", [
    key,
  ]);
  const payload = toJSONValue(valueObj);
  if (row?.id) {
    await dbRun(
      "UPDATE site_settings SET value_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [payload, row.id]
    );
  } else {
    await dbRun(
      "INSERT INTO site_settings (key_name, value_json) VALUES (?, ?)",
      [key, payload]
    );
  }
}

const router = Router();

/* --- GET settings --- */
router.get(
  "/admin/settings",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const settings = await readAllSettings();
      res.json(settings);
    } catch (e) {
      res
        .status(500)
        .json({ ok: false, message: e?.message || "Server error" });
    }
  }
);

/* --- POST settings (full document upsert) --- */
router.post(
  "/admin/settings",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const incoming = req.body || {};
      // Validate basics (ví dụ)
      if (
        incoming?.general?.site_email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(incoming.general.site_email)
      ) {
        return res
          .status(400)
          .json({ ok: false, message: "Email website không hợp lệ" });
      }
      // upsert từng block để dễ mở rộng
      const keys = [
        "general",
        "branding",
        "email",
        "payments",
        "seo",
        "advanced",
      ];
      for (const k of keys) {
        if (incoming[k]) await upsertSetting(k, incoming[k]);
      }
      res.json({ ok: true });
    } catch (e) {
      res
        .status(500)
        .json({ ok: false, message: e?.message || "Server error" });
    }
  }
);

/* --- POST test email (tùy chọn) --- */
router.post(
  "/admin/settings/test-email",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const s = await readAllSettings();
      const { to } = req.body || {};
      // nếu dự án đã có nodemailer:
      let sent = false;
      try {
        const nodemailer = (await import("nodemailer")).default;
        const transporter = nodemailer.createTransport({
          host: s.email.smtp_host,
          port: s.email.smtp_port,
          secure: !!s.email.smtp_secure,
          auth: s.email.smtp_user
            ? { user: s.email.smtp_user, pass: s.email.smtp_pass }
            : undefined,
        });
        const info = await transporter.sendMail({
          from: `${s.email.from_name} <${s.email.from_email}>`,
          to: to || s.email.test_recipient,
          subject: "Test email • Bữa Cơm Xanh",
          text: "Xin chào, đây là email kiểm tra cấu hình SMTP.",
        });
        sent = !!info?.messageId;
      } catch {}
      if (!sent)
        return res
          .status(400)
          .json({ ok: false, message: "Gửi email thử thất bại" });
      res.json({ ok: true });
    } catch (e) {
      res
        .status(500)
        .json({ ok: false, message: e?.message || "Server error" });
    }
  }
);

export default router;
