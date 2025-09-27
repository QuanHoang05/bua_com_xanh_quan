// backend/src/routes/auth.reset.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import crypto from "crypto";
import "dotenv/config";

/* ---------- DB bootstrap (MySQL | SQLite) ---------- */
const useMySQL = (process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else          ({ db } = await import("../lib/db.js"));

async function dbGet(sql, params = []) {
  if (useMySQL) {
    if (typeof db.get === "function") return await db.get(sql, params);
    const [rows] = await db.query(sql, params);
    return rows?.[0] ?? null;
  }
  return db.prepare(sql).get(...params);
}
async function dbRun(sql, params = []) {
  if (useMySQL) {
    if (typeof db.run === "function") return await db.run(sql, params);
    const [ret] = await db.query(sql, params);
    return ret;
  }
  return db.prepare(sql).run(...params);
}
const NOW_SQL = useMySQL ? "NOW()" : "datetime('now')";

/* ---------- Ensure table otp_codes (+expires_at_ms) ---------- */
if (useMySQL) {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      code VARCHAR(10) NOT NULL,
      purpose VARCHAR(50) NOT NULL DEFAULT 'reset',
      expires_at DATETIME NOT NULL,
      expires_at_ms BIGINT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX (email), INDEX (purpose), INDEX (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  try { await dbRun(`ALTER TABLE otp_codes ADD COLUMN expires_at_ms BIGINT NULL`); } catch {}
} else {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'reset',
      expires_at TEXT NOT NULL,
      expires_at_ms INTEGER NULL,
      used_at TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  try { await dbRun(`ALTER TABLE otp_codes ADD COLUMN expires_at_ms INTEGER NULL`); } catch {}
}

/* ---------- Phát hiện kiểu cột id hiện có để quyết định có cần UUID hay không ---------- */
let OTP_NEEDS_UUID = false;
if (useMySQL) {
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM otp_codes LIKE 'id'");
    const c = Array.isArray(cols) ? cols[0] : cols;
    const type  = String(c?.Type || "");
    const extra = String(c?.Extra || "");
    // nếu KHÔNG auto_increment và kiểu CHAR/VARCHAR thì buộc phải chèn id thủ công
    OTP_NEEDS_UUID = !/auto_increment/i.test(extra) && /char|varchar/i.test(type);
    // dọn rác: nếu có bản ghi id='' do non-strict mode, đổi sang UUID
    await dbRun("UPDATE otp_codes SET id=UUID() WHERE id=''");
  } catch {}
}

/* ---------- Mail helper ---------- */
async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) { console.log("[MAIL-FALLBACK]", { to, subject, text }); return { ok: true, fallback: true }; }
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE ?? (port === 465)).toLowerCase() === "true" || port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port, secure,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@buacomxanh.local";
  await transporter.sendMail({ from, to, subject, text, html });
  return { ok: true };
}

const genCode = () => String(Math.floor(100000 + Math.random() * 900000));
export const authResetRouter = Router();

/* ===== helper: insert OTP (tự động kèm id=UUID nếu cần) ===== */
async function insertOtp({ email, code, expiresMs }) {
  const withId = useMySQL && OTP_NEEDS_UUID;
  const id = withId ? crypto.randomUUID() : undefined;

  try {
    if (useMySQL) {
      const cols = withId
        ? "(id, email, code, purpose, expires_at, expires_at_ms, created_at)"
        : "(email, code, purpose, expires_at, expires_at_ms, created_at)";
      const params = withId
        ? [id, email, code, expiresMs, expiresMs]
        : [email, code, expiresMs, expiresMs];
      await dbRun(
        `INSERT INTO otp_codes ${cols}
         VALUES (${withId ? "?, " : ""}?, ?, 'reset', FROM_UNIXTIME(?/1000), ?, ${NOW_SQL})`,
        params
      );
    } else {
      await dbRun(
        `INSERT INTO otp_codes (email, code, purpose, expires_at, expires_at_ms, created_at)
         VALUES (?, ?, 'reset', datetime(?/1000, 'unixepoch'), ?, ${NOW_SQL})`,
        [email, code, expiresMs, expiresMs]
      );
    }
  } catch (e) {
    const msg = String(e?.message || "");
    const noExpiresCol = /unknown column|no such column|expires_at_ms/i.test(msg);
    if (noExpiresCol) {
      if (useMySQL) {
        const cols = withId ? "(id, email, code, purpose, expires_at, created_at)" : "(email, code, purpose, expires_at, created_at)";
        const params = withId ? [id, email, code, expiresMs] : [email, code, expiresMs];
        await dbRun(
          `INSERT INTO otp_codes ${cols}
           VALUES (${withId ? "?, " : ""}?, ?, 'reset', FROM_UNIXTIME(?/1000), ${NOW_SQL})`,
          params
        );
      } else {
        await dbRun(
          `INSERT INTO otp_codes (email, code, purpose, expires_at, created_at)
           VALUES (?, ?, 'reset', datetime(?/1000, 'unixepoch'), ${NOW_SQL})`,
          [email, code, expiresMs]
        );
      }
      return;
    }
    console.error("OTP_INSERT_ERROR", msg);
    throw e;
  }
}

