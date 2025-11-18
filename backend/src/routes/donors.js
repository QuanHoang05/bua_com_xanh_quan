// src/routes/donors.js (ESM) — hardened, no “near ?” in LIMIT/OFFSET
// MySQL & SQLite compatible. Adds default_address on /me, endpoint to set default pickup,
// and request-pickup falls back to default address if FE doesn't send one.

import { Router } from "express";
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
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/* ---------------- small helpers ---------------- */
async function dbGet(sql, params = []) {
  try {
    if (useMySQL) {
      const [rows] = await db.query(sql, params);
      return rows?.[0] ?? null;
    }
    return db.prepare(sql).get(...params);
  } catch (e) {
    console.error(
      "SQL ERROR dbGet:",
      e.message,
      "\nSQL:",
      sql,
      "\nPARAMS:",
      params
    );
    throw e;
  }
}
async function dbAll(sql, params = []) {
  try {
    if (useMySQL) {
      const [rows] = await db.query(sql, params);
      return rows ?? [];
    }
    return db.prepare(sql).all(...params);
  } catch (e) {
    console.error(
      "SQL ERROR dbAll:",
      e.message,
      "\nSQL:",
      sql,
      "\nPARAMS:",
      params
    );
    throw e;
  }
}
async function dbRun(sql, params = []) {
  try {
    if (useMySQL) {
      const [r] = await db.query(sql, params);
      return r;
    }
    return db.prepare(sql).run(...params);
  } catch (e) {
    console.error(
      "SQL ERROR dbRun:",
      e.message,
      "\nSQL:",
      sql,
      "\nPARAMS:",
      params
    );
    throw e;
  }
}
const nowSQL = useMySQL ? "NOW()" : "datetime('now')";
const uuidSQL = useMySQL ? "UUID()" : null;
const EMPTY_JSON_ARRAY_SQL = useMySQL ? "JSON_ARRAY()" : "json('[]')";

const parseMaybeJSON = (v) => {
  if (v == null) return null;
  if (Array.isArray(v) || typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return null;
};

/* ---------------- address helpers ---------------- */
async function getDefaultAddress(uid) {
  try {
    return await dbGet(
      `SELECT id, label, line1, lat, lng
         FROM addresses
        WHERE user_id=? 
        ORDER BY is_default DESC, updated_at DESC, created_at DESC
        LIMIT 1`,
      [uid]
    );
  } catch {
    return null;
  }
}

/* ---------------- auth ---------------- */
async function requireUser(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ error: "Missing token" });
    const payload = jwt.verify(m[1], JWT_SECRET); // { id, email, role }

    const user = await dbGet(
      "SELECT id,name,email,avatar_url,address,status,phone FROM users WHERE id=?",
      [payload.id]
    );
    if (!user) return res.status(401).json({ error: "Invalid user" });

    // Normalize users.address if JSON string
    const addrObj = parseMaybeJSON(user.address) || user.address;

    // Attach default_address from addresses table (or fallback to users.address)
    const def = await getDefaultAddress(user.id);
    if (def) {
      user.default_address = {
        id: def.id,
        label: def.label || def.line1,
        line1: def.line1,
        lat: def.lat,
        lng: def.lng,
        source: "addresses",
      };
    } else if (addrObj && typeof addrObj === "object") {
      user.default_address = {
        id: null,
        label: addrObj.label || addrObj.line1 || "Địa chỉ của tôi",
        line1: addrObj.line1 || "",
        lat: addrObj.lat ?? addrObj.latitude ?? null,
        lng: addrObj.lng ?? addrObj.longitude ?? null,
        source: "users.address",
      };
    } else {
      user.default_address = null;
    }

    req.user = user;
    next();
  } catch (e) {
    console.error("Auth error:", e?.message);
    res.status(401).json({ error: "Unauthorized" });
  }
}

/* =========================================================
   0) Profile / Stats
========================================================= */
router.get("/me", requireUser, (req, res) => res.json(req.user));

