// src/routes/admin_booking.js
import express from "express";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

/* --------- DB bootstrap --------- */
let db;
if ((process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql") {
  ({ db } = await import("../lib/db.mysql.js"));
} else {
  ({ db } = await import("../lib/db.js"));
}

/* --------- Helpers --------- */
const ok = (res, data) => res.json(data);
const bad = (res, msg = "Bad request", code = 400) => res.status(code).json({ error: msg });
const asInt = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const genOTP = () => String(Math.floor(100000 + Math.random() * 900000));

async function withTx(run) {
  if (typeof db.getConnection === "function") {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const result = await run(conn, true);
      await conn.commit();
      return result;
    } catch (e) {
      try { await conn.rollback(); } catch {}
      throw e;
    } finally {
      conn.release();
    }
  }
  try {
    await db.query("BEGIN");
    const result = await run(db, false);
    await db.query("COMMIT");
    return result;
  } catch (e) {
    try { await db.query("ROLLBACK"); } catch {}
    throw e;
  }
}

/* =================== BOOKINGS =================== */

router.get("/bookings", async (req, res) => {
  const status = (req.query.status || "").trim();
  const q = (req.query.q || "").trim();
  const page = clamp(asInt(req.query.page, 1), 1, 100000);
  const pageSize = clamp(asInt(req.query.page_size, 20), 1, 200);

  const where = [];
  const params = [];

  if (status) { where.push("b.status = ?"); params.push(status); }
  if (q) {
    where.push("(b.id LIKE ? OR COALESCE(b.note,'') LIKE ? OR COALESCE(b.dropoff_address,'') LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const baseSelect = `
    FROM bookings b
    LEFT JOIN users u ON u.id = b.receiver_id
  `;

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(1) AS total ${baseSelect} ${whereSql}`,
      params
    );
    const itemsSql = `
      SELECT
        b.id, b.receiver_id, b.qty, b.method, b.status, b.created_at, b.updated_at,
        b.note, b.dropoff_address,
        u.name AS receiver_name
      ${baseSelect}
      ${whereSql}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(itemsSql, [...params, pageSize, (page - 1) * pageSize]);
    return ok(res, { items: rows || [], total: total || 0, page, pageSize });
  } catch (e) {
    console.error(e);
    return bad(res, "Không tải được danh sách booking", 500);
  }
});

router.get("/bookings/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await db.query(
      `SELECT b.*, u.name AS receiver_name, u.phone AS receiver_phone
       FROM bookings b
       LEFT JOIN users u ON u.id = b.receiver_id
       WHERE b.id = ?`,
      [id]
    );
    if (!rows?.length) return bad(res, "Không tìm thấy booking", 404);
    return ok(res, rows[0]);
  } catch (e) {
    console.error(e);
    return bad(res, "Lỗi tải chi tiết booking", 500);
  }
});

router.patch("/bookings/:id", async (req, res) => {
  const id = req.params.id;
  const { status } = req.body || {};
  const allowed = new Set(["pending", "accepted", "rejected", "cancelled", "completed", "expired"]);
  if (status && !allowed.has(status)) return bad(res, "Trạng thái không hợp lệ");

  try {
    const [cur] = await db.query("SELECT id, status FROM bookings WHERE id=?", [id]);
    if (!cur?.length) return bad(res, "Không tìm thấy booking", 404);

    if (status) {
      await db.query("UPDATE bookings SET status=?, updated_at=NOW() WHERE id=?", [status, id]);
    }
    const [refetch] = await db.query("SELECT * FROM bookings WHERE id=?", [id]);
    return ok(res, refetch[0]);
  } catch (e) {
    console.error(e);
    return bad(res, "Cập nhật trạng thái thất bại", 500);
  }
});

/* =================== LOOKUPS =================== */

router.get("/shippers", async (_req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, email, phone FROM users WHERE role='shipper' AND status='active' ORDER BY name ASC"
    );
    return ok(res, { items: rows || [] });
  } catch (e) {
    console.error(e);
    return bad(res, "Không tải được danh sách shipper", 500);
  }
});

router.get("/pickup-points", async (_req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, address AS address_line, lat, lng FROM pickup_points WHERE status='active' ORDER BY created_at DESC"
    );
    return ok(res, { items: rows || [] });
  } catch (e) {
    console.error(e);
    return bad(res, "Không tải được pickup points", 500);
  }
});

router.get("/kitchen-addresses", async (_req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, label, line1 AS address_line FROM addresses ORDER BY created_at DESC LIMIT 200"
    );
    const items = (rows || []).map((r) => ({
      id: r.id,
      label: `${r.label || "Điểm lấy"} • ${r.address_line}`,
      address: r.address_line,
    }));
    return ok(res, { items });
  } catch (e) {
    console.error(e);
    return bad(res, "Không tải được địa chỉ bếp", 500);
  }
});

router.get("/recipients/:id/addresses", async (req, res) => {
  const rid = req.params.id;
  try {
    const [rows] = await db.query(
      "SELECT id, label, line1 AS address_line FROM addresses WHERE user_id=? ORDER BY is_default DESC, created_at DESC",
      [rid]
    );
    const items = (rows || []).map((a) => ({
      id: a.id,
      label: `${a.label ? a.label + " • " : ""}${a.address_line}`,
      address: a.address_line,
    }));
    return ok(res, { items });
  } catch (e) {
    console.error(e);
    return bad(res, "Không tải được địa chỉ người nhận", 500);
  }
});

/* =================== DELIVERIES =================== */
/**
 * POST /api/admin/deliveries
 * Body: { bookingId, shipperId?, qty, note, pickupPointId?, pickupAddrId?, dropoffAddrId?, dropoffAddrText? }
 * Lưu ý: schema deliveries có status enum('pending','assigned','picking','delivered','cancelled'), note, dropoff_phone.  (DB dump) :contentReference[oaicite:4]{index=4} :contentReference[oaicite:5]{index=5}
 */
router.post("/deliveries", async (req, res) => {
  const {
    bookingId,
    shipperId: shipperIdRaw = null,
    qty = 1,
    note = null,
    pickupPointId = null,
    pickupAddrId = null,
    dropoffAddrId = null,
    dropoffAddrText = null,
  } = req.body || {};

  if (!bookingId) return bad(res, "Thiếu bookingId");
  const normQty = Math.max(1, +qty || 1);
  const shipperId = shipperIdRaw || null;

  try {
    const result = await withTx(async (conn) => {
      // --- Lock booking + lấy thông tin dropoff ---
      const [bRows] = await conn.query(
        `SELECT b.*, u.name AS receiver_name, u.phone AS receiver_phone
         FROM bookings b
         LEFT JOIN users u ON u.id = b.receiver_id
         WHERE b.id = ? FOR UPDATE`,
        [bookingId]
      );
      if (!bRows?.length) throw new Error("Không tìm thấy booking");
      const B = bRows[0]; // bookings có dropoff_address, dropoff_name, dropoff_phone :contentReference[oaicite:6]{index=6}

      // Nếu đã có delivery -> nâng cấp nếu cần (gán shipper & set assigned)
      const [exist] = await conn.query("SELECT * FROM deliveries WHERE booking_id=? LIMIT 1", [bookingId]);
      if (exist?.length) {
        const D = exist[0];
        const sets = [];
        const params = [];

        // Gán shipper lần đầu hoặc đổi shipper
        if (shipperId && shipperId !== D.shipper_id) {
          sets.push("shipper_id=?"); params.push(shipperId);
          if (D.status === "pending") { sets.push("status='assigned'"); }
        }
        // Cho phép “nhồi lại” một số field nếu đang trống
        if (!D.pickup_name || !D.pickup_address) {
          // Resolve pickup nếu client gửi
          if (pickupAddrId) {
            const [[addr]] = await conn.query("SELECT id, label, line1 FROM addresses WHERE id=?", [pickupAddrId]);
            if (addr) {
              sets.push("pickup_addr_id=?","pickup_name=?","pickup_address=?");
              params.push(addr.id, addr.label || null, addr.line1 || null);
            }
          } else if (pickupPointId) {
            const [[pp]] = await conn.query("SELECT id, name, address FROM pickup_points WHERE id=?", [pickupPointId]);
            if (pp) {
              sets.push("pickup_name=?","pickup_address=?");
              params.push(pp.name || null, pp.address || null);
            }
          }
        }
        if (!D.dropoff_address) {
          if (dropoffAddrId) {
            const [[addr]] = await conn.query("SELECT id, label, line1 FROM addresses WHERE id=?", [dropoffAddrId]);
            if (addr) {
              sets.push("dropoff_addr_id=?","dropoff_name=?","dropoff_address=?");
              params.push(addr.id, addr.label || B.receiver_name || null, addr.line1 || null);
            }
          } else if (dropoffAddrText && dropoffAddrText.trim()) {
            sets.push("dropoff_address=?");
            params.push(dropoffAddrText.trim());
          }
        }
        if (note) { sets.push("note=?"); params.push(note); }

        if (sets.length) {
          sets.push("updated_at=NOW()");
          await conn.query(`UPDATE deliveries SET ${sets.join(", ")} WHERE id=?`, [...params, D.id]);
        }

        // Trả ra row mới nhất
        const [refetch] = await conn.query("SELECT * FROM deliveries WHERE id=?", [D.id]);
        return { id: refetch[0].id, status: refetch[0].status, otp_code: refetch[0].otp_code, reused: true };
      }

      // --- Resolve pickup ---
      let pickup_name = null, pickup_address = null, picked_pickup_addr_id = null;
      if (pickupAddrId) {
        const [[addr]] = await conn.query("SELECT id, label, line1 FROM addresses WHERE id = ?", [pickupAddrId]);
        if (!addr) throw new Error("Không tìm thấy pickup address");
        picked_pickup_addr_id = addr.id;
        pickup_name = addr.label || null;
        pickup_address = addr.line1 || null;
      } else if (pickupPointId) {
        const [[pp]] = await conn.query("SELECT id, name, address FROM pickup_points WHERE id = ?", [pickupPointId]);
        if (!pp) throw new Error("Không tìm thấy pickup point");
        pickup_name = pp.name || null;
        pickup_address = pp.address || null;
      }

      // --- Resolve dropoff ---
      let dropoff_name = B.dropoff_name || B.receiver_name || null;
      let dropoff_address = null;
      let picked_drop_addr_id = null;

      if (dropoffAddrId) {
        const [[addr]] = await conn.query("SELECT id, label, line1 FROM addresses WHERE id = ?", [dropoffAddrId]);
        if (!addr) throw new Error("Không tìm thấy dropoff address");
        picked_drop_addr_id = addr.id;
        dropoff_address = addr.line1;
        if (addr.label) dropoff_name = addr.label;
      } else if (dropoffAddrText && dropoffAddrText.trim()) {
        dropoff_address = dropoffAddrText.trim();
      } else if (B.dropoff_address) {
        dropoff_address = B.dropoff_address;
      } else {
        throw new Error("Thiếu địa chỉ giao (dropoff)");
      }

      // --- Insert delivery mới (khớp enum + cột note, dropoff_phone) ---
      const deliveryId = uuidv4();
      const initialStatus = shipperId ? "assigned" : "pending"; // enum hợp lệ theo DB :contentReference[oaicite:7]{index=7}
      const otp = genOTP();
      const mergedNote = [
        dropoff_name ? dropoff_name : null,
        note || (B.note ? `Note: Từ booking #${B.id}: ${B.note}` : `Từ booking #${B.id}`)
      ].filter(Boolean).join(" | ");

      await conn.query(
        `INSERT INTO deliveries
         (id, booking_id, shipper_id, qty, status, otp_code,
          pickup_addr_id, dropoff_addr_id, pickup_name, pickup_address,
          dropoff_name, dropoff_address, note, proof_images, dropoff_phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, JSON_ARRAY(), ?)`,

        [
          deliveryId, bookingId, shipperId || null, normQty, initialStatus, otp,
          picked_pickup_addr_id, picked_drop_addr_id,
          pickup_name, pickup_address,
          dropoff_name, dropoff_address, mergedNote,
          B.dropoff_phone || null  // có trong bookings :contentReference[oaicite:8]{index=8}
        ]
      );

      // --- Nếu booking đang pending -> chuyển accepted ---
      if (B.status === "pending") {
        await conn.query("UPDATE bookings SET status='accepted', updated_at=NOW() WHERE id=?", [bookingId]);
      }

      return { id: deliveryId, status: initialStatus, otp_code: otp, reused: false };
    });

    return ok(res, result);
  } catch (e) {
    console.error(e);
    const msg = String(e?.message || e).toLowerCase();
    if (msg.includes("method must be delivery")) {
      return bad(res, "Booking không phải phương thức giao tận nơi (delivery)", 400);
    }
    return bad(res, e.message || "Lỗi tạo delivery", 500);
  }
});

