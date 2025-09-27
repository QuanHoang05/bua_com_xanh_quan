import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import "dotenv/config";
import { db, isMySQL } from "../lib/db.js";
import { requireAuth, hashPassword, comparePassword } from "../middlewares/auth.js";

const router = Router();

/* ------------------------- Tiny utils ------------------------- */
const uploadDir = process.env.UPLOAD_DIR || "./uploads";
const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `u_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage });

const ok = (res, data) => res.json(data);
const now = () => (new Date()).toISOString().slice(0, 19).replace("T", " ");

/* ------------------------- USERS / PROFILE ------------------------- */
// GET /api/users/me
router.get("/users/me", requireAuth, async (req, res) => {
  return ok(res, req.user);
});

// PATCH /api/users/me
router.patch("/users/me", requireAuth, async (req, res) => {
  const { name, phone, address, avatar_url, lat, lng } = req.body || {};
  await db.run(
    `UPDATE users SET 
       name = COALESCE(?, name),
       phone = COALESCE(?, phone),
       address = COALESCE(?, address),
       avatar_url = COALESCE(?, avatar_url),
       lat = ?, lng = ?,
       updated_at = ?
     WHERE id = ?`,
    [name, phone, address, avatar_url, lat ?? null, lng ?? null, now(), req.user.id]
  );
  const me = await db.get("SELECT id, email, name, phone, avatar_url, address, lat, lng, role FROM users WHERE id = ?", [req.user.id]);
  ok(res, me);
});

/* ------------------------- PASSWORD ------------------------- */
// PATCH /api/users/me/password
router.patch("/users/me/password", requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return res.status(400).json({ error: "Missing fields" });

  const row = await db.get("SELECT password FROM users WHERE id = ?", [req.user.id]);
  if (!row?.password) return res.status(400).json({ error: "No password set" });
  const match = await comparePassword(current_password, row.password);
  if (!match) return res.status(400).json({ error: "Current password incorrect" });

  const hashed = await hashPassword(new_password);
  await db.run("UPDATE users SET password = ?, updated_at = ? WHERE id = ?", [hashed, now(), req.user.id]);
  ok(res, { changed: true });
});

// (fallback legacy) POST /api/auth/change-password
router.post("/auth/change-password", requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return res.status(400).json({ error: "Missing fields" });

  const row = await db.get("SELECT password FROM users WHERE id = ?", [req.user.id]);
  const match = await comparePassword(current_password, row?.password || "");
  if (!match) return res.status(400).json({ error: "Current password incorrect" });

  const hashed = await hashPassword(new_password);
  await db.run("UPDATE users SET password = ?, updated_at = ? WHERE id = ?", [hashed, now(), req.user.id]);
  ok(res, { changed: true });
});

/* ------------------------- SESSIONS ------------------------- */
// GET /api/users/sessions  (optional, nếu không có bảng sessions thì trả mảng rỗng)
router.get("/users/sessions", requireAuth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT id, user_id, device, ip, last_seen, 
              CASE WHEN current_device = 1 THEN 1 ELSE 0 END AS current
         FROM sessions
        WHERE user_id = ?
        ORDER BY last_seen DESC
        LIMIT 50`, [req.user.id]);
    ok(res, rows || []);
  } catch {
    ok(res, []);
  }
});

// POST /api/users/logout-others  (đánh dấu invalidate trừ phiên hiện tại nếu bạn lưu được token hash)
router.post("/users/logout-others", requireAuth, async (req, res) => {
  try {
    await db.run(
      `UPDATE sessions SET revoked = 1, updated_at = ?
        WHERE user_id = ? AND (current_device = 0 OR current_device IS NULL)`,
      [now(), req.user.id]
    );
  } catch {}
  ok(res, { ok: 1 });
});

