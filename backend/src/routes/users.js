// backend/src/routes/users.js — final
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

/* =========================
   DB bootstrap
========================= */
const useMySQL = (process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";
let db;
if (useMySQL) {
  ({ db } = await import("../lib/db.mysql.js"));
} else {
  ({ db } = await import("../lib/db.js"));
}
const NOW_SQL = useMySQL ? "NOW()" : "CURRENT_TIMESTAMP";

/* =========================
   DB helpers (agnostic)
========================= */
async function get(sql, params = []) {
  if (useMySQL) {
    if (typeof db.get === "function") return await db.get(sql, params);
    if (typeof db.query === "function") {
      const [rows] = await db.query(sql, params);
      return rows?.[0] ?? null;
    }
    throw new Error("MySQL adapter missing .get/.query");
  }
  return db.prepare(sql).get(...params);
}
async function all(sql, params = []) {
  if (useMySQL) {
    if (typeof db.all === "function") return await db.all(sql, params);
    if (typeof db.query === "function") {
      const [rows] = await db.query(sql, params);
      return rows ?? [];
    }
    throw new Error("MySQL adapter missing .all/.query");
  }
  return db.prepare(sql).all(...params);
}
async function run(sql, params = []) {
  if (useMySQL) {
    if (typeof db.run === "function") return await db.run(sql, params);
    if (typeof db.query === "function") {
      const [ret] = await db.query(sql, params);
      return ret;
    }
    throw new Error("MySQL adapter missing .run/.query");
  }
  return db.prepare(sql).run(...params);
}
function insertedId(ret) {
  return ret?.insertId ?? ret?.lastInsertRowid ?? ret?.lastID ?? null;
}

/* =========================
   User Full Profile helpers
========================= */
function safeParseJSON(v, fallback = null) {
  try {
    if (v == null) return fallback;
    if (typeof v === "string") return JSON.parse(v);
    return v;
  } catch {
    return fallback;
  }
}
async function getUserCoreById(uid) {
  return await get(
    "SELECT id,email,name,avatar_url,role,address,phone,status,lat,lng,created_at,updated_at,meals_received FROM users WHERE id=?",
    [uid]
  );
}
async function buildFullUserProfile(uid) {
  const user = await getUserCoreById(uid);
  if (!user) return null;

  // Roles (optional table)
  let roles = [];
  try {
    const rolesRows = await all("SELECT role FROM user_roles WHERE user_id=?", [
      uid,
    ]);
    roles = (rolesRows || []).map((r) => r.role);
  } catch {}

  // Preferences (optional)
  let preferences = null;
  try {
    const prefs = await get(
      "SELECT diet_tags, radius_km, notif_email, notif_push FROM user_preferences WHERE user_id=?",
      [uid]
    );
    preferences = prefs
      ? {
          diet_tags: safeParseJSON(prefs.diet_tags, []),
          radius_km: Number(prefs.radius_km ?? 10),
          notif_email: !!prefs.notif_email,
          notif_push: !!prefs.notif_push,
        }
      : null;
  } catch {}

  // Addresses (optional)
  let addresses = [];
  try {
    addresses = await all(
      "SELECT id,label,line1,ward,district,province,lat,lng,is_default,created_at,updated_at FROM addresses WHERE user_id=? ORDER BY is_default DESC, id ASC",
      [uid]
    );
  } catch {}

  // Stats (optional)
  const stats = {};
  try {
    const r = await get(
      "SELECT COUNT(1) AS c FROM food_items WHERE owner_id=?",
      [uid]
    );
    stats.items = Number(r?.c || 0);
  } catch {
    stats.items = 0;
  }
  try {
    const r = await get(
      "SELECT COUNT(1) AS c FROM bookings WHERE receiver_id=?",
      [uid]
    );
    stats.bookings_received = Number(r?.c || 0);
  } catch {
    stats.bookings_received = 0;
  }
  try {
    const r = await get(
      "SELECT COUNT(1) AS cnt, COALESCE(SUM(CASE WHEN status='success' THEN amount ELSE 0 END),0) AS sum_amount FROM donations WHERE user_id=?",
      [uid]
    );
    stats.donations = {
      count: Number(r?.cnt || 0),
      sum_amount: Number(r?.sum_amount || 0),
      currency: "VND",
    };
  } catch {
    stats.donations = { count: 0, sum_amount: 0, currency: "VND" };
  }
  try {
    const r = await get("SELECT COUNT(1) AS c FROM payments WHERE payer_id=?", [
      uid,
    ]);
    stats.payments = { count: Number(r?.c || 0) };
  } catch {
    stats.payments = { count: 0 };
  }

  return { user, roles, preferences, addresses, stats };
}

/* =========================
   Auth helpers
========================= */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
function parseAuthIfMissing(req, _res, next) {
  if (req.user?.id) return next();
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return next();
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    req.user = { id: payload.id, email: payload.email, role: payload.role };
  } catch {
    // ignore; requireAuth sẽ chặn nếu cần
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user?.id)
    return res.status(401).json({ message: "Unauthenticated" });
  next();
}
function signToken(user, opts = {}) {
  const payload = { id: user.id, email: user.email, role: user.role };
  const expiresIn = opts.expiresIn || "7d";
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/* =========================
   Router
========================= */

const router = Router();
router.use(parseAuthIfMissing);

// GET /api/users — list users (paginated, for admin or authenticated users)
router.get("/", requireAuth, async (req, res) => {
  try {
    // Only admin can see all users, others see only themselves
    const isAdmin = req.user?.role === "admin";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.max(
      1,
      Math.min(50, parseInt(req.query.pageSize) || 20)
    );
    const offset = (page - 1) * pageSize;
    let where = "";
    let params = [];
    if (!isAdmin) {
      where = "WHERE id=?";
      params = [req.user.id];
    }
    const rows = await all(
      `SELECT id, email, name, avatar_url, role, address, phone, status, created_at, updated_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const totalRow = isAdmin
      ? await get("SELECT COUNT(*) AS total FROM users", [])
      : { total: 1 };
    res.json({
      ok: true,
      items: rows,
      total: totalRow?.total ?? rows.length,
      page,
      pageSize,
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || "Server error" });
  }
});

/* ---------- Probes: check/exists email/phone ---------- */
// GET /api/users/check?email=... | ?phone=...
// GET /api/users/exists?email=... | ?phone=...
async function handleExists(req, res) {
  const email = String(req.query.email || "")
    .trim()
    .toLowerCase();
  const phone = String(req.query.phone || "").trim();
  try {
    if (email) {
      const row = await get("SELECT id FROM users WHERE email=?", [email]);
      return res.json({ exists: !!row, field: "email" });
    }
    if (phone) {
      const row = await get("SELECT id FROM users WHERE phone=?", [phone]);
      return res.json({ exists: !!row, field: "phone" });
    }
    return res
      .status(400)
      .json({ error: "missing_query", message: "Provide email or phone" });
  } catch (e) {
    return res
      .status(500)
      .json({ error: "server_error", message: e?.message || "Server error" });
  }
}
router.get("/check", handleExists);
router.get("/exists", handleExists);

/* ---------- AUTH ---------- */

// GET /api/users/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    const wantFull = String(req.query.full || "").trim() === "1";

    if (wantFull) {
      const full = await buildFullUserProfile(uid);
      if (!full) return res.status(404).json({ message: "User not found" });
      return res.json(full);
    }

    const row = await get(
      "SELECT id,email,name,avatar_url,role,address,phone,status,lat,lng,created_at,updated_at FROM users WHERE id=?",
      [uid]
    );
    if (!row) return res.status(404).json({ message: "User not found" });
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

// GET /api/users/me/full
router.get("/me/full", requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    const full = await buildFullUserProfile(uid);
    if (!full) return res.status(404).json({ message: "User not found" });
    res.json(full);
  } catch (e) {
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

// PATCH /api/users/me
router.patch("/me", requireAuth, async (req, res) => {
  const uid = req.user.id;
  const {
    name = "",
    address = "",
    avatar_url = "",
    phone = "",
    lat = null,
    lng = null,
  } = req.body || {};

  try {
    try {
      await run(
        "UPDATE users SET name=?, address=?, avatar_url=?, phone=?, lat=?, lng=?, updated_at=" +
          NOW_SQL +
          " WHERE id=?",
        [name, address, avatar_url, phone, lat, lng, uid]
      );
    } catch (e) {
      if (/no such column|unknown column/i.test(String(e?.message || ""))) {
        await run(
          "UPDATE users SET name=?, address=?, avatar_url=?, phone=?, updated_at=" +
            NOW_SQL +
            " WHERE id=?",
          [name, address, avatar_url, phone, uid]
        );
      } else {
        throw e;
      }
    }

    const row = await get(
      "SELECT id,email,name,avatar_url,role,address,phone,status,lat,lng,created_at,updated_at FROM users WHERE id=?",
      [uid]
    );
    res.json(row);
  } catch (e) {
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

// PATCH /api/users/me/password
router.patch("/me/password", requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    const { current_password = "", new_password = "" } = req.body || {};

    if (!current_password || !new_password) {
      return res
        .status(400)
        .json({ message: "Missing current_password/new_password" });
    }
    if (String(new_password).length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    const user = await get("SELECT id,password_hash FROM users WHERE id=?", [
      uid,
    ]);
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(current_password, user.password_hash || "");
    if (!ok)
      return res.status(401).json({ message: "Current password is incorrect" });

    const nextHash = await bcrypt.hash(String(new_password), 10);
    await run(
      "UPDATE users SET password_hash=?, updated_at=" + NOW_SQL + " WHERE id=?",
      [nextHash, uid]
    );

    return res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

// GET /api/users/history
router.get("/history", requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    const limit = Math.min(Number(req.query.limit || 8), 50);

    const given = await all(
      "SELECT id, title AS name, created_at FROM food_items WHERE owner_id=? ORDER BY created_at DESC LIMIT ?",
      [uid, limit]
    ).catch(() => []);

    const received = await all(
      `SELECT b.id, COALESCE(fi.title,'Bundle') AS name, b.created_at
         FROM bookings b
         LEFT JOIN food_items fi ON fi.id = b.item_id
        WHERE b.receiver_id=?
        ORDER BY b.created_at DESC
        LIMIT ?`,
      [uid, limit]
    ).catch(() => []);

    const payments = await all(
      "SELECT id, amount, status, created_at FROM payments WHERE payer_id=? ORDER BY created_at DESC LIMIT ?",
      [uid, limit]
    ).catch(() => []);

    res.json({ given, received, payments });
  } catch (e) {
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

// GET /api/users/export
router.get("/export", requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;

    const user = await get("SELECT * FROM users WHERE id=?", [uid]).catch(
      () => null
    );
    const items = await all("SELECT * FROM food_items WHERE owner_id=?", [
      uid,
    ]).catch(() => []);
    const bookings = await all("SELECT * FROM bookings WHERE receiver_id=?", [
      uid,
    ]).catch(() => []);
    const payments = await all("SELECT * FROM payments WHERE payer_id=?", [
      uid,
    ]).catch(() => []);
    const notifications = await all(
      "SELECT * FROM notifications WHERE user_id=?",
      [uid]
    ).catch(() => []);
    const reports = await all("SELECT * FROM reports WHERE reporter_id=?", [
      uid,
    ]).catch(() => []);

    const payload = {
      exported_at: new Date().toISOString(),
      user,
      items,
      bookings,
      payments,
      notifications,
      reports,
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="bua-com-xanh-${uid}.json"`
    );
    res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (e) {
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

// POST /api/users/delete
router.post("/delete", requireAuth, async (req, res) => {
  try {
    const uid = req.user.id;
    await run(
      "UPDATE users SET status='deleted', updated_at=" +
        NOW_SQL +
        " WHERE id=?",
      [uid]
    ).catch(() => {});
    await run(
      "UPDATE food_items SET status='hidden', updated_at=" +
        NOW_SQL +
        " WHERE owner_id=?",
      [uid]
    ).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e?.message || "Server error" });
  }
});

// Sessions (mock)
router.get("/sessions", requireAuth, async (req, res) => {
  try {
    const list = [
      {
        id: "current",
        device: "This device",
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "",
        last_seen: new Date().toISOString(),
        current: true,
      },
    ];
    res.json(list);
  } catch (e) {
    res.status(500).json({ message: e?.message || "Server error" });
  }
});
router.post("/logout-others", requireAuth, async (_req, res) =>
  res.json({ ok: true })
);

export default router;
