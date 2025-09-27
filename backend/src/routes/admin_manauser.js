// backend/src/routes/admin_manauser.js
// Admin Manage Users router — khớp DB hiện tại (không có cột last_login)

import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import "dotenv/config";

// ===== middlewares (fallback no-op nếu thiếu) =====
let requireAuth = (req, res, next) => next();
let requireRole = () => (req, res, next) => next();
try {
  const mw = await import("../middlewares/auth.js");
  requireAuth = mw.requireAuth || requireAuth;
  requireRole = mw.requireRole || requireRole;
} catch {}

// ===== DB bootstrap (MySQL | SQLite) =====
const useMySQL = (process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else          ({ db } = await import("../lib/db.js"));

async function dbAll(sql, params = []) {
  if (useMySQL) {
    if (typeof db.all === "function") return await db.all(sql, params);
    const [rows] = await db.query(sql, params);
    return rows ?? [];
  }
  return db.prepare(sql).all(...params);
}
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

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ===== constants =====
const SAFE_ROLES = ["user", "donor", "receiver", "shipper", "admin"];
const EXTRA_ROLES = ["donor", "receiver", "shipper"];
const SAFE_STATUS = ["active", "banned", "deleted"];

// ===== schema detection =====
let hasUserRoles = true;
let hasAuditLogs = true;
let idIsUuid = true;
async function detectSchema() {
  try {
    const check = await dbAll(
      useMySQL ? "SHOW TABLES LIKE 'user_roles'"
               : "SELECT name FROM sqlite_master WHERE type='table' AND name='user_roles'"
    );
    hasUserRoles = Array.isArray(check) && check.length > 0;
  } catch { hasUserRoles = false; }

  try {
    const check = await dbAll(
      useMySQL ? "SHOW TABLES LIKE 'audit_logs'"
               : "SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'"
    );
    hasAuditLogs = Array.isArray(check) && check.length > 0;
  } catch { hasAuditLogs = false; }

  try {
    const row = await dbGet("SELECT id FROM users LIMIT 1");
    if (row && row.id != null) idIsUuid = String(row.id).includes("-");
  } catch { idIsUuid = true; }
}
await detectSchema();

function toId(v) {
  if (idIsUuid) return String(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}
function nowSql() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}
async function sendEmail({ to, subject, html }) {
  try {
    const nodemailer = await import("nodemailer");
    const tr = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
    await tr.sendMail({ from, to, subject, html });
    return true;
  } catch (e) {
    console.warn("[mail] send failed:", e?.message);
    return false;
  }
}
async function fetchExtraRoles(userId) {
  if (!hasUserRoles) return [];
  const rows = await dbAll("SELECT role FROM user_roles WHERE user_id = ?", [userId]);
  return rows.map(r => r.role).filter(r => EXTRA_ROLES.includes(r));
}

// ===== sort map (⚠ không còn last_login) =====
const mapSort = {
  created_at: "u.created_at",
  updated_at: "u.updated_at",
  name:       "u.name",
  email:      "u.email",
  role:       "u.role",
  status:     "u.status",
  // frontend có option Last login; map mềm về created_at để không lỗi:
  last_login: "u.created_at",
};
const isAsc = (s) => String(s).toLowerCase() === "asc";

/* ======================= Helpers cho xoá force ======================= */
async function tableExists(name) {
  try {
    if (useMySQL) {
      const rows = await dbAll("SHOW TABLES LIKE ?", [name]);
      return Array.isArray(rows) && rows.length > 0;
    } else {
      const rows = await dbAll("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [name]);
      return Array.isArray(rows) && rows.length > 0;
    }
  } catch { return false; }
}

async function withTransaction(fn) {
  if (useMySQL) {
    const conn = db.getConnection ? await db.getConnection() : db;
    try {
      if (conn.beginTransaction) await conn.beginTransaction();
      else await dbRun("START TRANSACTION");
      const ret = await fn(conn);
      if (conn.commit) await conn.commit();
      else await dbRun("COMMIT");
      if (conn.release) conn.release();
      return ret;
    } catch (e) {
      try { if (conn.rollback) await conn.rollback(); else await dbRun("ROLLBACK"); } catch {}
      if (conn.release) conn.release();
      throw e;
    }
  } else {
    try { await dbRun("BEGIN"); } catch {}
    try {
      const ret = await fn(db);
      try { await dbRun("COMMIT"); } catch {}
      return ret;
    } catch (e) {
      try { await dbRun("ROLLBACK"); } catch {}
      throw e;
    }
  }
}

/* Xoá dữ liệu liên quan trước khi xoá users (dùng cho mode=force) */
async function wipeUserRelated(conn, userId) {
  const exec = async (sql, params = []) => {
    try {
      if (useMySQL && conn.query) { await conn.query(sql, params); }
      else                        { await dbRun(sql, params); }
    } catch (_) { /* bỏ qua lỗi nếu bảng/cột không tồn tại */ }
  };

  const plans = [
    // Bảng phụ phổ biến — thêm/bớt theo schema của bạn
    { table: "user_roles",         sql: "DELETE FROM user_roles WHERE user_id = ?" },
    { table: "password_resets",    sql: "DELETE FROM password_resets WHERE user_id = ?" },
    { table: "sessions",           sql: "DELETE FROM sessions WHERE user_id = ?" },
    { table: "audit_logs",         sql: "DELETE FROM audit_logs WHERE actor_id = ? OR target_id = ?", dual: true },
    { table: "notifications",      sql: "DELETE FROM notifications WHERE user_id = ?" },
    { table: "donations",          sql: "DELETE FROM donations WHERE user_id = ?" },
    { table: "deliveries",         sql: "DELETE FROM deliveries WHERE shipper_id = ? OR creator_id = ?", dual: true },
    { table: "delivery_reports",   sql: "DELETE FROM delivery_reports WHERE reporter_id = ?" },
    { table: "bookings",           sql: "DELETE FROM bookings WHERE user_id = ?" },
    { table: "campaign_followers", sql: "DELETE FROM campaign_followers WHERE user_id = ?" },
    { table: "comments",           sql: "DELETE FROM comments WHERE user_id = ?" },
    { table: "messages",           sql: "DELETE FROM messages WHERE sender_id = ? OR recipient_id = ?", dual: true },
  ];

  for (const p of plans) {
    if (await tableExists(p.table)) {
      if (p.dual) await exec(p.sql, [userId, userId]);
      else        await exec(p.sql, [userId]);
    }
  }
}

/* ======================= LIST ======================= */
router.get("/users", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const {
      q = "", role = "all", status = "all",
      sortBy = "created_at", order = "desc",
      page = 1, pageSize = 10,
      includeDeleted = "0", // ✅ thêm includeDeleted
    } = req.query;

    const sortCol = mapSort[sortBy] || "u.created_at";
    const ord = isAsc(order) ? "ASC" : "DESC";
    const p = Math.max(1, Number(page || 1));
    const ps = Math.min(200, Math.max(1, Number(pageSize || 10)));
    const offset = (p - 1) * ps;

    const where = [];
    const params = [];
    if (q) {
      where.push("(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (role && role !== "all") {
      if (role === "admin" || role === "user") {
        where.push("u.role = ?");
        params.push(role);
      } else if (EXTRA_ROLES.includes(role)) {
        if (hasUserRoles) {
          where.push("EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = ?)");
          params.push(role);
        } else {
          // không có bảng user_roles => bỏ lọc vai trò phụ
        }
      }
    }
    if (status && status !== "all" && SAFE_STATUS.includes(status)) {
      where.push("u.status = ?");
      params.push(status);
    } else {
      // ✅ mặc định ẨN user đã xoá
      if (String(includeDeleted) !== "1") {
        where.push("u.status <> 'deleted'");
      }
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const totalRow = await dbGet(`SELECT COUNT(*) AS n FROM users u ${whereSql}`, params);
    const total = Number(totalRow?.n || 0);

    // ⚠️ KHÔNG SELECT last_login
    const items = await dbAll(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.phone, u.address, u.avatar_url, u.created_at, u.updated_at
       FROM users u
       ${whereSql}
       ORDER BY ${sortCol} ${ord}
       LIMIT ${ps} OFFSET ${offset}`,
      params
    );

    // extraRoles
    for (const u of items) {
      u.roles = [u.role, ...(await fetchExtraRoles(u.id))];
      u.extraRoles = u.roles.filter(r => EXTRA_ROLES.includes(r) && r !== u.role);
      // frontend có field last_login -> để undefined/không gửi là được
    }

    // stats
    let stats = null;
    try {
      const s = await dbAll("SELECT status, COUNT(*) AS n FROM users GROUP BY status");
      const map = Object.fromEntries(s.map(r => [r.status, Number(r.n)]));
      const tot = await dbGet("SELECT COUNT(*) AS n FROM users");
      stats = {
        total: Number(tot?.n || 0),
        active: Number(map.active || 0),
        banned: Number(map.banned || 0),
        deleted: Number(map.deleted || 0),
      };
    } catch {}

    res.json({ items, total, page: p, pageSize: ps, stats });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: e?.message || "LIST_USERS_ERROR" });
  }
});

/* ======================= STATS ======================= */
router.get("/users/stats", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const s = await dbAll("SELECT status, COUNT(*) AS n FROM users GROUP BY status");
    const map = Object.fromEntries(s.map(r => [r.status, Number(r.n)]));
    const tot = await dbGet("SELECT COUNT(*) AS n FROM users");
    res.json({
      total: Number(tot?.n || 0),
      active: Number(map.active || 0),
      banned: Number(map.banned || 0),
      deleted: Number(map.deleted || 0),
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || "USERS_STATS_ERROR" });
  }
});

/* ======================= UPDATE ======================= */
router.patch("/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = toId(req.params.id);
  const { name, phone, address, status, roles } = req.body || {};
  try {
    const sets = [];
    const params = [];
    if (typeof name === "string")   { sets.push("name = ?"); params.push(name); }
    if (typeof phone === "string")  { sets.push("phone = ?"); params.push(phone); }
    if (typeof address === "string"){ sets.push("address = ?"); params.push(address); }
    if (typeof status === "string" && SAFE_STATUS.includes(status)) { sets.push("status = ?"); params.push(status); }
    if (sets.length) {
      params.push(id);
      await dbRun(`UPDATE users SET ${sets.join(", ")}, updated_at = ${useMySQL ? "CURRENT_TIMESTAMP()" : "CURRENT_TIMESTAMP"} WHERE id = ?`, params);
    }

    // update roles
    if (Array.isArray(roles) && roles.length) {
      const clean = Array.from(new Set(roles.map(String).filter((r) => SAFE_ROLES.includes(r))));
      const primary = clean.find(r => r === "admin") || clean.find(r => r === "user") || clean[0] || "user";
      const extras = clean.filter(r => EXTRA_ROLES.includes(r) && r !== primary);

      await dbRun("UPDATE users SET role = ? WHERE id = ?", [primary, id]);

      if (hasUserRoles) {
        await dbRun("DELETE FROM user_roles WHERE user_id = ?", [id]);
        for (const r of extras) {
          await dbRun("INSERT INTO user_roles (user_id, role) VALUES (?, ?)", [id, r]);
        }
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: e?.message || "UPDATE_USER_ERROR" });
  }
});

/* ======================= DELETE (soft | hard | force) ======================= */
router.delete("/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const id = toId(req.params.id);
  const mode = String(req.query.mode || "soft").toLowerCase(); // soft | hard | force

  try {
    if (mode === "soft") {
      await dbRun(
        "UPDATE users SET status = 'deleted', updated_at = " + (useMySQL ? "CURRENT_TIMESTAMP()" : "CURRENT_TIMESTAMP") + " WHERE id = ?",
        [id]
      );
      return res.json({ ok: true, mode: "soft" });
    }

    if (mode === "hard") {
      // cố xoá trực tiếp — nếu lỗi FK, trả gợi ý dùng force
      try {
        await dbRun("DELETE FROM users WHERE id = ?", [id]);
        return res.json({ ok: true, mode: "hard" });
      } catch (e) {
        return res.status(409).json({
          ok: false,
          message: "FOREIGN_KEY_CONSTRAINT",
          hint: "Dùng mode=force để xoá kèm dữ liệu liên quan",
          detail: e?.message,
        });
      }
    }

    if (mode === "force") {
      await withTransaction(async (conn) => {
        await wipeUserRelated(conn, id);
        if (useMySQL && conn.query)  await conn.query("DELETE FROM users WHERE id = ?", [id]);
        else                         await dbRun("DELETE FROM users WHERE id = ?", [id]);
      });
      return res.json({ ok: true, mode: "force" });
    }

    return res.status(400).json({ ok: false, message: "INVALID_MODE" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, message: err?.message || "DELETE_USER_ERROR" });
  }
});

/* ======================= RESET PASSWORD ======================= */
router.post("/users/:id/reset-password", requireAuth, requireRole("admin"), async (req, res) => {
  const id = toId(req.params.id);
  try {
    const temp = crypto.randomBytes(5).toString("base64url");
    const hash = await bcrypt.hash(temp, 10);
    let updated = false;
    try {
      await dbRun("UPDATE users SET password_hash = ?, updated_at = " + (useMySQL ? "CURRENT_TIMESTAMP()" : "CURRENT_TIMESTAMP") + " WHERE id = ?", [hash, id]);
      updated = true;
    } catch {}
    if (!updated) {
      await dbRun("UPDATE users SET password = ?, updated_at = " + (useMySQL ? "CURRENT_TIMESTAMP()" : "CURRENT_TIMESTAMP") + " WHERE id = ?", [hash, id]);
    }
    res.json({ ok: true, tempPassword: temp });
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || "RESET_PASSWORD_ERROR" });
  }
});

/* ======================= RESEND VERIFY ======================= */
router.post("/users/:id/resend-verify", requireAuth, requireRole("admin"), async (req, res) => {
  const id = toId(req.params.id);
  try {
    const user = await dbGet("SELECT id, email, name FROM users WHERE id = ?", [id]);
    if (!user) return res.status(404).json({ ok: false, message: "USER_NOT_FOUND" });

    const token = crypto.randomBytes(24).toString("base64url");
    try {
      await dbRun("UPDATE users SET verify_token = ?, verify_expires = ? WHERE id = ?", [token, new Date(Date.now() + 3600_000), id]);
    } catch {/* cột không tồn tại -> bỏ qua */}

    const verifyUrl = (process.env.APP_ORIGIN || "http://localhost:5173") + "/verify?token=" + token;
    await sendEmail({
      to: user.email,
      subject: "Xác thực email tài khoản",
      html: `<p>Xin chào ${user.name || user.email},</p>
             <p>Nhấn vào liên kết để xác thực email:</p>
             <p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || "RESEND_VERIFY_ERROR" });
  }
});

/* ======================= IMPERSONATE ======================= */
router.post("/users/:id/impersonate", requireAuth, requireRole("admin"), async (req, res) => {
  const id = toId(req.params.id);
  try {
    const user = await dbGet("SELECT id, email, role, status FROM users WHERE id = ?", [id]);
    if (!user) return res.status(404).json({ ok: false, message: "USER_NOT_FOUND" });
    if (user.status === "banned" || user.status === "deleted") {
      return res.status(400).json({ ok: false, message: "USER_NOT_ACTIVE" });
    }
    const token = jwt.sign(
      { sub: String(user.id), email: user.email, role: user.role, imp: true },
      process.env.JWT_SECRET || "dev_only_change_me",
      { expiresIn: "2h" }
    );
    res.json({ ok: true, token });
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || "IMPERSONATE_ERROR" });
  }
});