/** PATCH /api/admin/deliveries/:id  { status?, shipperId?/shipper_id?, note?, proofImages? } */
router.patch("/deliveries/:id", async (req, res) => {
  const id = req.params.id;

  // chấp nhận cả snake_case và camelCase
  const shipperId = req.body.shipperId ?? req.body.shipper_id;
  const status = req.body.status;
  const note = req.body.note;
  const proofImages = req.body.proofImages ?? req.body.proof_images;

  // khớp enum DB
  const allowedStatus = new Set(["pending","assigned","picking","delivered","cancelled"]); // :contentReference[oaicite:9]{index=9}
  if (status && !allowedStatus.has(status)) return bad(res, "Trạng thái giao hàng không hợp lệ");

  try {
    const result = await withTx(async (conn) => {
      const [cur] = await conn.query("SELECT * FROM deliveries WHERE id=? FOR UPDATE", [id]);
      if (!cur?.length) throw new Error("Không tìm thấy delivery");
      const D = cur[0];

      const sets = [];
      const params = [];

      if (status) { sets.push("status=?"); params.push(status); }
      if (shipperId !== undefined) {
        sets.push("shipper_id=?"); params.push(shipperId || null);
        // nếu đang pending và có shipper -> tự nâng lên assigned
        if (!status && (shipperId || shipperId === null) && D.status === "pending" && shipperId) {
          sets.push("status='assigned'");
        }
      }
      if (note !== undefined) { sets.push("note=?"); params.push(note || null); }
      if (Array.isArray(proofImages)) {
        // MySQL JSON: lưu string JSON
        sets.push("proof_images=?");
        params.push(JSON.stringify(proofImages));
      }
      if (!sets.length) return D;

      sets.push("updated_at=NOW()");
      const sql = `UPDATE deliveries SET ${sets.join(", ")} WHERE id=?`;
      await conn.query(sql, [...params, id]);

      const [refetch] = await conn.query("SELECT * FROM deliveries WHERE id=?", [id]);
      return refetch[0];
    });

    return ok(res, result);
  } catch (e) {
    console.error(e);
    return bad(res, e.message || "Cập nhật delivery thất bại", 500);
  }
});

export default router;
