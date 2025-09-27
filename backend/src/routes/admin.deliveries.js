// backend/src/routes/admin.deliveries.js
// Admin Deliveries: list/filter/paginate + get detail + update status + cancel + generate OTP
// MySQL & SQLite compatible (ESM). Không phụ thuộc vào requireRole, tự có requireAdmin nhẹ.

import { Router } from "express";
import "dotenv/config";
import { requireAuth } from "../middlewares/auth.js";

const useMySQL = (process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else          ({ db } = await import("../lib/db.js"));

const r = Router();

/* ---------------- DB helpers ---------------- */
async function dbGet(sql, params = []) {
  if (useMySQL) { const [rows] = await db.query(sql, params); return rows?.[0] ?? null; }
  return db.prepare(sql).get(...params);
}
async function dbAll(sql, params = []) {
  if (useMySQL) { const [rows] = await db.query(sql, params); return rows ?? []; }
  return db.prepare(sql).all(...params);
}
async function dbRun(sql, params = []) {
  if (useMySQL) { const [r] = await db.query(sql, params); return r; }
  return db.prepare(sql).run(...params);
}
const NOW = () => (useMySQL ? "NOW()" : "CURRENT_TIMESTAMP");

/* ---------------- Guards ---------------- */
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "unauthorized" });
  // linh hoạt: admin hoặc staff
  if (!["admin", "staff"].includes(req.user.role)) {
    return res.status(403).json({ error: "forbidden" });
  }
  next();
}
r.use(requireAuth, requireAdmin);

/* ---------------- Common SELECT ---------------- */
const DELIVERY_SELECT = `
  SELECT
    d.id, d.booking_id, d.campaign_id, d.shipper_id, d.qty, d.status,
    d.otp_code, d.proof_images, d.route_geojson,
    d.created_at, d.updated_at,
    d.assigned_at, d.picked_at, d.arrived_at, d.shipped_at, d.delivered_at, d.cancelled_at, d.failed_at,
    d.current_lat, d.current_lng,

    /* ===== SHIPPER ===== */
    u.name  AS shipper_name,
    u.phone AS shipper_phone,

    /* ===== BOOKING / RECEIVER ===== */
    b.status AS booking_status,
    ur.id   AS receiver_id,
    ur.name AS receiver_name,
    ur.phone AS receiver_phone,

    /* ===== ADDRESSES (lookup) ===== */
    ap.line1 AS pickup_addr_line1,
    ad.line1 AS dropoff_addr_line1,

    /* ===== PICKUP ===== */
    COALESCE(d.pickup_name, c.title) AS pickup_name,
    COALESCE(NULLIF(d.pickup_address,''), c.location, ap.line1) AS pickup_address,

    /* ===== DROPOFF ===== */
    COALESCE(d.dropoff_name,  b.dropoff_name,  ur.name) AS dropoff_name,
    COALESCE(d.dropoff_address, b.dropoff_address, ad.line1) AS dropoff_address,
    COALESCE(d.dropoff_phone, b.dropoff_phone, ur.phone) AS dropoff_phone,

    CASE WHEN d.status IN ('assigned','picking') THEN 1 ELSE 0 END AS shipper_busy,
    0 AS shipper_online
  FROM deliveries d
  LEFT JOIN users     u  ON u.id = d.shipper_id
  LEFT JOIN bookings  b  ON b.id = d.booking_id
  LEFT JOIN users     ur ON ur.id = b.receiver_id
  LEFT JOIN campaigns c  ON c.id = d.campaign_id
  LEFT JOIN addresses ap ON ap.id = COALESCE(d.pickup_addr_id,  b.pickup_addr_id)
  LEFT JOIN addresses ad ON ad.id = COALESCE(d.dropoff_addr_id, b.dropoff_addr_id)
`;