router.get("/stats", requireUser, async (req, res) => {
  try {
    const uid = req.user.id;

    const donations = await dbAll(
      `SELECT d.id, d.type, d.amount, d.qty, d.status, d.created_at, d.paid_at,
              d.campaign_id,
              c.meal_price, c.meta
         FROM donations d
    LEFT JOIN campaigns c ON c.id = d.campaign_id
        WHERE d.user_id=? AND d.status='success'
     ORDER BY d.created_at ASC`,
      [uid]
    );

    let totalMoney = 0,
      mealsFromMoney = 0,
      inKindMeals = 0,
      donationsCount = 0;
    const campaignSet = new Set();
    let firstAt = null,
      lastAt = null;

    for (const d of donations) {
      donationsCount += 1;
      if (d.campaign_id != null) campaignSet.add(d.campaign_id);

      const amount = Number(d.amount || 0);
      const qty = Number(d.qty || 0);
      totalMoney += amount;
      inKindMeals += qty > 0 ? qty : 0;

      let price = Number(d.meal_price || 0);
      if (!price) {
        try {
          const meta =
            typeof d.meta === "string"
              ? JSON.parse(d.meta || "{}")
              : d.meta || {};
          price = Number(meta?.meal?.price || 0) || 10000;
        } catch {
          price = 10000;
        }
      }
      if (amount > 0 && price > 0) mealsFromMoney += Math.floor(amount / price);

      const ts = new Date(d.paid_at || d.created_at);
      if (!firstAt || ts < firstAt) firstAt = ts;
      if (!lastAt || ts > lastAt) lastAt = ts;
    }

    const totalMeals = inKindMeals + mealsFromMoney;

    const addr = await dbGet(
      `SELECT id,label,line1,lat,lng FROM addresses
        WHERE user_id=? AND is_default=1
     ORDER BY updated_at DESC, created_at DESC
        LIMIT 1`,
      [uid]
    ).catch(() => null);

    const open = await dbGet(
      `SELECT COUNT(*) AS active_bookings
         FROM bookings b
         JOIN food_items f ON f.id = b.item_id
        WHERE f.owner_id=? AND b.status IN ('pending','accepted')`,
      [uid]
    ).catch(() => ({ active_bookings: 0 }));

    res.json({
      total_money: totalMoney,
      in_kind_meals: inKindMeals,
      money_to_meals: mealsFromMoney,
      total_meals: totalMeals,
      donations_count: donationsCount,
      campaigns_supported: campaignSet.size,
      first_donation_at: firstAt?.toISOString() || null,
      last_donation_at: lastAt?.toISOString() || null,
      active_bookings: Number(open?.active_bookings || 0),

      // alias FE
      total_amount: totalMoney,
      count: donationsCount,
      default_pickup_point: addr
        ? {
            id: addr.id,
            name: addr.label || addr.line1,
            address: addr.line1,
            lat: addr.lat,
            lng: addr.lng,
          }
        : null,
    });
  } catch (e) {
    res
      .status(500)
      .json({ error: "stats_failed", message: e?.message || "Internal error" });
  }
});

/* =========================================================
   1) CRUD món/bữa (food_items)
========================================================= */
router.get("/food-items", requireUser, async (req, res) => {
  try {
    const uid = req.user.id;
    const rows = await dbAll(
      `SELECT * FROM food_items WHERE owner_id=? ORDER BY created_at DESC`,
      [uid]
    );
    res.json(
      rows.map((r) => {
        const images = parseMaybeJSON(r.images) || [];
        const tags = parseMaybeJSON(r.tags) || [];
        return {
          id: r.id,
          name: r.title,
          portions: Number(r.qty || 0),
          best_by: r.expire_at,
          pickup_address: r.location_addr,
          photo_url: Array.isArray(images) ? images[0] || null : null,
          is_veg: Array.isArray(tags) ? tags.includes("veg") : false,
          status: r.status,
          created_at: r.created_at,
        };
      })
    );
  } catch (e) {
    res
      .status(500)
      .json({
        error: "list_food_items_failed",
        message: e?.message || "Internal error",
      });
  }
});

