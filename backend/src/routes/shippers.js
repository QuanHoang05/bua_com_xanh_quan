// backend/src/routes/shippers.js — fixed & hardened for MariaDB 10.4 / SQLite
// - Tránh CASE WHEN ? ... trong UPDATE (gây “near ?”).
// - Không dùng JSON_* trong SQL; proof_images xử lý bằng JS.
// - Thứ tự placeholder args khớp 100% với SET ... (không còn “near ?”).
// - Auth lấy user từ DB để có role chính xác.

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import "dotenv/config";

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
    const [res] = await db.query(sql, params);
    return res;
  }
  return db.prepare(sql).run(...params);
}
const NOW_SQL = useMySQL ? "NOW()" : "datetime('now')";

/* ---------------- auth (fetch user -> real role) ---------------- */
async function authRequired(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing token" });
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret"); // { id, ... }
    const u = await dbGet(
      "SELECT id, name, email, role, phone FROM users WHERE id=?",
      [payload.id]
    );
    if (!u) return res.status(401).json({ error: "Invalid user" });
    req.user = u;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
const ensureRole =
  (...roles) =>
  (req, res, next) => {
    const role = String(req.user?.role || "").toLowerCase();
    if (!roles.map((r) => r.toLowerCase()).includes(role))
      return res.status(403).json({ error: "Forbidden" });
    next();
  };

/* ---------------- file upload (proofs) ---------------- */
const proofsDir = path.join(process.cwd(), "uploads", "proofs");
fs.mkdirSync(proofsDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, proofsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file?.originalname || ".jpg");
    cb(
      null,
      `proof_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`
    );
  },
});
const upload = multer({ storage });

/* ---------------- state machine ---------------- */
const ALLOWED = ["pending", "assigned", "picking", "delivered", "cancelled"];
const edges = {
  pending: ["assigned", "cancelled"],
  assigned: ["picking", "cancelled"],
  picking: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};
function assertTransition(prev, next) {
  if (!ALLOWED.includes(next) || !edges[prev]?.includes(next)) {
    const err = new Error(`invalid_transition ${prev} -> ${next}`);
    err.status = 409;
    throw err;
  }
}

/* ---------------- SELECT chung ---------------- */
const SELECT_LIST = `
  SELECT
    d.id, d.booking_id, d.status, d.qty, d.updated_at,
    COALESCE(d.pickup_name, pp.name) AS pickup_name,
    COALESCE(d.pickup_address, pp.address, pa_d.line1, pa_b.line1) AS pickup_address,
    COALESCE(d.dropoff_name, b.dropoff_name) AS dropoff_name,
    COALESCE(d.dropoff_address, da_d.line1, da_b.line1, b.dropoff_address) AS dropoff_address,
    d.dropoff_phone,
    d.note,
    COALESCE(pa_d.lat, pa_b.lat, pp.lat)  AS pickup_lat,
    COALESCE(pa_d.lng, pa_b.lng, pp.lng)  AS pickup_lng,
    COALESCE(da_d.lat, da_b.lat)          AS dropoff_lat,
    COALESCE(da_d.lng, da_b.lng)          AS dropoff_lng,
    d.current_lat, d.current_lng,
    d.shipper_id, d.picked_at, d.delivered_at, d.cancelled_at, d.proof_images
  FROM deliveries d
  LEFT JOIN bookings   b    ON b.id = d.booking_id
  LEFT JOIN addresses  pa_d ON pa_d.id = d.pickup_addr_id
  LEFT JOIN addresses  pa_b ON pa_b.id = b.pickup_addr_id
  LEFT JOIN addresses  da_d ON da_d.id = d.dropoff_addr_id
  LEFT JOIN addresses  da_b ON da_b.id = b.dropoff_addr_id
  LEFT JOIN pickup_points pp ON pp.id = b.pickup_point
`;

