// backend/src/routes/pickup_points.js
import { Router } from "express";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.js"));
else ({ db } = await import("../lib/db.js"));

const router = Router();

/* ========== DB helpers ========== */
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

/* ========== Utils ========== */
function parseJSONMaybe(v) {
  if (v == null || v === "") return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  } // với SQLite lưu TEXT
}
function mapPoint(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? "",
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    opening: parseJSONMaybe(row.opening), // JSON trong MySQL, TEXT trong SQLite
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/* ========== Public endpoints ========== */

/** GET /api/pickup-points
 *  Trả danh sách điểm giao nhận đang hoạt động (public)
 */
router.get("/", async (_req, res) => {
  try {
    const rows = await dbAll(
      `SELECT id,name,address,lat,lng,opening,status,created_at,updated_at
         FROM pickup_points
        WHERE status='active'
     ORDER BY created_at DESC`
    );
    res.json(rows.map(mapPoint));
  } catch (e) {
    console.error("[pickup_points:list] ", e);
    res.status(500).json({ error: "internal_error" });
  }
});

/** GET /api/pickup-points/mine
 *  FE đang dùng để lấy list + default_id (hiện bảng không có cột user_id)
 *  Trả cùng danh sách active + default_id = null
 */
router.get("/mine", async (_req, res) => {
  try {
    const rows = await dbAll(
      `SELECT id,name,address,lat,lng,opening,status,created_at,updated_at
         FROM pickup_points
        WHERE status='active'
     ORDER BY created_at DESC`
    );
    res.json({ items: rows.map(mapPoint), default_id: null });
  } catch (e) {
    console.error("[pickup_points:mine] ", e);
    res.status(500).json({ error: "internal_error" });
  }
});

/** GET /api/pickup-points/:id
 *  Lấy chi tiết 1 điểm đang hoạt động
 */
router.get("/:id", async (req, res) => {
  try {
    const row = await dbGet(
      `SELECT id,name,address,lat,lng,opening,status,created_at,updated_at
         FROM pickup_points
        WHERE id=? AND status='active'`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: "not_found" });
    res.json(mapPoint(row));
  } catch (e) {
    console.error("[pickup_points:detail] ", e);
    res.status(500).json({ error: "internal_error" });
  }
});
// src/routes/pickup_points.js – thêm route public “mine” ở cuối file
router.get("/mine", async (_req, res) => {
  const items = await dbAll(
    `SELECT * FROM pickup_points WHERE status='active' ORDER BY created_at DESC`
  );
  res.json({ items, default_id: null });
});

export default router;