router.post("/food-items", requireUser, async (req, res) => {
  try {
    const uid = req.user.id;
    const {
      name = "",
      portions = 0,
      photo_url = "",
      is_veg = false,
      pickup_address = "",
      best_by = null,
      status = "available",
      description = null,
    } = req.body || {};

    const title = String(name || "").trim();
    const qty = Math.max(0, Number(portions || 0));
    const imagesJson = JSON.stringify(photo_url ? [photo_url] : []);
    const tagsJson = JSON.stringify(is_veg ? ["veg"] : []);

    let newId;
    if (useMySQL) {
      await dbRun(
        `INSERT INTO food_items
         (id, owner_id, title, description, qty, unit, expire_at, location_addr, lat, lng, tags, images, status, visibility, created_at)
         VALUES (${uuidSQL}, ?, ?, ?, ?, 'suat', ?, ?, NULL, NULL, ?, ?, ?, 'public', ${nowSQL})`,
        [
          uid,
          title,
          description,
          qty,
          best_by,
          pickup_address,
          tagsJson,
          imagesJson,
          status,
        ]
      );
      const r = await dbGet(
        `SELECT id FROM food_items WHERE owner_id=? ORDER BY created_at DESC LIMIT 1`,
        [uid]
      );
      newId = r?.id;
    } else {
      const { v4: uuidv4 } = await import("uuid");
      newId = uuidv4();
      await dbRun(
        `INSERT INTO food_items
         (id, owner_id, title, description, qty, unit, expire_at, location_addr, lat, lng, tags, images, status, visibility, created_at)
         VALUES (?, ?, ?, ?, ?, 'suat', ?, ?, NULL, NULL, json(?), json(?), ?, 'public', ${nowSQL})`,
        [
          newId,
          uid,
          title,
          description,
          qty,
          best_by,
          pickup_address,
          tagsJson,
          imagesJson,
          status,
        ]
      );
    }

    const row = await dbGet(`SELECT * FROM food_items WHERE id=?`, [newId]);
    const images = parseMaybeJSON(row.images) || [];
    const tags = parseMaybeJSON(row.tags) || [];

    res.json({
      id: row.id,
      name: row.title,
      portions: Number(row.qty || 0),
      best_by: row.expire_at,
      pickup_address: row.location_addr,
      photo_url: Array.isArray(images) ? images[0] || null : null,
      is_veg: Array.isArray(tags) ? tags.includes("veg") : false,
      status: row.status,
      created_at: row.created_at,
    });
  } catch (e) {
    res
      .status(500)
      .json({
        error: "create_food_item_failed",
        message: e?.message || "Internal error",
      });
  }
});

router.patch("/food-items/:id", requireUser, async (req, res) => {
  try {
    const uid = req.user.id;
    const id = String(req.params.id);

    const exists = await dbGet(
      "SELECT id, tags, images FROM food_items WHERE id=? AND owner_id=?",
      [id, uid]
    );
    if (!exists) return res.status(404).json({ error: "Not found" });

    const existsImages = parseMaybeJSON(exists.images) || [];
    const existsTags = parseMaybeJSON(exists.tags) || [];

    const allowMap = {
      name: "title",
      portions: "qty",
      best_by: "expire_at",
      pickup_address: "location_addr",
      status: "status",
      description: "description",
    };
    const sets = [];
    const args = [];

    for (const [k, v] of Object.entries(req.body || {})) {
      if (k === "photo_url") {
        const imgs = Array.isArray(existsImages) ? existsImages.slice() : [];
        if (v && (!imgs.length || imgs[0] !== v)) imgs[0] = v;
        sets.push("images=?");
        args.push(JSON.stringify(imgs));
      } else if (k === "is_veg") {
        const tags = Array.isArray(existsTags) ? existsTags.slice() : [];
        const idx = tags.indexOf("veg");
        if (v && idx < 0) tags.push("veg");
        if (!v && idx >= 0) tags.splice(idx, 1);
        sets.push("tags=?");
        args.push(JSON.stringify(tags));
      } else if (allowMap[k]) {
        sets.push(`${allowMap[k]}=?`);
        args.push(k === "portions" ? Number(v || 0) : v ?? null);
      }
    }

    if (sets.length) {
      args.push(id, uid);
      await dbRun(
        `UPDATE food_items SET ${sets.join(", ")} WHERE id=? AND owner_id=?`,
        args
      );
    }

    const row = await dbGet("SELECT * FROM food_items WHERE id=?", [id]);
    const images = parseMaybeJSON(row.images) || [];
    const tags = parseMaybeJSON(row.tags) || [];

    res.json({
      id: row.id,
      name: row.title,
      portions: Number(row.qty || 0),
      best_by: row.expire_at,
      pickup_address: row.location_addr,
      photo_url: Array.isArray(images) ? images[0] || null : null,
      is_veg: Array.isArray(tags) ? tags.includes("veg") : false,
      status: row.status,
      created_at: row.created_at,
    });
  } catch (e) {
    res
      .status(500)
      .json({
        error: "update_food_item_failed",
        message: e?.message || "Internal error",
      });
  }
});