/* ---------------- utils ---------------- */
function safeArr(v) {
  if (Array.isArray(v)) return v;
  try {
    const j = JSON.parse(v || "[]");
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

/* ======================================================================
   GET /api/shipper/deliveries
====================================================================== */
router.get(
  "/deliveries",
  authRequired,
  ensureRole("shipper", "admin"),
  async (req, res) => {
    try {
      const status = String(req.query.status || "active").toLowerCase();
      const q = String(req.query.q || "").trim();
      const page = Math.max(1, parseInt(req.query.page || 1, 10));
      const pageSize = Math.max(
        1,
        Math.min(
          200,
          parseInt(req.query.page_size || req.query.pageSize || 20, 10)
        )
      );

      const conds = [];
      const p = [];
      if (String(req.user.role).toLowerCase() === "shipper") {
        conds.push("d.shipper_id = ?");
        p.push(req.user.id);
      }
      if (status && status !== "all") {
        if (status === "active")
          conds.push("d.status IN ('assigned','picking')");
        else {
          conds.push("d.status = ?");
          p.push(status);
        }
      } else {
        conds.push(
          "d.status IN ('pending','assigned','picking','delivered','cancelled')"
        );
      }
      if (q) {
        conds.push(`(
        d.id LIKE ? OR
        IFNULL(d.pickup_address,'')  LIKE ? OR
        IFNULL(d.dropoff_address,'') LIKE ? OR
        IFNULL(pa_d.line1,'') LIKE ? OR IFNULL(da_d.line1,'') LIKE ?
      )`);
        p.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
      }

      const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

      const cnt = await dbGet(
        `SELECT COUNT(1) AS c FROM deliveries d
       LEFT JOIN addresses  pa_d ON pa_d.id = d.pickup_addr_id
       LEFT JOIN addresses  da_d ON da_d.id = d.dropoff_addr_id
       ${where}`,
        p
      );
      const total = Number(cnt?.c || 0);
      const offset = (page - 1) * pageSize;

      const items = await dbAll(
        `${SELECT_LIST}
       ${where}
       ORDER BY d.updated_at DESC
       LIMIT ? OFFSET ?`,
        [...p, pageSize, offset]
      );

      // chuẩn hóa images
      for (const it of items) it.proof_images = safeArr(it.proof_images);

      res.json({ items, total, page, pageSize });
    } catch (e) {
      res.status(500).json({ error: e.message || "server_error" });
    }
  }
);

/* ======================================================================
   GET /api/shipper/deliveries/:id
====================================================================== */
router.get(
  "/deliveries/:id",
  authRequired,
  ensureRole("shipper", "admin"),
  async (req, res) => {
    try {
      const id = String(req.params.id);
      const row = await dbGet(`${SELECT_LIST} WHERE d.id=?`, [id]);
      if (!row) return res.status(404).json({ error: "not_found" });

      if (
        String(req.user.role).toLowerCase() === "shipper" &&
        row.shipper_id !== req.user.id
      ) {
        return res.status(403).json({ error: "forbidden" });
      }

      row.proof_images = safeArr(row.proof_images);
      res.json({ delivery: row });
    } catch (e) {
      res.status(500).json({ error: e.message || "server_error" });
    }
  }
);

/* ======================================================================
   PATCH /api/shipper/deliveries/:id  (update status)
   body: { status, photo_url?, pod_name?, note? }
====================================================================== */
router.patch(
  "/deliveries/:id",
  authRequired,
  ensureRole("shipper", "admin"),
  async (req, res) => {
    try {
      const id = String(req.params.id);
      const to = String(req.body?.status || "").trim();
      const photo_url = String(req.body?.photo_url || "");
      const pod_name = String(req.body?.pod_name || "");
      const note = req.body?.note == null ? "" : String(req.body.note);

      const dv = await dbGet(
        `SELECT id, shipper_id, status, proof_images FROM deliveries WHERE id=?`,
        [id]
      );
      if (!dv) return res.status(404).json({ error: "not_found" });
      const isAdmin = String(req.user.role).toLowerCase() === "admin";
      if (!isAdmin && dv.shipper_id !== req.user.id)
        return res.status(403).json({ error: "forbidden" });

      assertTransition(dv.status, to);

      // merge proof images ở JS
      const imgs = safeArr(dv.proof_images);
      if (photo_url && !imgs.includes(photo_url)) imgs.push(photo_url);

      // Build SET + args theo thứ tự chắc chắn — KHÔNG dùng CASE WHEN ? ...
      const sets = ["status=?", "proof_images=?", "updated_at=" + NOW_SQL];
      const args = [to, JSON.stringify(imgs)];

      if (pod_name) {
        sets.push("dropoff_name=?");
        args.push(pod_name);
      }
      if (note) {
        sets.push("note=?");
        args.push(note);
      }

      // timestamps theo trạng thái
      if (to === "picking") sets.push("picked_at=" + NOW_SQL);
      if (to === "delivered") sets.push("delivered_at=" + NOW_SQL);
      if (to === "cancelled") sets.push("cancelled_at=" + NOW_SQL);

      // shipper lock (ensure the row is assigned)
      sets.push("shipper_id=?");
      args.push(
        isAdmin && !dv.shipper_id ? req.user.id : dv.shipper_id || req.user.id
      );

      // where id cuối cùng
      args.push(id);
      await dbRun(`UPDATE deliveries SET ${sets.join(", ")} WHERE id=?`, args);

      const fresh = await dbGet(`${SELECT_LIST} WHERE d.id=?`, [id]);
      fresh.proof_images = safeArr(fresh.proof_images);
      res.json(fresh);
    } catch (e) {
      if (String(e.message).startsWith("invalid_transition")) {
        return res.status(409).json({ error: "invalid_transition" });
      }
      res.status(500).json({ error: e.message || "server_error" });
    }
  }
);

/* ======================================================================
   PATCH /api/shipper/telemetry  (cập nhật vị trí realtime)
   Body: { lat, lng, delivery_id? }
====================================================================== */
router.patch(
  "/telemetry",
  authRequired,
  ensureRole("shipper", "admin"),
  async (req, res) => {
    try {
      const lat = Number(req.body?.lat),
        lng = Number(req.body?.lng);
      const deliveryId = req.body?.delivery_id
        ? String(req.body.delivery_id)
        : null;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: "invalid_lat_lng" });
      }

      let target = deliveryId
        ? await dbGet(`SELECT id FROM deliveries WHERE id=?`, [deliveryId])
        : await dbGet(
            `SELECT id FROM deliveries WHERE shipper_id=? AND status IN ('assigned','picking') ORDER BY updated_at DESC LIMIT 1`,
            [req.user.id]
          );

      if (!target) return res.status(404).json({ error: "no_active_delivery" });

      await dbRun(
        `UPDATE deliveries
         SET current_lat=?, current_lng=?, updated_at=${NOW_SQL}
       WHERE id=?`,
        [lat, lng, target.id]
      );

      res.json({ ok: true, delivery_id: target.id, lat, lng });
    } catch (e) {
      res.status(500).json({ error: e.message || "server_error" });
    }
  }
);

