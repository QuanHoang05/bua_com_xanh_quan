// ESM
import { Router } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "mysql") === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else ({ db } = await import("../lib/db.js"));

export const bookingsRouter = Router();

/* ================= helpers ================= */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const ROLES = { ADMIN: "admin", SHIPPER: "shipper", RECEIVER: "receiver", USER: "user", DONOR: "donor" };

const i = (v, d = 0) => (Number.isFinite(+v) ? Math.trunc(+v) : d);
const nowExpr = () => (useMySQL ? "NOW()" : "CURRENT_TIMESTAMP");

async function dbGet(sql, params = []) {
  if (typeof db.get === "function") return await db.get(sql, params);
  const [rows] = await db.query(sql, params);
  return rows?.[0] ?? null;
}
async function dbAll(sql, params = []) {
  if (typeof db.all === "function") return await db.all(sql, params);
  const [rows] = await db.query(sql, params);
  return rows ?? [];
}
async function dbRun(sql, params = []) {
  if (useMySQL) {
    const [res] = await db.query(sql, params);
    return { changes: res?.affectedRows ?? 0, lastId: res?.insertId };
  }
  const stmt = db.prepare(sql);
  const info = stmt.run(...params);
  return { changes: info.changes, lastId: info.lastInsertRowid };
}

function auth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (!token) return res.status(401).json({ error: "unauthorized" });
    req.user = jwt.verify(token, JWT_SECRET); // { id, role, ... }
    next();
  } catch {
    res.status(401).json({ error: "unauthorized" });
  }
}
const isAdmin = (u) => u?.role === ROLES.ADMIN;

const BOOKING_STATUS = new Set(["pending", "accepted", "rejected", "cancelled", "completed", "expired"]);
const METHODS = new Set(["pickup", "meet", "delivery"]);

function pageParams(q) {
  const page = Math.max(1, i(q.page ?? q.page_index ?? 1, 1));
  const pageSize = Math.min(100, Math.max(1, i(q.pageSize ?? q.page_size ?? 20, 20)));
  const off = (page - 1) * pageSize;
  return { page, pageSize, off };
}

/* ---------- small helpers for delivery creation ---------- */
async function ensureDeliveryForBooking(b) {
  // Đã có delivery cho booking này chưa?
  const existed = await dbGet(`SELECT id FROM deliveries WHERE booking_id = ? LIMIT 1`, [b.id]);
  if (existed?.id) return existed.id;

  // Tạo delivery tối thiểu, để backend Deliveries hiển thị và admin gán shipper.
  // Chỉ insert các cột phổ biến; DB sẽ tự fill NULL cho phần còn lại.
  const newId = crypto.randomUUID();
  await dbRun(
    `INSERT INTO deliveries
      (id, booking_id, status, qty, created_at, updated_at)
     VALUES (?, ?, 'pending', COALESCE(?,1), ${nowExpr()}, ${nowExpr()})`,
    [newId, b.id, b.qty || 1]
  );
  return newId;
}

/* ================= PUBLIC/RECIPIENT ================= */