router.delete("/food-items/:id", requireUser, async (req, res) => {
  try {
    const uid = req.user.id;
    const id = String(req.params.id);
    const own = await dbGet(
      "SELECT id FROM food_items WHERE id=? AND owner_id=?",
      [id, uid]
    );
    if (!own) return res.status(404).json({ error: "Not found" });
    await dbRun("DELETE FROM food_items WHERE id=?", [id]);
    res.json({ ok: true });
  } catch (e) {
    res
      .status(500)
      .json({
        error: "delete_food_item_failed",
        message: e?.message || "Internal error",
      });
  }
});

/* =========================================================
   2) Bundle (bundles + bundle_items)
========================================================= */
router.post("/bundles", requireUser, async (req, res) => {
  try {
    const uid = req.user.id;
    const { name = "", description = "", food_item_ids = [] } = req.body || {};
    const ids = (Array.isArray(food_item_ids) ? food_item_ids : []).map(String);

    let bundleId;
    if (useMySQL) {
      await dbRun(
        `INSERT INTO bundles (id, owner_id, title, description, cover, tags, status, created_at)
         VALUES (${uuidSQL}, ?, ?, ?, NULL, ${EMPTY_JSON_ARRAY_SQL}, 'active', ${nowSQL})`,
        [uid, name, description]
      );
      const row = await dbGet(
        "SELECT id FROM bundles WHERE owner_id=? ORDER BY created_at DESC LIMIT 1",
        [uid]
      );
      bundleId = row?.id;
    } else {
      const { v4: uuidv4 } = await import("uuid");
      bundleId = uuidv4();
      await dbRun(
        `INSERT INTO bundles (id, owner_id, title, description, cover, tags, status, created_at)
         VALUES (?, ?, ?, ?, NULL, json('[]'), 'active', ${nowSQL})`,
        [bundleId, uid, name, description]
      );
    }

    for (const fid of ids) {
      const ok = await dbGet(
        "SELECT id FROM food_items WHERE id=? AND owner_id=?",
        [fid, uid]
      );
      if (ok) {
        await dbRun(
          "INSERT INTO bundle_items (bundle_id, item_id) VALUES (?, ?)",
          [bundleId, fid]
        );
      }
    }

    const bundle = await dbGet("SELECT * FROM bundles WHERE id=?", [bundleId]);
    res.json(bundle);
  } catch (e) {
    res
      .status(500)
      .json({
        error: "create_bundle_failed",
        message: e?.message || "Internal error",
      });
  }
});

/* =========================================================
   3) Lịch sử quyên góp (donations + campaigns) — no placeholders in LIMIT/OFFSET
========================================================= */
router.get("/donations", requireUser, async (req, res) => {
  try {
    const uid = req.user.id;
    const pageSize = Math.min(Number(req.query.pageSize || 20), 100) | 0;
    const page = Math.max(Number(req.query.page || 1), 1) | 0;
    const offset = (page - 1) * pageSize;
    const status = String(req.query.status || "all"); // 'all' | 'success' | 'failed' | 'pending'

    const limitSQL = `LIMIT ${pageSize}`;
    const offsetSQL = `OFFSET ${offset}`;

    let sql, params;
    if (status === "all") {
      sql = `
        SELECT d.id, d.type, d.amount, d.qty, d.status, d.created_at, d.paid_at,
               c.id AS campaign_id, c.title AS campaign_title,
               COALESCE(c.cover_url, c.cover) AS campaign_cover
          FROM donations d
     LEFT JOIN campaigns c ON c.id = d.campaign_id
         WHERE d.user_id = ?
      ORDER BY d.created_at DESC
        ${limitSQL} ${offsetSQL}`;
      params = [uid];
    } else {
      sql = `
        SELECT d.id, d.type, d.amount, d.qty, d.status, d.created_at, d.paid_at,
               c.id AS campaign_id, c.title AS campaign_title,
               COALESCE(c.cover_url, c.cover) AS campaign_cover
          FROM donations d
     LEFT JOIN campaigns c ON c.id = d.campaign_id
         WHERE d.user_id = ? AND d.status = ?
      ORDER BY d.created_at DESC
        ${limitSQL} ${offsetSQL}`;
      params = [uid, status];
    }

    const rows = await dbAll(sql, params);

    res.json(
      rows.map((r) => ({
        id: r.id,
        unit: r.type === "money" ? "money" : "meal",
        amount: r.type === "money" ? Number(r.amount || 0) : Number(r.qty || 0),
        status: r.status,
        created_at: r.created_at,
        paid_at: r.paid_at,
        campaign: {
          id: r.campaign_id,
          title: r.campaign_title,
          cover: r.campaign_cover,
        },
      }))
    );
  } catch (e) {
    res
      .status(500)
      .json({
        error: "list_donations_failed",
        message: e?.message || "Internal error",
      });
  }
});