/* ======================= EXPORT CSV ======================= */
router.get("/users/export", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { q = "", role = "", status = "", sortBy = "created_at", order = "desc", ids = "" } = req.query;
    const sortCol = mapSort[sortBy] || "u.created_at";
    const ord = isAsc(order) ? "ASC" : "DESC";

    const where = [];
    const params = [];
    if (q) {
      where.push("(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (role) {
      if (role === "admin" || role === "user") {
        where.push("u.role = ?");
        params.push(role);
      } else if (EXTRA_ROLES.includes(role) && hasUserRoles) {
        where.push("EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = ?)");
        params.push(role);
      }
    }
    if (status && SAFE_STATUS.includes(status)) { where.push("u.status = ?"); params.push(status); }
    if (ids) {
      const arr = String(ids).split(",").map(x => x.trim()).filter(Boolean);
      if (arr.length) {
        const qs = arr.map(() => "?").join(",");
        where.push(`u.id IN (${qs})`);
        params.push(...arr);
      }
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await dbAll(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.phone, u.address, u.created_at, u.updated_at
       FROM users u
       ${whereSql}
       ORDER BY ${sortCol} ${ord}`,
      params
    );

    for (const r of rows) {
      r.extraRoles = (await fetchExtraRoles(r.id)).join("|");
    }

    const header = ["id","name","email","role","extraRoles","status","phone","address","created_at","updated_at"];
    const csv = [header.join(",")].concat(
      rows.map(r => header.map(k => safeCsv(r[k])).join(","))
    ).join("\n");

    const fname = `users_${new Date().toISOString().slice(0,10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    res.send("\uFEFF" + csv);
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || "EXPORT_USERS_ERROR" });
  }
});
function safeCsv(v) {
  if (v == null) return "";
  const s = String(v).replaceAll('"','""');
  if (/[",\n]/.test(s)) return `"${s}"`;
  return s;
}

/* ======================= IMPORT (CSV/XLSX) ======================= */
router.post("/users/import", requireAuth, requireRole("admin"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: "NO_FILE" });

    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

    let inserted = 0, duplicated = 0, failed = 0;

    for (const r of rows) {
      const email = (r.email || r.Email || "").trim().toLowerCase();
      if (!email) { failed++; continue; }
      const name = (r.name || r.Name || "").trim();
      const role = (r.role || "user").toString().toLowerCase();
      const status = (r.status || "active").toString().toLowerCase();
      const phone = (r.phone || "").toString();
      const address = (r.address || "").toString();

      try {
        const exist = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (exist) { duplicated++; continue; }

        const idVal = idIsUuid ? crypto.randomUUID() : undefined;
        const pwd = crypto.randomBytes(6).toString("base64url");
        const hash = await bcrypt.hash(pwd, 10);

        if (idIsUuid) {
          await dbRun(
            `INSERT INTO users (id, email, name, role, status, phone, address, password_hash, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [idVal, email, name || email, SAFE_ROLES.includes(role) ? role : "user", SAFE_STATUS.includes(status) ? status : "active", phone, address, hash, nowSql(), nowSql()]
          );
        } else {
          await dbRun(
            `INSERT INTO users (email, name, role, status, phone, address, password_hash, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [email, name || email, SAFE_ROLES.includes(role) ? role : "user", SAFE_STATUS.includes(status) ? status : "active", phone, address, hash, nowSql(), nowSql()]
          );
        }
        inserted++;
      } catch {
        failed++;
      }
    }

    res.json({ ok: true, inserted, duplicated, failed });
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || "IMPORT_USERS_ERROR" });
  }
});

/* ======================= AUDIT ======================= */
router.get("/audit", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    if (!hasAuditLogs) return res.json({ items: [] });
    const { actor = "", page = 1, pageSize = 30 } = req.query;
    const p = Math.max(1, Number(page || 1));
    const ps = Math.min(200, Math.max(1, Number(pageSize || 30)));
    const offset = (p - 1) * ps;

    const rows = await dbAll(
      `SELECT id, actor_id, action, target_id, detail, created_at
       FROM audit_logs
       ${actor ? "WHERE actor_id = ?" : ""}
       ORDER BY created_at DESC
       LIMIT ${ps} OFFSET ${offset}`,
      actor ? [toId(actor)] : []
    );
    res.json({ items: rows, page: p, pageSize: ps });
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || "AUDIT_LIST_ERROR" });
  }
});

export default router;