/* ------------------------- HISTORY (given / received / payments) ------------------------- */
// GET /api/users/history?limit=8
router.get("/users/history", requireAuth, async (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 8)));

  // GIVEN: có thể xem donor đã giao / shipper đã giao / items đã cho
  const given = await db.all(
    `
    SELECT d.id, d.qty, d.status, d.created_at, d.delivered_at,
           d.dropoff_name, d.dropoff_address
      FROM deliveries d
     WHERE (d.donor_id = ? OR d.shipper_id = ?)
     ORDER BY COALESCE(d.delivered_at, d.created_at) DESC
     LIMIT ?`,
    [req.user.id, req.user.id, limit]
  ).catch(() => []);

  // RECEIVED: người nhận đã nhận
  const received = await db.all(
    `
    SELECT d.id, d.qty, d.status, d.created_at, d.delivered_at, d.completed_at,
           d.pickup_name, d.pickup_address
      FROM deliveries d
     WHERE d.receiver_id = ?
     ORDER BY COALESCE(d.completed_at, d.delivered_at, d.created_at) DESC
     LIMIT ?`,
    [req.user.id, limit]
  ).catch(() => []);

  // PAYMENTS: ưu tiên bảng payments (phí/đơn), sau đó donations (quyên góp tiền)
  let payments = await db.all(
    `
    SELECT p.id, p.amount, p.status, p.provider, p.currency, p.created_at, p.booking_id
      FROM payments p
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC
     LIMIT ?`,
    [req.user.id, limit]
  ).catch(() => []);

  // Nếu không có bảng payments hoặc rỗng, fallback donations
  if (!Array.isArray(payments) || payments.length === 0) {
    payments = await db.all(
      `
      SELECT d.id, d.amount, d.status, d.created_at
        FROM donations d
       WHERE d.donor_id = ?
       ORDER BY d.created_at DESC
       LIMIT ?`,
      [req.user.id, limit]
    ).catch(() => []);
  }

  ok(res, { given, received, payments });
});

/* ------------------------- EXPORT DATA ------------------------- */
// GET /api/users/export  -> trả JSON file download
router.get("/users/export", requireAuth, async (req, res) => {
  const uid = req.user.id;
  const me = await db.get("SELECT id, email, name, phone, avatar_url, address, lat, lng, role, created_at, updated_at FROM users WHERE id = ?", [uid]);

  const [payments, donations, deliveries, bookings] = await Promise.all([
    db.all("SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC", [uid]).catch(() => []),
    db.all("SELECT * FROM donations WHERE donor_id = ? ORDER BY created_at DESC", [uid]).catch(() => []),
    db.all("SELECT * FROM deliveries WHERE donor_id = ? OR receiver_id = ? OR shipper_id = ? ORDER BY created_at DESC", [uid, uid, uid]).catch(() => []),
    db.all("SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC", [uid]).catch(() => []),
  ]);

  const payload = { exported_at: new Date().toISOString(), user: me, payments, donations, deliveries, bookings };
  const buf = Buffer.from(JSON.stringify(payload, null, 2), "utf-8");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="bua-com-xanh-data-${uid}.json"`);
  res.send(buf);
});

/* ------------------------- DELETE ACCOUNT ------------------------- */
// POST /api/users/delete
router.post("/users/delete", requireAuth, async (req, res) => {
  const uid = req.user.id;

  // tuỳ business: xoá mềm hay cứng; ở đây xoá mềm
  await db.run("UPDATE users SET deleted_at = ?, name = CONCAT('[DELETED] ', COALESCE(name,'')) WHERE id = ?", [now(), uid]).catch(()=>{});
  // ẩn các bản ghi liên quan tuỳ ý
  await db.run("UPDATE donations SET hidden = 1 WHERE donor_id = ?", [uid]).catch(()=>{});
  await db.run("UPDATE payments SET hidden = 1 WHERE user_id = ?", [uid]).catch(()=>{});

  ok(res, { deleted: true });
});

/* ------------------------- UPLOAD (avatar) ------------------------- */
// POST /api/upload
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const url = `${baseUrl}/uploads/${req.file.filename}`;
  ok(res, { url });
});

export default router;