router.get("/recent-donations", requireUser, async (req, res) => {
  try {
    const uid = req.user.id;
    const limit = Math.min(Number(req.query.limit || 5), 50) | 0;
    const limitSQL = `LIMIT ${limit}`;

    const rows = await dbAll(
      `
      SELECT d.id, d.type, d.amount, d.qty, d.status, d.created_at, d.paid_at,
             c.id AS campaign_id, c.title AS campaign_title,
             COALESCE(c.cover_url, c.cover) AS campaign_cover
        FROM donations d
   LEFT JOIN campaigns c ON c.id = d.campaign_id
       WHERE d.user_id = ? AND d.status='success'
    ORDER BY d.created_at DESC
      ${limitSQL}`,
      [uid]
    );

    res.json(
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        amount: Number(r.amount || 0),
        qty: Number(r.qty || 0),
        status: r.status,
        created_at: r.created_at,
        paid_at: r.paid_at,
        campaign_id: r.campaign_id,
        campaign_title: r.campaign_title,
        campaign_cover: r.campaign_cover,
      }))
    );
  } catch (e) {
    res
      .status(500)
      .json({
        error: "recent_donations_failed",
        message: e?.message || "Internal error",
      });
  }
});

/* =========================================================
   4) Điểm giao nhận (pickup_points)
========================================================= */
router.get("/pickup-points", requireUser, async (_req, res) => {
  try {
    const items = await dbAll(
      `SELECT * FROM pickup_points WHERE status='active' ORDER BY created_at DESC`
    );
    res.json({ items, default_id: null });
  } catch (e) {
    res
      .status(500)
      .json({
        error: "pickup_points_failed",
        message: e?.message || "Internal error",
      });
  }
});