/* ===== POST /api/auth/forgot-password { email } ===== */
authResetRouter.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok:false, message:"Thiếu email" });

    const code = genCode();
    const expiresMs = Date.now() + 10 * 60 * 1000; // 10 phút
    await insertOtp({ email, code, expiresMs });

    const subj = "[Bữa Cơm Xanh] Mã OTP đặt lại mật khẩu";
    const text = `Mã OTP: ${code} (hết hạn sau 10 phút).`;
    const html = `<p>Mã OTP của bạn là: <b style="font-size:20px">${code}</b></p><p>Hết hạn sau 10 phút.</p>`;
    try { await sendMail({ to: email, subject: subj, text, html }); } catch (err) { console.warn("MAIL_ERROR", err?.message); }

    const dev = (process.env.NODE_ENV || "development") === "development";
    return res.json({ ok:true, message:"Nếu email tồn tại, mã OTP đã được gửi.", ...(dev ? { devCode: code } : {}) });
  } catch (e) {
    console.error("FORGOT_PASSWORD_ERROR", e?.message);
    return res.status(500).json({ ok:false, message:"Lỗi máy chủ" });
  }
});

/* ===== POST /api/auth/resend-otp { email } ===== */
authResetRouter.post("/resend-otp", async (req, res) => {
  req.url = "/forgot-password";
  return authResetRouter.handle(req, res);
});

/* ===== POST /api/auth/verify-otp { email, code|otp } ===== */
authResetRouter.post("/verify-otp", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const raw   = String(req.body?.code ?? req.body?.otp ?? "").trim();
    const code  = raw.replace(/\D/g, "");
    if (!email) return res.status(400).json({ ok:false, message:"Thiếu email" });
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ ok:false, message:"Mã OTP phải gồm 6 chữ số" });

    const row = await dbGet(
      "SELECT * FROM otp_codes WHERE email=? AND purpose='reset' ORDER BY created_at DESC, id DESC LIMIT 1",
      [email]
    );
    if (!row) return res.status(400).json({ ok:false, message:"Không tìm thấy OTP cho email này" });

    const expMs = row.expires_at_ms != null ? Number(row.expires_at_ms) : new Date(row.expires_at).getTime();
    if (!Number.isFinite(expMs) || Date.now() > expMs) return res.status(400).json({ ok:false, message:"OTP đã hết hạn" });
    if (row.used_at) return res.status(400).json({ ok:false, message:"OTP đã được dùng" });
    if (String(row.code) !== code) return res.status(400).json({ ok:false, message:"OTP không đúng" });

    return res.json({ ok:true, message:"OTP hợp lệ" });
  } catch (e) {
    console.error("VERIFY_OTP_ERROR", e?.message);
    return res.status(500).json({ ok:false, message:"Lỗi máy chủ" });
  }
});

/* ===== POST /api/auth/reset-password { email, code, newPassword } ===== */
authResetRouter.post("/reset-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const raw   = String(req.body?.code || "").trim();
    const code  = raw.replace(/\D/g, "");
    const newPassword = String(req.body?.newPassword || "");
    if (!email || !/^\d{6}$/.test(code) || newPassword.length < 8) {
      return res.status(400).json({ ok:false, message:"Thiếu dữ liệu hoặc mật khẩu < 8 ký tự" });
    }

    const row = await dbGet(
      "SELECT * FROM otp_codes WHERE email=? AND code=? AND purpose='reset' AND used_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1",
      [email, code]
    );
    if (!row) return res.status(400).json({ ok:false, message:"OTP không hợp lệ" });

    const expMs = row.expires_at_ms != null ? Number(row.expires_at_ms) : new Date(row.expires_at).getTime();
    if (!Number.isFinite(expMs) || Date.now() > expMs) return res.status(400).json({ ok:false, message:"OTP đã hết hạn" });

    const hash = await bcrypt.hash(newPassword, 10);
    await dbRun("UPDATE users SET password_hash=?, updated_at=" + NOW_SQL + " WHERE email=?", [hash, email]);
    await dbRun("UPDATE otp_codes SET used_at=" + NOW_SQL + " WHERE id=?", [row.id]);

    return res.json({ ok:true, message:"Đặt lại mật khẩu thành công" });
  } catch (e) {
    console.error("RESET_PASSWORD_ERROR", e?.message);
    return res.status(500).json({ ok:false, message:"Lỗi máy chủ" });
  }
});

export default authResetRouter;
