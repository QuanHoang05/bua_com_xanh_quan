// backend/src/routes/recipients.js
import { Router } from "express";
import crypto from "crypto";
import "dotenv/config";
import { requireAuth } from "../middlewares/auth.js";

// Code đúng
const useMySQL = (process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";
let db;
if (useMySQL) {
  ({ db } = await import("../lib/db.mysql.js"));
} else {
  ({ db } = await import("../lib/db.js"));
}

const router = Router();

/* ---------------- DB helpers ---------------- */
async function dbGet(sql, params = []) {
  if (useMySQL) {
    const [rows] = await db.query(sql, params);
    return rows?.[0] ?? null;
  }
  return db.prepare(sql).get(...params);
}
async function dbAll(sql, params = []) {
  if (useMySQL) {
    const [rows] = await db.query(sql, params);
    return rows ?? [];
  }
  return db.prepare(sql).all(...params);
}
async function dbRun(sql, params = []) {
  if (useMySQL) {
    const [r] = await db.query(sql, params);
    return r;
  }
  return db.prepare(sql).run(...params);
}

/* ---------------- Utils ---------------- */
const genUUID = () =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
const NOW = () => (useMySQL ? "NOW()" : "CURRENT_TIMESTAMP");

/* ---------------- Minor helpers ---------------- */
async function getDefaultAddress(userId) {
  return await dbGet(
    `SELECT id,label,line1,lat,lng,is_default
       FROM addresses
      WHERE user_id=? AND is_default=1
      ORDER BY id DESC LIMIT 1`,
    [String(userId)]
  );
}

async function ensureDefaultAddressForUser(userId) {
  const exist = await getDefaultAddress(userId);
  if (exist) return exist.id;

  const u = await dbGet(
    `SELECT address, name, lat, lng FROM users WHERE id=? LIMIT 1`,
    [String(userId)]
  );
  const line1 = (u?.address || "").trim();
  if (!line1) return null;

  const label = u?.name ? `Nhà của ${u.name}` : "Địa chỉ mặc định";
  await dbRun(
    `INSERT INTO addresses (user_id,label,line1,lat,lng,is_default,created_at)
     VALUES (?,?,?,?,?,1,${NOW()})`,
    [String(userId), label, line1, u?.lat ?? null, u?.lng ?? null]
  );

  const row = await dbGet(
    `SELECT id FROM addresses WHERE user_id=? ORDER BY id DESC LIMIT 1`,
    [String(userId)]
  );
  return row?.id ?? null;
}

/* =======================================================================
   RECIPIENT APIs
======================================================================= */

/** GET /api/recipients/me  → trả user + default_address (để FE dùng toạ độ/địa chỉ mặc định) */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const uid = req.user?.id;
    const me = await dbGet(
      `SELECT id,email,name,phone,avatar_url,role,address,status,lat,lng,created_at,updated_at
         FROM users WHERE id=? LIMIT 1`,
      [uid]
    );
    if (!me) return res.status(404).json({ error: "User not found" });

    const defAddr = await getDefaultAddress(uid);
    res.json({ ...me, default_address: defAddr || null });
  } catch (e) {
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

/** PATCH /api/recipients/me
 *  Cập nhật profile; nếu có address mới thì auto đồng bộ sang addresses (mặc định)
 */
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const uid = req.user?.id;
    const { name, phone, address, avatar_url, lat, lng } = req.body || {};
    const set = [],
      vals = [];
    if (name !== undefined) {
      set.push("name=?");
      vals.push(String(name));
    }
    if (phone !== undefined) {
      set.push("phone=?");
      vals.push(String(phone));
    }
    if (address !== undefined) {
      set.push("address=?");
      vals.push(String(address));
    }
    if (avatar_url !== undefined) {
      set.push("avatar_url=?");
      vals.push(String(avatar_url));
    }
    if (lat !== undefined) {
      set.push("lat=?");
      vals.push(Number(lat));
    }
    if (lng !== undefined) {
      set.push("lng=?");
      vals.push(Number(lng));
    }
    if (set.length) set.push(`updated_at=${NOW()}`);
    vals.push(uid);

    if (set.length)
      await dbRun(`UPDATE users SET ${set.join(",")} WHERE id=?`, vals);
    if (address !== undefined) await ensureDefaultAddressForUser(uid);

    const me = await dbGet(
      `SELECT id,email,name,phone,avatar_url,role,address,status,lat,lng,created_at,updated_at
         FROM users WHERE id=? LIMIT 1`,
      [uid]
    );
    const defAddr = await getDefaultAddress(uid);
    res.json({ ...me, default_address: defAddr || null });
  } catch (e) {
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

/** GET /api/recipients/me/addresses */
router.get("/me/addresses", requireAuth, async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT id,label,line1,lat,lng,is_default,created_at,updated_at
         FROM addresses
        WHERE user_id=?
        ORDER BY is_default DESC, created_at DESC`,
      [req.user?.id]
    );
    res.json({ items: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

/** GET /api/recipients/me/bookings?status=&q=&limit=&offset=
 *  → trả { items: [...] } kèm campaign_title
 */
router.get("/me/bookings", requireAuth, async (req, res) => {
  try {
    const { status, q, limit = 200, offset = 0 } = req.query;
    const p = [req.user?.id];

    let sql = `
      SELECT b.*,
             c.title AS campaign_title
        FROM bookings b
   LEFT JOIN campaigns c ON c.id = b.campaign_id
       WHERE b.receiver_id=?`;

    if (status && status !== "all") {
      sql += ` AND b.status=?`;
      p.push(String(status));
    }
    if (q) {
      sql += ` AND (IFNULL(b.note,'') LIKE ? OR b.id LIKE ?)`;
      p.push(`%${q}%`, `%${q}%`);
    }

    sql += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
    p.push(Number(limit), Number(offset));

    const rows = await dbAll(sql, p);
    res.json({ items: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

/** GET /api/recipients/me/deliveries?booking_id=&limit=&offset=
 *  → thông tin delivery kèm shipper + dropoff từ booking
 */
router.get("/me/deliveries", requireAuth, async (req, res) => {
  try {
    const { booking_id, limit = 200, offset = 0 } = req.query;
    const p = [req.user?.id];

    let sql = `
      SELECT d.*,
             b.dropoff_address, b.dropoff_name, b.dropoff_phone,
             u_s.name  AS shipper_name,
             u_s.phone AS shipper_phone
        FROM deliveries d
        JOIN bookings b ON b.id = d.booking_id
   LEFT JOIN users u_s   ON u_s.id = d.shipper_id
       WHERE b.receiver_id=?`;

    if (booking_id) {
      sql += ` AND d.booking_id=?`;
      p.push(String(booking_id));
    }

    sql += ` ORDER BY d.created_at DESC LIMIT ? OFFSET ?`;
    p.push(Number(limit), Number(offset));

    const rows = await dbAll(sql, p);
    res.json({ items: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

/** POST /api/recipients/me/bookings
 *  Body (FE gửi): { campaign_id?, qty=1, method='delivery', note?, dropoff_address? }
 *  LƯU Ý: bảng bookings KHÔNG có dropoff_lat/lng → bỏ qua nếu FE gửi
 *  Trả: booking object (có id) để FE check res.id
 */
router.post("/me/bookings", requireAuth, async (req, res) => {
  try {
    const uid = req.user?.id;
    const {
      campaign_id = null,
      qty = 1,
      method = "delivery",
      note = null,
      dropoff_address = null,
    } = req.body || {};

    // Lấy user + validate phone
    const u = await dbGet(
      `SELECT id, name, phone, address FROM users WHERE id=? LIMIT 1`,
      [uid]
    );
    if (!u) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (!u.phone) return res.status(400).json({ error: "PHONE_REQUIRED" });

    // Đảm bảo có default address (từ users.address nếu có)
    await ensureDefaultAddressForUser(uid);

    // Dropoff dùng ưu tiên payload, fallback users.address
    const usedDropAddr =
      (dropoff_address && String(dropoff_address).trim()) || u.address || null;

    const id = genUUID();
    await dbRun(
      `INSERT INTO bookings
       (id, campaign_id, receiver_id, qty, note, method,
        dropoff_addr_id, dropoff_address, dropoff_name, dropoff_phone,
        status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?,
               NULL, ?, ?, ?,
               'pending', ${NOW()}, ${NOW()})`,
      [
        id,
        campaign_id || null,
        uid,
        Number(qty) || 1,
        note,
        String(method),
        usedDropAddr,
        u.name || null,
        u.phone || null,
      ]
    );

    const booking = await dbGet(
      `SELECT b.*, c.title AS campaign_title
         FROM bookings b
    LEFT JOIN campaigns c ON c.id=b.campaign_id
        WHERE b.id=?`,
      [id]
    );

    res.status(201).json(booking);
  } catch (e) {
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

/* (Optional) danh sách người nhận (cho admin) */
router.get("/", requireAuth, async (_req, res) => {
  try {
    const rows = await dbAll(
      `SELECT id,name,email,avatar_url,address,status,role
         FROM users
        ORDER BY created_at DESC`
    );
    res.json({ items: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

export default router;