router.get("/pickup-points/mine", requireUser, async (_req, res) => {
  try {
    const rows = await dbAll(
      `SELECT id,name,address,lat,lng,opening,status,created_at,updated_at
         FROM pickup_points
        WHERE status='active'
        ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    res
      .status(500)
      .json({
        error: "pickup_points_mine_failed",
        message: e?.message || "Internal error",
      });
  }
});

/* =========================================================
   5) Support tickets (tasks + task_comments)
========================================================= */
router.get("/support/tickets", requireUser, async (req, res) => {
  try {
    const uid = req.user.id;
    const rows = await dbAll(
      `SELECT id, title, description, status, created_at
         FROM tasks
        WHERE type='SUPPORT' AND assignee_id=?
     ORDER BY created_at DESC`,
      [uid]
    );
    res.json(rows);
  } catch (e) {
    res
      .status(500)
      .json({
        error: "support_list_failed",
        message: e?.message || "Internal error",
      });
  }
});

router.post("/support/tickets", requireUser, async (req, res) => {
  try {
    const uid = req.user.id;
    const { title = "", description = "" } = req.body || {};

    await dbRun(
      `INSERT INTO tasks (parent_id, title, description, type, status, priority, assignee_id, sort_order, created_at)
       VALUES (NULL, ?, ?, 'SUPPORT', 'New', 'Normal', ?, 0, ${nowSQL})`,
      [title, description, uid]
    );
    const inserted = await dbGet(
      `SELECT * FROM tasks WHERE assignee_id=? ORDER BY created_at DESC LIMIT 1`,
      [uid]
    );
    res.json(inserted);
  } catch (e) {
    res
      .status(500)
      .json({
        error: "support_create_failed",
        message: e?.message || "Internal error",
      });
  }
});

router.get("/support/tickets/:id/comments", requireUser, async (req, res) => {
  try {
    const tid = Number(req.params.id);
    const rows = await dbAll(
      `SELECT id, task_id, author_id, content, created_at
         FROM task_comments
        WHERE task_id=?
     ORDER BY created_at ASC`,
      [tid]
    );
    res.json(rows);
  } catch (e) {
    res
      .status(500)
      .json({
        error: "support_comments_failed",
        message: e?.message || "Internal error",
      });
  }
});

router.post("/support/tickets/:id/comments", requireUser, async (req, res) => {
  try {
    const uid = req.user.id;
    const tid = Number(req.params.id);
    const { body = "" } = req.body || {};
    await dbRun(
      `INSERT INTO task_comments (task_id, author_id, content, created_at)
       VALUES (?,?,?, ${nowSQL})`,
      [tid, uid, String(body)]
    );
    const c = await dbGet(
      `SELECT * FROM task_comments WHERE task_id=? ORDER BY created_at DESC LIMIT 1`,
      [tid]
    );
    res.json(c);
  } catch (e) {
    res
      .status(500)
      .json({
        error: "support_comment_create_failed",
        message: e?.message || "Internal error",
      });
  }
});

/* =========================================================
   6) Default pickup & Request pickup (delivery flow)
========================================================= */
// FE calls this when user clicks "Đặt điểm lấy gần nhất"
router.patch("/default-pickup", requireUser, async (req, res) => {
  try {
    const uid = req.user.id;
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "missing_id" });

    await dbRun(`UPDATE addresses SET is_default=0 WHERE user_id=?`, [uid]);
    await dbRun(
      `UPDATE addresses SET is_default=1, updated_at=${nowSQL} WHERE id=? AND user_id=?`,
      [id, uid]
    );

    const def = await getDefaultAddress(uid);
    res.json({ ok: true, default_address: def });
  } catch (e) {
    res
      .status(500)
      .json({
        error: "set_default_pickup_failed",
        message: e?.message || "Internal error",
      });
  }
});

// Donor yêu cầu shipper đến lấy
router.post("/request-pickup", requireUser, async (req, res) => {
  try {
    const uid = req.user.id;
    let {
      title = "",
      qty = 1,
      pickup_address = "",
      lat = null,
      lng = null,
      note = "",
    } = req.body || {};

    title = String(title).trim();
    qty = Math.max(1, Number(qty || 1));

    // Fallback: nếu không có pickup_address => lấy default từ DB
    if (!pickup_address) {
      const def = await getDefaultAddress(uid);
      if (def?.line1) {
        pickup_address = def.line1;
        if (lat == null) lat = def.lat;
        if (lng == null) lng = def.lng;
      }
    }

    if (!title || !pickup_address) {
      return res.status(400).json({
        error: "missing_pickup_address",
        message:
          "Thiếu tên món hoặc địa chỉ lấy. Bật GPS, đặt địa chỉ mặc định, hoặc nhập tay.",
      });
    }

    const { v4: uuidv4 } = await import("uuid");

    // 1) Item tạm
    const itemId = uuidv4();
    await dbRun(
      `INSERT INTO food_items
       (id, owner_id, title, qty, unit, expire_at, location_addr, lat, lng, tags, images, status, visibility, created_at)
       VALUES (?, ?, ?, ?, 'suat', NULL, ?, ?, ?, ${EMPTY_JSON_ARRAY_SQL}, ${EMPTY_JSON_ARRAY_SQL}, 'available', 'public', ${nowSQL})`,
      [itemId, uid, title, qty, pickup_address, lat, lng]
    );

    // 2) Booking
    const bookingId = uuidv4();
    await dbRun(
      `INSERT INTO bookings
       (id, item_id, receiver_id, qty, note, method, dropoff_addr_id, dropoff_address, dropoff_name, dropoff_phone, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'delivery', NULL, ?, ?, ?, 'pending', ${nowSQL})`,
      [
        bookingId,
        itemId,
        uid,
        qty,
        note,
        pickup_address,
        req.user.name || "",
        req.user.phone || "",
      ]
    );

    // 3) Delivery
    const deliveryId = uuidv4();
    await dbRun(
      `INSERT INTO deliveries
       (id, booking_id, campaign_id, qty, status, proof_images, created_at, pickup_name, pickup_address, dropoff_name, dropoff_address, dropoff_phone, note)
       VALUES (?, ?, NULL, ?, 'pending', ${EMPTY_JSON_ARRAY_SQL}, ${nowSQL}, ?, ?, ?, ?, ?, ?)`,
      [
        deliveryId,
        bookingId,
        qty,
        req.user.name || "",
        pickup_address,
        req.user.name || "",
        pickup_address,
        req.user.phone || "",
        note,
      ]
    );

    res.json({ ok: true, booking_id: bookingId, delivery_id: deliveryId });
  } catch (e) {
    res
      .status(500)
      .json({
        error: "request_pickup_failed",
        message: e?.message || "Internal error",
      });
  }
});

export default router;
