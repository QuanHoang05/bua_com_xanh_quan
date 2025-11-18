// backend/src/routes/deliveries.js
import { Router } from "express";
import crypto from "crypto";

// ===== middlewares (fallback no-op nếu thiếu) =====
let requireAuth = (req, res, next) => next();
try {
  const mw = await import("../middlewares/auth.js");
  requireAuth = mw.requireAuth || requireAuth;
} catch {}

// ===== DB bootstrap (MySQL | SQLite) =====
const useMySQL = (process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.js"));
else ({ db } = await import("../lib/db.js"));

const r = Router();

/* ---------------- mini DB helpers ---------------- */
async function dbAll(sql, params = []) {
  if (useMySQL) {
    const [rows] = await db.query(sql, params);
    return rows ?? [];
  }
  return db.prepare(sql).all(...params);
}
async function dbGet(sql, params = []) {
  if (useMySQL) {
    const [rows] = await db.query(sql, params);
    return rows?.[0] ?? null;
  }
  return db.prepare(sql).get(...params);
}
async function dbRun(sql, params = []) {
  if (useMySQL) {
    const [ret] = await db.query(sql, params);
    return ret;
  }
  return db.prepare(sql).run(...params);
}

/* ---------------- MySQL: utilities ---------------- */
const CAST_BIN = "CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_bin";
async function mysqlHasColumn(table, column) {
  if (!useMySQL) return false;
  const row = await dbGet(
    `SELECT 1 ok
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return !!row;
}
async function mysqlAddColumnIfMissing(table, columnDef) {
  if (!useMySQL) return;
  const [col] = columnDef.split(/\s+/, 1); // first token = column name
  const has = await mysqlHasColumn(table, col);
  if (!has) await dbRun(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
}

/* ---------------- SQLite: utilities ---------------- */
async function sqliteAddColumnIfMissing(table, columnDef) {
  if (useMySQL) return;
  try {
    await dbRun(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch {
    /* ignore */
  }
}

/* ==================== bootstrap: ensure tables/columns ==================== */
async function ensureDeliveryAuxTables() {
  // delivery_reports (for shipper/receiver report sự cố)
  if (!useMySQL) {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS delivery_reports (
        id TEXT PRIMARY KEY,
        delivery_id TEXT NOT NULL,
        reporter_id INTEGER,
        type TEXT NOT NULL,
        content TEXT,
        images_json TEXT,
        status TEXT DEFAULT 'open',
        admin_note TEXT,
        admin_reply TEXT,
        admin_user_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await dbRun(`
      CREATE TRIGGER IF NOT EXISTS trg_delivery_reports_updated_at
      AFTER UPDATE ON delivery_reports
      BEGIN
        UPDATE delivery_reports SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  } else {
    // MySQL chỉ thêm cột nếu thiếu (bảng đã có từ schema chính)
    await mysqlAddColumnIfMissing("delivery_reports", "admin_note TEXT NULL");
    await mysqlAddColumnIfMissing("delivery_reports", "admin_reply TEXT NULL");
    await mysqlAddColumnIfMissing(
      "delivery_reports",
      "admin_user_id BIGINT NULL"
    );
  }

  // delivery_reviews (rating sau khi hoàn tất)
  if (!useMySQL) {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS delivery_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        delivery_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(delivery_id, user_id)
      )
    `);
  }

  // >>>> BỔ SUNG CỘT CẦN THIẾT CHO SHIPPER PICKUP <<<<
  // deliveries: pickup window/contact/location; dropoff contact; meta
  const addCols = [
    // pickup info
    "pickup_name VARCHAR(191) NULL",
    "pickup_phone VARCHAR(32) NULL",
    "pickup_address TEXT NULL",
    "pickup_note TEXT NULL",
    "pickup_time_from DATETIME NULL",
    "pickup_time_to DATETIME NULL",
    "pickup_lat DECIMAL(10,7) NULL",
    "pickup_lng DECIMAL(10,7) NULL",
    "pickup_addr_id VARCHAR(64) NULL",

    // dropoff info (fallback từ booking/receiver)
    "dropoff_name VARCHAR(191) NULL",
    "dropoff_phone VARCHAR(32) NULL",
    "dropoff_address TEXT NULL",

    // logistics
    "unit VARCHAR(32) NULL", // đơn vị suất/hộp/… (align với bảng inventory)
    "qty INT NULL", // số lượng dự kiến giao
    "eta_time DATETIME NULL", // ETA dự kiến
  ];

  if (useMySQL) {
    for (const def of addCols) await mysqlAddColumnIfMissing("deliveries", def);
  } else {
    for (const def of addCols)
      await sqliteAddColumnIfMissing("deliveries", def);
  }
}
await ensureDeliveryAuxTables();

/* ========================= role helpers ========================= */
const isAdmin = (u) =>
  u?.role === "admin" || (u?.roles || []).includes?.("admin");
const isShipper = (u) =>
  u?.role === "shipper" || (u?.roles || []).includes?.("shipper");

/* ========================= read helpers ========================= */
async function getDeliveryFull(id) {
  return dbGet(
    useMySQL
      ? `SELECT d.*,
               b.receiver_id,
               COALESCE(d.dropoff_name,  b.dropoff_name)      AS dropoff_name,
               COALESCE(d.dropoff_address,b.dropoff_address)  AS dropoff_address,
               COALESCE(d.dropoff_phone, b.dropoff_phone)     AS dropoff_phone,
               COALESCE(d.pickup_name, pa.line1)              AS pickup_name,
               COALESCE(d.pickup_address, pa.line1)           AS pickup_address,
               u.name  AS shipper_name,
               u.phone AS shipper_phone
         FROM deliveries d
         JOIN bookings  b  ON b.id COLLATE utf8mb4_bin = d.booking_id COLLATE utf8mb4_bin
         LEFT JOIN addresses pa ON pa.id = d.pickup_addr_id
         LEFT JOIN users     u  ON u.id COLLATE utf8mb4_bin = d.shipper_id COLLATE utf8mb4_bin
        WHERE d.id COLLATE utf8mb4_bin = ${CAST_BIN}`
      : `SELECT d.*,
               b.receiver_id,
               COALESCE(d.dropoff_name,  b.dropoff_name)     AS dropoff_name,
               COALESCE(d.dropoff_address,b.dropoff_address) AS dropoff_address,
               COALESCE(d.dropoff_phone, b.dropoff_phone)    AS dropoff_phone,
               COALESCE(d.pickup_name, pa.line1)             AS pickup_name,
               COALESCE(d.pickup_address, pa.line1)          AS pickup_address,
               u.name  AS shipper_name,
               u.phone AS shipper_phone
         FROM deliveries d
         JOIN bookings  b  ON b.id = d.booking_id
         LEFT JOIN addresses pa ON pa.id = d.pickup_addr_id
         LEFT JOIN users     u  ON u.id = d.shipper_id
        WHERE d.id = ?`,
    [id]
  );
}

function allowTransition(curr, action) {
  const next = {
    accept: { from: ["pending"] },
    start_pickup: { from: ["assigned"] },
    delivered: { from: ["picking"] },
    cancel: { from: ["pending", "assigned", "picking"] },
  };
  const rule = next[action];
  return rule ? rule.from.includes(curr) : false;
}

function normalizeReason(input) {
  const raw = String(input || "")
    .trim()
    .toLowerCase();
  const map = new Map([
    ["giao muộn", "late"],
    ["giao trễ", "late"],
    ["trễ", "late"],
    ["thiếu hàng", "missing"],
    ["thiếu", "missing"],
    ["thái độ không tốt", "attitude"],
    ["thái độ", "attitude"],
    ["hàng hoá hư hỏng", "damage"],
    ["hư hỏng", "damage"],
    ["hỏng", "damage"],
    ["khác", "other"],
  ]);
  return map.get(raw) || raw;
}

/* ================================= LIST ================================= */
// GET /api/deliveries
// Query: ?mine=shipper|recipient (default: auto), ?status=pending,assigned,...
//        ?q=keyword, ?page=1&page_size=20, ?scope=all (admin only), ?booking_id=...
r.get("/", requireAuth, async (req, res) => {
  try {
    const { booking_id = "", q = "", status = "" } = req.query;

    const _isAdmin = isAdmin(req.user);
    const _isShipper = isShipper(req.user);

    let mine = String(req.query.mine ?? "")
      .toLowerCase()
      .trim();
    if (!mine || mine === "1" || mine === "true")
      mine = _isShipper ? "shipper" : "recipient";

    const statuses = status
      ? String(status)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const stSQL = statuses.length
      ? ` AND d.status IN (${statuses.map(() => "?").join(",")})`
      : "";
    const stParams = statuses;
    const like = (v) => `%${String(v || "").trim()}%`;

    // ----- by booking_id -> single item -----
    if (booking_id) {
      const row = await dbGet(
        useMySQL
          ? `SELECT d.*,
                   b.receiver_id,
                   COALESCE(d.dropoff_name,  b.dropoff_name)      AS dropoff_name,
                   COALESCE(d.dropoff_address,b.dropoff_address)  AS dropoff_address,
                   COALESCE(d.dropoff_phone, b.dropoff_phone)     AS dropoff_phone,
                   COALESCE(d.pickup_name, pa.line1)              AS pickup_name,
                   COALESCE(d.pickup_address, pa.line1)           AS pickup_address,
                   u.name  AS shipper_name,
                   u.phone AS shipper_phone
             FROM deliveries d
             JOIN bookings  b  ON b.id COLLATE utf8mb4_bin = d.booking_id COLLATE utf8mb4_bin
             LEFT JOIN addresses pa ON pa.id = d.pickup_addr_id
             LEFT JOIN users     u  ON u.id COLLATE utf8mb4_bin = d.shipper_id COLLATE utf8mb4_bin
            WHERE d.booking_id COLLATE utf8mb4_bin = ${CAST_BIN}`
          : `SELECT d.*,
                   b.receiver_id,
                   COALESCE(d.dropoff_name,  b.dropoff_name)     AS dropoff_name,
                   COALESCE(d.dropoff_address,b.dropoff_address) AS dropoff_address,
                   COALESCE(d.dropoff_phone, b.dropoff_phone)    AS dropoff_phone,
                   COALESCE(d.pickup_name, pa.line1)             AS pickup_name,
                   COALESCE(d.pickup_address, pa.line1)          AS pickup_address,
                   u.name  AS shipper_name,
                   u.phone AS shipper_phone
             FROM deliveries d
             JOIN bookings  b  ON b.id = d.booking_id
             LEFT JOIN addresses pa ON pa.id = d.pickup_addr_id
             LEFT JOIN users     u  ON u.id = d.shipper_id
            WHERE d.booking_id = ?`,
        [booking_id]
      );
      if (!row) return res.json({ item: null });

      const allowed =
        row.shipper_id === req.user.id ||
        row.receiver_id === req.user.id ||
        (_isAdmin && String(req.query.scope).toLowerCase() === "all");
      if (!allowed) return res.status(403).json({ error: "forbidden" });
      return res.json({ item: row });
    }

    // ----- admin: view all with pagination -----
    if (_isAdmin && String(req.query.scope).toLowerCase() === "all") {
      const page = Math.max(1, Number(req.query.page || 1));
      const pageSize = Math.min(
        100,
        Math.max(1, Number(req.query.page_size || 20))
      );
      const off = (page - 1) * pageSize;

      const rows = await dbAll(
        useMySQL
          ? `SELECT d.*,
                   b.receiver_id,
                   COALESCE(d.dropoff_name,  b.dropoff_name)      AS dropoff_name,
                   COALESCE(d.dropoff_address,b.dropoff_address)  AS dropoff_address,
                   COALESCE(d.dropoff_phone, b.dropoff_phone)     AS dropoff_phone,
                   COALESCE(d.pickup_name, pa.line1)              AS pickup_name,
                   COALESCE(d.pickup_address, pa.line1)           AS pickup_address,
                   u.name  AS shipper_name,
                   u.phone AS shipper_phone
             FROM deliveries d
             JOIN bookings  b  ON b.id COLLATE utf8mb4_bin = d.booking_id COLLATE utf8mb4_bin
             LEFT JOIN addresses pa ON pa.id = d.pickup_addr_id
             LEFT JOIN users     u  ON u.id COLLATE utf8mb4_bin = d.shipper_id COLLATE utf8mb4_bin
            WHERE 1=1
              ${stSQL}
              ${
                q
                  ? ` AND (
                        d.id COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
                     OR COALESCE(d.pickup_address,'')  COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
                     OR COALESCE(d.dropoff_address,'') COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
                  )`
                  : ""
              }
            ORDER BY d.updated_at DESC, d.created_at DESC
            LIMIT ? OFFSET ?`
          : `SELECT d.*,
                   b.receiver_id,
                   COALESCE(d.dropoff_name,  b.dropoff_name)     AS dropoff_name,
                   COALESCE(d.dropoff_address,b.dropoff_address) AS dropoff_address,
                   COALESCE(d.dropoff_phone, b.dropoff_phone)    AS dropoff_phone,
                   COALESCE(d.pickup_name, pa.line1)             AS pickup_name,
                   COALESCE(d.pickup_address, pa.line1)          AS pickup_address,
                   u.name  AS shipper_name,
                   u.phone AS shipper_phone
             FROM deliveries d
             JOIN bookings  b  ON b.id = d.booking_id
             LEFT JOIN addresses pa ON pa.id = d.pickup_addr_id
             LEFT JOIN users     u  ON u.id = d.shipper_id
            WHERE 1=1
              ${stSQL}
              ${
                q
                  ? ` AND (d.id LIKE ? OR COALESCE(d.pickup_address,'') LIKE ? OR COALESCE(d.dropoff_address,'') LIKE ?)`
                  : ""
              }
            ORDER BY d.updated_at DESC, d.created_at DESC
            LIMIT ? OFFSET ?`,
        [...stParams, ...(q ? [like(q), like(q), like(q)] : []), pageSize, off]
      );
      return res.json({ items: rows, page, page_size: pageSize });
    }

    // ----- mine: shipper -----
    if (mine === "shipper") {
      const rows = await dbAll(
        useMySQL
          ? `SELECT d.*,
                   b.receiver_id,
                   COALESCE(d.dropoff_name,  b.dropoff_name)      AS dropoff_name,
                   COALESCE(d.dropoff_address,b.dropoff_address)  AS dropoff_address,
                   COALESCE(d.dropoff_phone, b.dropoff_phone)     AS dropoff_phone,
                   COALESCE(d.pickup_name, pa.line1)              AS pickup_name,
                   COALESCE(d.pickup_address, pa.line1)           AS pickup_address,
                   u.name  AS shipper_name,
                   u.phone AS shipper_phone
             FROM deliveries d
             JOIN bookings  b  ON b.id COLLATE utf8mb4_bin = d.booking_id COLLATE utf8mb4_bin
             LEFT JOIN addresses pa ON pa.id = d.pickup_addr_id
             LEFT JOIN users     u  ON u.id COLLATE utf8mb4_bin = d.shipper_id COLLATE utf8mb4_bin
            WHERE d.shipper_id COLLATE utf8mb4_bin = ${CAST_BIN}
              ${stSQL}
              ${
                q
                  ? ` AND (
                        d.id COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
                     OR COALESCE(d.pickup_address,'')  COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
                     OR COALESCE(d.dropoff_address,'') COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
                  )`
                  : ""
              }
            ORDER BY d.updated_at DESC, d.created_at DESC`
          : `SELECT d.*,
                   b.receiver_id,
                   COALESCE(d.dropoff_name,  b.dropoff_name)     AS dropoff_name,
                   COALESCE(d.dropoff_address,b.dropoff_address) AS dropoff_address,
                   COALESCE(d.dropoff_phone, b.dropoff_phone)    AS dropoff_phone,
                   COALESCE(d.pickup_name, pa.line1)             AS pickup_name,
                   COALESCE(d.pickup_address, pa.line1)          AS pickup_address,
                   u.name  AS shipper_name,
                   u.phone AS shipper_phone
             FROM deliveries d
             JOIN bookings  b  ON b.id = d.booking_id
             LEFT JOIN addresses pa ON pa.id = d.pickup_addr_id
             LEFT JOIN users     u  ON u.id = d.shipper_id
            WHERE d.shipper_id = ?
              ${stSQL}
              ${
                q
                  ? ` AND (d.id LIKE ? OR COALESCE(d.pickup_address,'') LIKE ? OR COALESCE(d.dropoff_address,'') LIKE ?)`
                  : ""
              }
            ORDER BY d.updated_at DESC, d.created_at DESC`,
        [req.user.id, ...stParams, ...(q ? [like(q), like(q), like(q)] : [])]
      );
      return res.json({ items: rows });
    }

    // ----- mine: recipient -----
    const rows = await dbAll(
      useMySQL
        ? `SELECT d.*,
                 b.receiver_id,
                 COALESCE(d.dropoff_name,  b.dropoff_name)      AS dropoff_name,
                 COALESCE(d.dropoff_address,b.dropoff_address)  AS dropoff_address,
                 COALESCE(d.dropoff_phone, b.dropoff_phone)     AS dropoff_phone,
                 COALESCE(d.pickup_name, pa.line1)              AS pickup_name,
                 COALESCE(d.pickup_address, pa.line1)           AS pickup_address,
                 u.name  AS shipper_name,
                 u.phone AS shipper_phone
           FROM deliveries d
           JOIN bookings  b  ON b.id COLLATE utf8mb4_bin = d.booking_id COLLATE utf8mb4_bin
           LEFT JOIN addresses pa ON pa.id = d.pickup_addr_id
           LEFT JOIN users     u  ON u.id COLLATE utf8mb4_bin = d.shipper_id COLLATE utf8mb4_bin
          WHERE b.receiver_id COLLATE utf8mb4_bin = ${CAST_BIN}
            ${stSQL}
            ${
              q
                ? ` AND (
                      d.id COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
                   OR COALESCE(d.pickup_address,'')  COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
                   OR COALESCE(d.dropoff_address,'') COLLATE utf8mb4_unicode_ci LIKE CONCAT('%', CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci, '%')
                )`
                : ""
            }
          ORDER BY d.updated_at DESC, d.created_at DESC`
        : `SELECT d.*,
                 b.receiver_id,
                 COALESCE(d.dropoff_name,  b.dropoff_name)     AS dropoff_name,
                 COALESCE(d.dropoff_address,b.dropoff_address) AS dropoff_address,
                 COALESCE(d.dropoff_phone, b.dropoff_phone)    AS dropoff_phone,
                 COALESCE(d.pickup_name, pa.line1)             AS pickup_name,
                 COALESCE(d.pickup_address, pa.line1)          AS pickup_address,
                 u.name  AS shipper_name,
                 u.phone AS shipper_phone
           FROM deliveries d
           JOIN bookings  b  ON b.id = d.booking_id
           LEFT JOIN addresses pa ON pa.id = d.pickup_addr_id
           LEFT JOIN users     u  ON u.id = d.shipper_id
          WHERE b.receiver_id = ?
            ${stSQL}
            ${
              q
                ? ` AND (d.id LIKE ? OR COALESCE(d.pickup_address,'') LIKE ? OR COALESCE(d.dropoff_address,'') LIKE ?)`
                : ""
            }
          ORDER BY d.updated_at DESC, d.created_at DESC`,
      [req.user.id, ...stParams, ...(q ? [like(q), like(q), like(q)] : [])]
    );
    return res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({
        error: "list_deliveries_failed",
        message: e?.message || "Server error",
      });
  }
});

/* ======================== PATCH status ====================== */
// body: { action: "accept" | "start_pickup" | "delivered" | "cancel" }
r.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { action } = req.body || {};
    if (!id || !action) return res.status(400).json({ error: "invalid_input" });

    const row = await getDeliveryFull(id);
    if (!row) return res.status(404).json({ error: "not_found" });

    const admin = isAdmin(req.user);
    const shipper = isShipper(req.user);
    const isOwnerShipper = row.shipper_id === req.user.id;
    const isOwnerReceiver = row.receiver_id === req.user.id;

    if (action === "accept" && !shipper)
      return res.status(403).json({ error: "forbidden" });
    if (
      ["start_pickup", "delivered"].includes(action) &&
      !(shipper && isOwnerShipper)
    )
      return res.status(403).json({ error: "forbidden" });
    if (action === "cancel" && !(admin || shipper || isOwnerReceiver))
      return res.status(403).json({ error: "forbidden" });

    if (!allowTransition(row.status, action))
      return res
        .status(409)
        .json({ error: "invalid_transition", from: row.status, action });

    let nextStatus = row.status;
    if (action === "accept") {
      nextStatus = "assigned";
      if (!row.shipper_id)
        await dbRun("UPDATE deliveries SET shipper_id = ? WHERE id = ?", [
          req.user.id,
          id,
        ]);
    } else if (action === "start_pickup") nextStatus = "picking";
    else if (action === "delivered") nextStatus = "delivered";
    else if (action === "cancel") nextStatus = "cancelled";

    await dbRun(
      useMySQL
        ? "UPDATE deliveries SET status = ?, updated_at = NOW() WHERE id = ?"
        : "UPDATE deliveries SET status = ?, updated_at = datetime('now') WHERE id = ?",
      [nextStatus, id]
    );
    return res.json({ ok: true, id, status: nextStatus });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({
        error: "patch_status_failed",
        message: e?.message || "Server error",
      });
  }
});

/* ======================== PATCH review ===================== */
// body: { rating: 1..5, comment? }
r.patch("/:id/review", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    let { rating, comment = "" } = req.body || {};
    rating = Number(rating);
    if (!id || !Number.isFinite(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ error: "invalid_input" });

    const row = await getDeliveryFull(id);
    if (!row) return res.status(404).json({ error: "not_found" });

    const admin = isAdmin(req.user);
    const isOwnerReceiver = row.receiver_id === req.user.id;
    if (!(isOwnerReceiver || admin))
      return res.status(403).json({ error: "forbidden" });

    if (!["delivered", "cancelled"].includes(row.status))
      return res.status(409).json({ error: "not_finished" });

    if (useMySQL) {
      await dbRun(
        `INSERT INTO delivery_reviews (delivery_id, user_id, rating, comment)
         VALUES (${CAST_BIN}, ${CAST_BIN}, ?, ?)
         ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), updated_at = NOW()`,
        [id, req.user.id, rating, comment]
      );
    } else {
      await dbRun(
        `INSERT INTO delivery_reviews (delivery_id, user_id, rating, comment)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(delivery_id, user_id)
         DO UPDATE SET rating = excluded.rating, comment = excluded.comment, updated_at = datetime('now')`,
        [id, req.user.id, rating, comment]
      );
    }
    return res.json({ ok: true, id, rating, comment });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: "review_failed", message: e?.message || "Server error" });
  }
});

/* ======================== PATCH report ===================== */
// body: { reason: "late|missing|attitude|damage|other"|text, details, images[] }
r.patch("/:id/report", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    let { reason, details = "", images = [] } = req.body || {};
    const type = normalizeReason(reason);

    const allow = new Set(["late", "missing", "attitude", "damage", "other"]);
    if (!id || !type || !allow.has(type))
      return res.status(400).json({ error: "invalid_input" });
    if (details && String(details).trim().length < 5)
      return res.status(400).json({ error: "details_too_short" });

    const row = await getDeliveryFull(id);
    if (!row) return res.status(404).json({ error: "not_found" });

    const admin = isAdmin(req.user);
    const isOwnerReceiver = row.receiver_id === req.user.id;
    const isOwnerShipper = row.shipper_id === req.user.id;
    if (!(isOwnerReceiver || isOwnerShipper || admin))
      return res.status(403).json({ error: "forbidden" });

    const reportId = crypto.randomUUID();
    const imagesJson = JSON.stringify(Array.isArray(images) ? images : []);

    if (useMySQL) {
      await dbRun(
        `INSERT INTO delivery_reports (id, delivery_id, reporter_id, type, content, images_json, status)
         VALUES (${CAST_BIN}, ${CAST_BIN}, ${CAST_BIN}, ?, ?, ?, 'open')`,
        [reportId, id, req.user.id, type, details, imagesJson]
      );
    } else {
      await dbRun(
        `INSERT INTO delivery_reports
           (id, delivery_id, reporter_id, type, content, images_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', datetime('now'), datetime('now'))`,
        [reportId, id, req.user.id, type, details, imagesJson]
      );
    }
    return res.json({
      ok: true,
      id,
      report_id: reportId,
      type,
      reason: type,
      details,
      status: "open",
    });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ error: "report_failed", message: e?.message || "Server error" });
  }
});