/** GET /api/recipients/me/bookings */
bookingsRouter.get("/recipients/me/bookings", auth, async (req, res) => {
  try {
    const { page, pageSize, off } = pageParams(req.query);
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();

    const where = ["receiver_id = ?"];
    const params = [req.user.id];

    if (status) {
      if (!BOOKING_STATUS.has(status)) return res.status(400).json({ error: "invalid_status" });
      where.push("status = ?"); params.push(status);
    }
    if (q) { where.push("(note LIKE ? OR id LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }

    const W = "WHERE " + where.join(" AND ");

    const rows = await dbAll(
      `SELECT id, item_id, bundle_id, receiver_id, qty, note, method, pickup_point, status, created_at, updated_at
       FROM bookings
       ${W}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, off]
    );
    const totalRow = await dbGet(`SELECT COUNT(*) AS total FROM bookings ${W}`, params);
    res.json({ items: rows, page, pageSize, total: totalRow?.total ?? 0 });
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

/** POST /api/bookings  (recipient tạo yêu cầu) */
bookingsRouter.post("/bookings", auth, async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const qty = Math.max(1, i(req.body?.qty, 1));
    const method = METHODS.has(String(req.body?.method)) ? String(req.body.method) : "pickup";
    const pickup_point = method === "pickup" ? (req.body?.pickup_point || null) : null;

    // CHỈ TẠO BOOKING, luôn để status='pending' (để DB & admin xử lý)
    await dbRun(
      `INSERT INTO bookings (id, item_id, bundle_id, receiver_id, qty, note, method, pickup_point, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ${nowExpr()}, ${nowExpr()})`,
      [
        id,
        req.body?.item_id || null,
        req.body?.bundle_id || null,
        req.user.id,
        qty,
        req.body?.note || null,
        method,
        pickup_point,
      ]
    );

    const row = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

/** PATCH /api/bookings/:id  (receiver chỉ được cancel pending của chính mình) */
bookingsRouter.patch("/bookings/:id", auth, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const b = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    if (!b) return res.status(404).json({ error: "not_found" });

    const set = [];
    const params = [];

    const meIsOwner = b.receiver_id === req.user.id;
    if (!isAdmin(req.user) && !meIsOwner) return res.status(403).json({ error: "forbidden" });

    if (req.body.status !== undefined) {
      const s = String(req.body.status).trim();
      if (!BOOKING_STATUS.has(s)) return res.status(400).json({ error: "invalid_status" });
      if (!isAdmin(req.user)) {
        if (!(b.status === "pending" && s === "cancelled")) return res.status(403).json({ error: "not_allowed" });
      }
      set.push("status=?"); params.push(s);
    }

    if (req.body.note !== undefined) { set.push("note=?"); params.push(String(req.body.note)); }
    if (req.body.qty !== undefined) { set.push("qty=?"); params.push(Math.abs(i(req.body.qty, 1)) || 1); }

    if (req.body.method !== undefined) {
      const m = String(req.body.method);
      if (!METHODS.has(m)) return res.status(400).json({ error: "invalid_method" });
      set.push("method=?"); params.push(m);
      if (m === "pickup") {
        set.push("pickup_point=?"); params.push(req.body.pickup_point || null);
      } else set.push("pickup_point=NULL");
    } else if (req.body.pickup_point !== undefined) {
      if (b.method !== "pickup") return res.status(400).json({ error: "pickup_point_only_for_pickup" });
      set.push("pickup_point=?"); params.push(req.body.pickup_point || null);
    }

    if (!set.length) return res.status(400).json({ error: "no_updatable_fields" });
    set.push(`updated_at=${nowExpr()}`);

    await dbRun(`UPDATE bookings SET ${set.join(", ")} WHERE id=?`, [...params, id]);
    const row = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

/** POST /api/bookings/:id/cancel  (alias) */
bookingsRouter.post("/bookings/:id/cancel", auth, async (req, res) => {
  try {
    const id = String(req.params.id || "");
    const b = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    if (!b) return res.status(404).json({ error: "not_found" });
    if (!isAdmin(req.user) && b.receiver_id !== req.user.id) return res.status(403).json({ error: "forbidden" });
    if (b.status !== "pending") return res.status(409).json({ error: "cannot_cancel" });

    await dbRun(`UPDATE bookings SET status='cancelled', updated_at=${nowExpr()} WHERE id=?`, [id]);
    const row = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

/* ================= ADMIN ================= */

/** GET /api/admin/bookings  */
bookingsRouter.get("/admin/bookings", auth, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "forbidden" });
    const { page, pageSize, off } = pageParams(req.query);
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();

    const where = [];
    const params = [];

    if (status) {
      if (!BOOKING_STATUS.has(status)) return res.status(400).json({ error: "invalid_status" });
      where.push("b.status = ?"); params.push(status);
    }
    if (q) { where.push("(b.note LIKE ? OR b.id LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }

    const W = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await dbAll(
      `SELECT b.id, b.item_id, b.bundle_id, b.receiver_id,
              b.qty, b.note, b.method, b.pickup_point, b.status, b.created_at, b.updated_at,
              u.name AS receiver_name
       FROM bookings b
       LEFT JOIN users u ON u.id = b.receiver_id
       ${W}
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, off]
    );
    const totalRow = await dbGet(`SELECT COUNT(*) AS total FROM bookings b ${W}`, params);
    res.json({ items: rows, page, pageSize, total: totalRow?.total ?? 0 });
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

/** PATCH /api/admin/bookings/:id  (state machine + tạo delivery khi accepted) */
bookingsRouter.patch("/admin/bookings/:id", auth, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "forbidden" });
    const id = String(req.params.id || "").trim();
    const b = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    if (!b) return res.status(404).json({ error: "not_found" });

    const to = req.body?.status ? String(req.body.status) : null;
    const set = [];
    const params = [];

    if (to) {
      if (!BOOKING_STATUS.has(to)) return res.status(400).json({ error: "invalid_status" });
      const from = b.status;
      const allow =
        (from === "pending" && ["accepted", "cancelled", "rejected"].includes(to)) ||
        (from === "accepted" && ["completed", "cancelled"].includes(to)) ||
        ["expired"].includes(to);
      if (!allow) return res.status(409).json({ error: "invalid_transition", from, to });
      set.push("status=?"); params.push(to);
    }

    if (req.body.note !== undefined) { set.push("note=?"); params.push(String(req.body.note)); }
    if (req.body.qty !== undefined) { set.push("qty=?"); params.push(Math.max(1, i(req.body.qty, 1))); }
    if (req.body.method !== undefined) {
      const m = String(req.body.method);
      if (!METHODS.has(m)) return res.status(400).json({ error: "invalid_method" });
      set.push("method=?"); params.push(m);
      if (m === "pickup") set.push("pickup_point=?"), params.push(req.body.pickup_point || null);
      else set.push("pickup_point=NULL");
    } else if (req.body.pickup_point !== undefined) {
      if (b.method !== "pickup") return res.status(400).json({ error: "pickup_point_only_for_pickup" });
      set.push("pickup_point=?"); params.push(req.body.pickup_point || null);
    }

    if (!set.length) return res.status(400).json({ error: "no_updatable_fields" });
    set.push(`updated_at=${nowExpr()}`);

    await dbRun(`UPDATE bookings SET ${set.join(", ")} WHERE id=?`, [...params, id]);

    // ⬇️ Nếu chuyển sang accepted từ pending ⇒ tạo delivery 'pending' nếu chưa có
    if (to === "accepted" && b.status === "pending") {
      await ensureDeliveryForBooking({ ...b, status: "accepted" });
    }

    const row = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

/** Alias tiện dụng: POST /api/admin/bookings/:id/accept */
bookingsRouter.post("/admin/bookings/:id/accept", auth, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "forbidden" });
    const id = String(req.params.id || "").trim();
    const b = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    if (!b) return res.status(404).json({ error: "not_found" });
    if (b.status !== "pending") return res.status(409).json({ error: "invalid_transition", from: b.status, to: "accepted" });

    await dbRun(`UPDATE bookings SET status='accepted', updated_at=${nowExpr()} WHERE id=?`, [id]);
    await ensureDeliveryForBooking({ ...b, status: "accepted" });

    const row = await dbGet(`SELECT * FROM bookings WHERE id=?`, [id]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

/** POST /api/admin/bookings/auto-cancel  */
bookingsRouter.post("/admin/bookings/auto-cancel", auth, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "forbidden" });
    const hours = Math.max(1, i(req.body?.pending_hours, 24));

    const cutoff = new Date(Date.now() - hours * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    const ts = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())} ${pad(cutoff.getHours())}:${pad(cutoff.getMinutes())}:${pad(cutoff.getSeconds())}`;

    const { changes } = await dbRun(
      `UPDATE bookings 
       SET status='cancelled', updated_at=${nowExpr()}
       WHERE status='pending' AND created_at < ?`,
      [ts]
    );

    res.json({ ok: true, autoCancelled: changes || 0, cutoff: ts, hours });
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});

/** (tuỳ chọn) GET /api/bookings  */
bookingsRouter.get("/bookings", auth, async (req, res) => {
  try {
    const { page, pageSize, off } = pageParams(req.query);
    const status = String(req.query.status || "").trim();
    const q = String(req.query.q || "").trim();

    const where = [];
    const params = [];

    if (!isAdmin(req.user)) { where.push("receiver_id = ?"); params.push(req.user.id); }
    if (status) {
      if (!BOOKING_STATUS.has(status)) return res.status(400).json({ error: "invalid_status" });
      where.push("status = ?"); params.push(status);
    }
    if (q) { where.push("(note LIKE ? OR id LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }

    const W = where.length ? "WHERE " + where.join(" AND ") : "";

    const rows = await dbAll(
      `SELECT id, item_id, bundle_id, receiver_id, qty, note, method, pickup_point, status, created_at, updated_at
       FROM bookings
       ${W}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, off]
    );
    const totalRow = await dbGet(`SELECT COUNT(*) AS total FROM bookings ${W}`, params);
    res.json({ items: rows, page, pageSize, total: totalRow?.total ?? 0 });
  } catch (e) {
    res.status(500).json({ error: e.message || "server_error" });
  }
});