/* ======================================================================
   GET /api/admin/deliveries   (list, filter, paginate)
====================================================================== */
r.get("/", async (req, res) => {
  try {
    const statusQ   = String(req.query.status || "assigned").toLowerCase();
    const q         = String(req.query.q || "").trim();
    const shipperId = String(req.query.shipper_id || "").trim();
    const page      = Math.max(1, parseInt(req.query.page || 1, 10));
    const pageSize  = Math.max(1, Math.min(200, parseInt(req.query.pageSize || req.query.page_size || 20, 10)));

    const conds = ["1=1"];
    const p = [];

    // status mapping
    if (statusQ === "active") {
      conds.push(`d.status IN ('pending','assigned','picking')`);
    } else if (statusQ === "assigned") {
      // giữ tương thích cũ: mặc định xem các đơn đang vận hành
      conds.push(`d.status IN ('pending','assigned','picking')`);
    } else if (statusQ && statusQ !== "all") {
      const arr = statusQ.split(",").map(s => s.trim()).filter(Boolean);
      if (arr.length) {
        conds.push(`d.status IN (${arr.map(() => "?").join(",")})`);
        p.push(...arr);
      }
    }

    if (shipperId) { conds.push(`d.shipper_id = ?`); p.push(shipperId); }

    if (q) {
      // tránh lỗi collation: chỉ so sánh trong cùng cột, không join bằng chuỗi literal khác collation
      const like = `%${q}%`;
      conds.push(`
        (
          d.id LIKE ? OR d.booking_id LIKE ?
          OR IFNULL(d.pickup_address,'')  LIKE ?
          OR IFNULL(d.dropoff_address,'') LIKE ?
        )`);
      p.push(like, like, like, like);
    }

    const whereSQL = `WHERE ${conds.join(" AND ")}`;

    const totalRow = await dbGet(`SELECT COUNT(1) AS c FROM deliveries d ${whereSQL}`, p);
    const total = Number(totalRow?.c || 0);
    const offset = (page - 1) * pageSize;

    const items = await dbAll(
      `${DELIVERY_SELECT}
       ${whereSQL}
       ORDER BY d.updated_at DESC, d.created_at DESC
       LIMIT ? OFFSET ?`,
      [...p, pageSize, offset]
    );

    res.json({ items, total, page, pageSize });
  } catch (e) {
    console.error("[admin.deliveries] list error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

/* ======================================================================
   GET /api/admin/deliveries/:id   (detail)
====================================================================== */
r.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const row = await dbGet(`${DELIVERY_SELECT} WHERE d.id = ?`, [id]);
    if (!row) return res.status(404).json({ error: "not_found" });

    res.json(row);
  } catch (e) {
    console.error("[admin.deliveries] get error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

/* ======================================================================
   PATCH /api/admin/deliveries/:id
====================================================================== */
r.patch("/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const dv = await dbGet(`SELECT * FROM deliveries WHERE id=?`, [id]);
    if (!dv) return res.status(404).json({ error: "Delivery not found" });

    const {
      status = null,
      shipper_id = null,
      pickup_eta = null,
      dropoff_eta = null,
      pickup_at = null,
      delivered_at = null,
      fail_reason = null,
      meta_json = null,
    } = req.body || {};

    await dbRun(
      `UPDATE deliveries SET
         status       = COALESCE(?, status),
         shipper_id   = COALESCE(?, shipper_id),
         pickup_eta   = COALESCE(?, pickup_eta),
         dropoff_eta  = COALESCE(?, dropoff_eta),
         pickup_at    = COALESCE(?, pickup_at),
         delivered_at = COALESCE(?, delivered_at),
         fail_reason  = COALESCE(?, fail_reason),
         meta_json    = COALESCE(?, meta_json),
         updated_at   = ${NOW()}
       WHERE id=?`,
      [
        status, shipper_id,
        pickup_eta, dropoff_eta,
        pickup_at, delivered_at,
        fail_reason,
        meta_json ? (typeof meta_json === "string" ? meta_json : JSON.stringify(meta_json)) : null,
        id,
      ]
    );

    // Sync booking nếu đổi trạng thái
    if (status) {
      let to = null;
      if (["pending", "assigned", "picking"].includes(status)) to = "accepted";
      else if (status === "delivered") to = "completed";
      else if (status === "cancelled") to = "cancelled";
      if (to && dv.booking_id) {
        await dbRun(`UPDATE bookings SET status=?, updated_at=${NOW()} WHERE id=?`, [to, dv.booking_id]);
      }
    }

    const fresh = await dbGet(`${DELIVERY_SELECT} WHERE d.id=?`, [id]);
    res.json(fresh);
  } catch (e) {
    console.error("[admin.deliveries] patch error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

/* ======================================================================
   POST /api/admin/deliveries/:id/cancel
====================================================================== */
r.post("/:id/cancel", async (req, res) => {
  try {
    const id = String(req.params.id);
    const dv = await dbGet(`SELECT * FROM deliveries WHERE id=?`, [id]);
    if (!dv) return res.status(404).json({ error: "Delivery not found" });

    await dbRun(`UPDATE deliveries SET status='cancelled', updated_at=${NOW()} WHERE id=?`, [id]);
    if (dv.booking_id) {
      await dbRun(`UPDATE bookings   SET status='cancelled', updated_at=${NOW()} WHERE id=?`, [dv.booking_id]);
    }

    const fresh = await dbGet(`${DELIVERY_SELECT} WHERE d.id=?`, [id]);
    res.json(fresh);
  } catch (e) {
    console.error("[admin.deliveries] cancel error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

/* ======================================================================
   POST /api/admin/deliveries/:id/generate-otp
====================================================================== */
r.post("/:id/generate-otp", async (req, res) => {
  try {
    const id = String(req.params.id);
    const dv = await dbGet(`SELECT * FROM deliveries WHERE id=?`, [id]);
    if (!dv) return res.status(404).json({ error: "Delivery not found" });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await dbRun(`UPDATE deliveries SET otp_code=?, updated_at=${NOW()} WHERE id=?`, [otp, id]);
    res.json({ otp });
  } catch (e) {
    console.error("[admin.deliveries] gen-otp error:", e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

export default r;