/* ==================== REPORTS: list (mine) ==================== */
r.get("/:id/reports", requireAuth, async (req, res) => {
  try {
    const deliveryId = String(req.params.id || "");
    if (!deliveryId)
      return res.status(400).json({ error: "invalid_delivery_id" });

    const del = await getDeliveryFull(deliveryId);
    if (!del) return res.status(404).json({ error: "delivery_not_found" });

    const admin = isAdmin(req.user);
    const shipper = isShipper(req.user);
    const isOwnerShipper = del.shipper_id === req.user.id;
    const isOwnerReceiver = del.receiver_id === req.user.id;
    if (!(admin || shipper || isOwnerShipper || isOwnerReceiver))
      return res.status(403).json({ error: "forbidden" });

    let hasAdminUserId = false,
      hasAdminReply = false;
    if (useMySQL) {
      [hasAdminUserId, hasAdminReply] = await Promise.all([
        mysqlHasColumn("delivery_reports", "admin_user_id"),
        mysqlHasColumn("delivery_reports", "admin_reply"),
      ]);
    } else {
      await sqliteAddColumnIfMissing("delivery_reports", "admin_reply TEXT");
      await sqliteAddColumnIfMissing(
        "delivery_reports",
        "admin_user_id INTEGER"
      );
      hasAdminUserId = true;
      hasAdminReply = true;
    }

    let select = `SELECT dr.id, dr.delivery_id, dr.reporter_id, dr.type, dr.content, dr.images_json,
              dr.status, dr.admin_note, dr.created_at, dr.updated_at,
              ru.name AS reporter_name`;

    if (useMySQL && hasAdminUserId && hasAdminReply) {
      select += `, dr.admin_user_id, dr.admin_reply, au.name AS handled_by_name`;
    } else {
      select += `, NULL AS admin_user_id, NULL AS admin_reply, NULL AS handled_by_name`;
    }

    let sql = `${select}
         FROM delivery_reports dr
         LEFT JOIN users ru ON ${
           useMySQL
             ? "ru.id COLLATE utf8mb4_bin = dr.reporter_id COLLATE utf8mb4_bin"
             : "ru.id = dr.reporter_id"
         }`;

    if (useMySQL && hasAdminUserId) {
      sql += ` LEFT JOIN users au ON au.id COLLATE utf8mb4_bin = dr.admin_user_id COLLATE utf8mb4_bin`;
    }

    sql += ` WHERE ${
      useMySQL
        ? `dr.delivery_id COLLATE utf8mb4_bin = ${CAST_BIN}`
        : `dr.delivery_id = ?`
    }
             ORDER BY dr.created_at DESC, dr.updated_at DESC`;

    const rows = await dbAll(sql, [deliveryId]);

    const items = rows.map((r) => ({
      id: r.id,
      delivery_id: r.delivery_id,
      reporter_id: r.reporter_id,
      reporter_name: r.reporter_name || null,
      reason: r.type,
      type: r.type,
      details: r.content,
      images: r.images_json ? safeParseJSON(r.images_json, []) : [],
      status: r.status,
      admin_reply: r.admin_reply ?? r.admin_note ?? "",
      handled_by_name: r.handled_by_name || null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return res.json({ items });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({
        error: "list_reports_failed",
        message: e?.message || "Server error",
      });
  }
});

/* ==================== REPORTS: admin reply ==================== */
// body: { reply: string, status?: "open"|"reviewing"|"in_progress"|"resolved"|"rejected"|"closed" }
r.patch("/:id/reports/:rid/reply", requireAuth, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: "forbidden" });

    const deliveryId = String(req.params.id || "");
    const rid = String(req.params.rid || "");
    if (!deliveryId || !rid)
      return res.status(400).json({ error: "invalid_input" });

    const report = await dbGet(
      useMySQL
        ? `SELECT id, delivery_id FROM delivery_reports
           WHERE id COLLATE utf8mb4_bin = ${CAST_BIN}`
        : `SELECT id, delivery_id FROM delivery_reports WHERE id = ?`,
      [rid]
    );
    if (!report || report.delivery_id !== deliveryId)
      return res.status(404).json({ error: "report_not_found" });

    let { reply = "", status = "" } = req.body || {};
    reply = String(reply || "");
    status = String(status || "")
      .toLowerCase()
      .trim();

    const allowStatus = new Set([
      "open",
      "reviewing",
      "in_progress",
      "resolved",
      "rejected",
      "closed",
      "",
    ]);
    if (!allowStatus.has(status))
      return res.status(400).json({ error: "invalid_status" });

    let hasAdminUserId = false,
      hasAdminReply = false;
    if (useMySQL) {
      [hasAdminUserId, hasAdminReply] = await Promise.all([
        mysqlHasColumn("delivery_reports", "admin_user_id"),
        mysqlHasColumn("delivery_reports", "admin_reply"),
      ]);
    } else {
      await sqliteAddColumnIfMissing("delivery_reports", "admin_reply TEXT");
      await sqliteAddColumnIfMissing(
        "delivery_reports",
        "admin_user_id INTEGER"
      );
      hasAdminUserId = true;
      hasAdminReply = true;
    }

    const sets = ["admin_note = ?"];
    const params = [reply];
    if (hasAdminReply) {
      sets.push("admin_reply = ?");
      params.push(reply);
    }
    if (hasAdminUserId) {
      sets.push("admin_user_id = ?");
      params.push(req.user.id);
    }
    if (status) {
      sets.push("status = ?");
      params.push(status);
    }
    sets.push(useMySQL ? "updated_at = NOW()" : "updated_at = datetime('now')");

    const sql = useMySQL
      ? `UPDATE delivery_reports SET ${sets.join(
          ", "
        )} WHERE id COLLATE utf8mb4_bin = ${CAST_BIN}`
      : `UPDATE delivery_reports SET ${sets.join(", ")} WHERE id = ?`;
    params.push(rid);
    await dbRun(sql, params);

    return res.json({
      ok: true,
      report_id: rid,
      delivery_id: deliveryId,
      status: status || undefined,
      reply,
    });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({
        error: "reply_report_failed",
        message: e?.message || "Server error",
      });
  }
});

/* ==================== small utils ==================== */
function safeParseJSON(s, d) {
  try {
    return JSON.parse(s);
  } catch {
    return d;
  }
}

export default r;