/* ======================================================================
   POST /api/shipper/deliveries/:id/proofs  (nhiều ảnh)
   ALIAS: POST /api/shipper/deliveries/:id/proof  (một ảnh, field "file")
====================================================================== */
async function handleUploadProofs(req, res) {
  const id = String(req.params.id);
  const dv = await dbGet(
    `SELECT id, shipper_id, proof_images FROM deliveries WHERE id=?`,
    [id]
  );
  if (!dv) return res.status(404).json({ error: "not_found" });
  const isAdmin = String(req.user.role).toLowerCase() === "admin";
  if (!isAdmin && dv.shipper_id !== req.user.id)
    return res.status(403).json({ error: "forbidden" });

  const urls = [];
  for (const f of req.files || []) {
    const rel = `/uploads/proofs/${path.basename(f.path)}`.replace(/\\/g, "/");
    urls.push(rel);
  }

  const next = JSON.stringify([...safeArr(dv.proof_images), ...urls]);
  await dbRun(
    `UPDATE deliveries SET proof_images=?, updated_at=${NOW_SQL} WHERE id=?`,
    [next, id]
  );

  res.json({ ok: true, urls });
}
router.post(
  "/deliveries/:id/proofs",
  authRequired,
  ensureRole("shipper", "admin"),
  upload.array("files", 6),
  async (req, res) => {
    try {
      await handleUploadProofs(req, res);
    } catch (e) {
      res.status(500).json({ error: e.message || "server_error" });
    }
  }
);
router.post(
  "/deliveries/:id/proof",
  authRequired,
  ensureRole("shipper", "admin"),
  upload.single("file"),
  async (req, res) => {
    try {
      req.files = req.file ? [req.file] : [];
      await handleUploadProofs(req, res);
    } catch (e) {
      res.status(500).json({ error: e.message || "server_error" });
    }
  }
);

export default router;
