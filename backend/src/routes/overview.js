// backend/src/routes/overview.js
import { Router } from "express";
import "dotenv/config";
import jwt from "jsonwebtoken";

const useMySQL = (process.env.DB_DRIVER || "sqlite") === "mysql";
let db;
if (useMySQL) {
  ({ db } = await import("../lib/db.js"));
} else {
  ({ db } = await import("../lib/db.js"));
}

const router = Router();

/* ------------------------------ utils ------------------------------ */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const toInt = (v, d = 0, min = -Infinity, max = Infinity) =>
  Number.isFinite(parseInt(v, 10)) ? clamp(parseInt(v, 10), min, max) : d;
const toFloat = (v, d = 0) =>
  Number.isFinite(parseFloat(v)) ? parseFloat(v) : d;
const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function parseJson(raw, fb = {}) {
  try {
    if (raw == null || raw === "") return fb;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return fb;
  }
}
function parseArrayMaybeCsv(val) {
  if (Array.isArray(val)) return val;
  if (val == null) return [];
  const s = String(val).trim();
  if (!s) return [];
  if (s.startsWith("[") || s.startsWith("{")) {
    try {
      const j = JSON.parse(s);
      return Array.isArray(j) ? j : [];
    } catch {
      return [];
    }
  }
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
function normalizeTags(meta, tagsRaw) {
  return meta && Array.isArray(meta.tags)
    ? meta.tags
    : parseArrayMaybeCsv(tagsRaw);
}
function sendError(res, status, code, message, details) {
  if (details)
    console.warn(`[${code}]`, details?.stack || details?.message || details);
  const payload = { ok: false, code, message };
  if (process.env.NODE_ENV !== "production" && details)
    payload.debug = String(details?.message || details);
  return res.status(status).json(payload);
}

function getAuthUserId(req) {
  try {
    const h = req.headers?.authorization || "";
    const m = h.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1];
    if (!token) return null;
    const sec =
      process.env.JWT_SECRET ||
      process.env.JWT_ACCESS_SECRET ||
      process.env.JWT ||
      "dev_secret";
    const decoded = jwt.verify(token, sec);
    return decoded?.id || decoded?.user_id || decoded?.uid || null;
  } catch {
    return null;
  }
}

/* ------------------------------ DB I/O ------------------------------ */
async function dbGet(sql, params = []) {
  try {
    if (useMySQL) {
      if (typeof db.get === "function") return await db.get(sql, params);
      if (typeof db.query === "function") {
        const [rows] = await db.query(sql, params);
        return rows?.[0] ?? null;
      }
      throw new Error("MySQL adapter missing .get/.query");
    }
    return db.prepare(sql).get(...params);
  } catch (e) {
    throw new Error(`dbGet failed: ${e?.message || e}`);
  }
}
async function dbAll(sql, params = []) {
  try {
    if (useMySQL) {
      if (typeof db.all === "function") return await db.all(sql, params);
      if (typeof db.query === "function") {
        const [rows] = await db.query(sql, params);
        return rows ?? [];
      }
      throw new Error("MySQL adapter missing .all/.query");
    }
    return db.prepare(sql).all(...params);
  } catch (e) {
    throw new Error(`dbAll failed: ${e?.message || e}`);
  }
}

/* ------------------------------ SQL exprs ------------------------------ */
const AGG = {
  raisedCol:
    "(SELECT COALESCE(SUM(CASE WHEN d.status='success' THEN d.amount ELSE 0 END),0) FROM donations d WHERE d.campaign_id=c.id)",
  supportersCol:
    "(SELECT SUM(d.status='success') FROM donations d WHERE d.campaign_id=c.id)",
  mealQtyCol:
    "(SELECT COALESCE(SUM(CASE WHEN d.status='success' AND d.qty>0 THEN d.qty ELSE 0 END),0) FROM donations d WHERE d.campaign_id=c.id)",
  raisedMoneyCol:
    "(SELECT COALESCE(SUM(CASE WHEN d.status='success' AND d.amount>0 THEN d.amount ELSE 0 END),0) FROM donations d WHERE d.campaign_id=c.id)",
  nowExpr: useMySQL ? "CURRENT_TIMESTAMP()" : "DATETIME('now')",
  todayExpr: useMySQL ? "CURRENT_DATE()" : "DATE('now')",
};

/* ------------------------------ settings ------------------------------ */
async function getSiteSetting(key) {
  // site_settings: k/v (mới) hoặc key/value (cũ)
  const row =
    (await dbGet(`SELECT v AS value FROM site_settings WHERE k=? LIMIT 1`, [
      key,
    ]).catch(() => null)) ||
    (await dbGet(`SELECT value FROM site_settings WHERE \`key\`=? LIMIT 1`, [
      key,
    ]).catch(() => null));
  if (!row) return null;
  const raw = row.value;
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
async function getDefaultMealPrice() {
  // Nếu chưa có meal_price_vnd thì dùng mặc định 10000
  const v = await getSiteSetting("meal_price_vnd");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 10000;
}

/* ------------------------------ cache ------------------------------ */
let OVERVIEW_CACHE = { data: null, at: 0 };
const OVERVIEW_TTL_MS = 60 * 1000;

/* ------------------------------ mappers ------------------------------ */
function mapCampaignRow(r, opts) {
  const meta = parseJson(r.meta, {});
  const goal = toNum(r.goal ?? r.target_amount, 0);

  // Ưu tiên số tổng hợp trực tiếp từ donations, sau đó tới cột đã recalc
  const raised = toNum(r.raised_calc ?? r.raised_plain ?? r.raised_amount, 0);
  const supporters = toNum(r.supporters_calc ?? r.supporters_plain, 0);

  const meal = meta && meta.meal ? meta.meal : {};
  const meal_unit = meal.unit || "phần";
  const meal_target_qty = toNum(meal.target_qty, 0);
  const meal_price = toNum(r.meal_price, opts?.defaultMealPrice ?? 10000);

  const type = (r.type || meta?.type || "money").toLowerCase();

  const meal_qty_from_donations = toNum(r.meal_qty_calc, 0);
  const raised_money_only = toNum(r.raised_money_calc, 0);
  const money_to_meal =
    meal_price > 0 ? Math.floor(raised_money_only / meal_price) : 0;
  const from_donations_total = meal_qty_from_donations + money_to_meal;

  const meta_received = toNum(meal.received_qty, 0);
  const col_received = toNum(r.meal_received_qty, 0);
  const meal_received_qty_final = Math.max(
    col_received,
    meta_received,
    from_donations_total
  );

  const impact_meals =
    meal_price > 0 ? Math.floor((raised || 0) / meal_price) : 0;

  return {
    id: r.id,
    type,
    title: r.title || "",
    description: r.description || "",
    location: r.location || "",
    cover: r.cover || r.cover_url || "",
    deadline: r.deadline || meta?.end_at || null,
    goal,
    raised,
    supporters,
    impact_meals,
    meal_unit,
    meal_target_qty,
    meal_received_qty: meal_received_qty_final,
    meal_price,
    delivered_meals: toNum(r.delivered_meals, 0),
    tags: normalizeTags(meta, r.tags),
    updated_at: r.updated_at || null,
    created_at: r.created_at || null,
    meta,
  };
}

/* ------------------------------ helpers: counts by roles ------------- */
async function countRole(roleName) {
  // Ưu tiên user_roles; nếu không có bảng thì rơi về users.role
  const viaUserRoles = await dbGet(
    `SELECT COUNT(DISTINCT user_id) AS c FROM user_roles WHERE role=?`,
    [roleName]
  ).catch(() => null);
  if (viaUserRoles) return toNum(viaUserRoles.c, 0);

  const viaUsers = await dbGet(`SELECT COUNT(*) AS c FROM users WHERE role=?`, [
    roleName,
  ]).catch(() => ({ c: 0 }));
  return toNum(viaUsers.c, 0);
}

/* ------------------------------ overview payload ------------------------------ */
async function buildOverviewPayload() {
  // totals
  const [users, campaigns, active] = await Promise.all([
    dbGet(`SELECT COUNT(*) AS c FROM users`).catch(() => ({ c: 0 })),
    dbGet(`SELECT COUNT(*) AS c FROM campaigns`).catch(() => ({ c: 0 })),
    dbGet(
      useMySQL
        ? `SELECT COUNT(*) AS c FROM campaigns
             WHERE (status='active')
               AND (deadline IS NULL OR deadline>=${AGG.todayExpr})`
        : `SELECT COUNT(*) AS c FROM campaigns
             WHERE (status='active')
               AND (deadline IS NULL OR DATE(deadline)>=${AGG.todayExpr})`
    ).catch(() => ({ c: 0 })),
  ]);

  // Donor/Receiver theo user_roles (fallback users.role)
  const [donorsCount, recipientsCount] = await Promise.all([
    countRole("donor"),
    countRole("receiver"),
  ]);

  // Tổng tiền ủng hộ thành công
  const raisedRow = await dbGet(
    `SELECT COALESCE(SUM(amount),0) AS v
       FROM donations
      WHERE status='success'`
  ).catch(() => ({ v: 0 }));
  const totalRaised = toNum(raisedRow?.v, 0);

  // Tổng goal của các campaign (để làm global_goal cho FE)
  const goalRow = await dbGet(
    `SELECT COALESCE(SUM(goal),0) AS g FROM campaigns`
  ).catch(() => ({ g: 0 }));
  const totalGoal = toNum(goalRow?.g, 0);

  // Lượt ủng hộ thành công
  const supportersRow = await dbGet(
    `SELECT SUM(status='success') AS v FROM donations`
  ).catch(() => ({ v: 0 }));
  const supporters = toNum(supportersRow?.v, 0);

  const defaultMealPrice = await getDefaultMealPrice();
  const meals_from_money =
    defaultMealPrice > 0 ? Math.floor(totalRaised / defaultMealPrice) : 0;

  // Hiện vật (qty) từ donations
  const foodQtyRow = await dbGet(
    `SELECT COALESCE(SUM(CASE WHEN qty>0 AND status='success' THEN qty ELSE 0 END),0) AS q
       FROM donations`
  ).catch(() => ({ q: 0 }));
  const meals_from_food = toNum(foodQtyRow?.q, 0);

  // Tổng từ cột campaigns.meal_received_qty (đã recalc nếu có trigger)
  const mealReceivedRow = await dbGet(
    `SELECT COALESCE(SUM(meal_received_qty),0) AS q FROM campaigns`
  ).catch(() => ({ q: 0 }));
  const sum_meal_received_qty = toNum(mealReceivedRow?.q, 0);

  // 🔹 SỐ BỮA ĐÃ TRAO — dùng cột campaigns.delivered_meals (trigger cập nhật)
  const deliveredMealsRow = await dbGet(
    `SELECT COALESCE(SUM(delivered_meals),0) AS q FROM campaigns`
  ).catch(() => ({ q: 0 }));
  const meals_delivered = toNum(deliveredMealsRow?.q, 0);

  // Tránh đếm trùng: lấy max giữa (tiền+hiện vật) và cột aggregate đã recalc
  const addCampaignMeals =
    String(process.env.ADD_CAMPAIGN_MEALS || "").toLowerCase() === "true";
  let meals_given = Math.max(
    meals_from_money + meals_from_food,
    sum_meal_received_qty
  );
  let extra_meals = 0;
  if (addCampaignMeals) {
    meals_given = meals_from_money + meals_from_food + sum_meal_received_qty;
    extra_meals = sum_meal_received_qty;
  } else {
    extra_meals = Math.max(
      0,
      sum_meal_received_qty - (meals_from_money + meals_from_food)
    );
  }

  return {
    ok: true,
    users: toNum(users?.c, 0),
    donors: donorsCount,
    recipients: recipientsCount,
    campaigns: toNum(campaigns?.c, 0),
    active_campaigns: toNum(active?.c, 0),

    // Mới: phục vụ FE Overview.jsx
    global_goal: totalGoal, // FE: stats?.global_goal
    global_raised: totalRaised, // FE: stats?.global_raised
    unit: "bữa", // FE: stats?.unit

    raised: totalRaised, // giữ nguyên để tương thích cũ
    supporters,

    meal_price_vnd: defaultMealPrice,
    meals_given,
    meals_from_money,
    meals_from_food,
    sum_meal_received_qty,
    extra_meals,

    // 🔹 Field mới cho FE Overview.jsx
    meals_delivered, // <= Bữa đã trao

    updated_at: new Date().toISOString(),
  };
}

/* ------------------------------ routes: overview ------------------------------ */
router.get("/overview", async (_req, res) => {
  try {
    if (OVERVIEW_CACHE.data && Date.now() - OVERVIEW_CACHE.at < OVERVIEW_TTL_MS)
      return res.json(OVERVIEW_CACHE.data);
    const payload = await buildOverviewPayload();
    OVERVIEW_CACHE = { data: payload, at: Date.now() };
    return res.json(payload);
  } catch (err) {
    return sendError(
      res,
      500,
      "overview_failed",
      "Không lấy được số liệu tổng quan.",
      err
    );
  }
});

// Alias: /api → /overview
router.get("/", async (_req, res) => {
  try {
    if (OVERVIEW_CACHE.data && Date.now() - OVERVIEW_CACHE.at < OVERVIEW_TTL_MS)
      return res.json(OVERVIEW_CACHE.data);
    const payload = await buildOverviewPayload();
    OVERVIEW_CACHE = { data: payload, at: Date.now() };
    return res.json(payload);
  } catch (err) {
    return sendError(
      res,
      500,
      "overview_failed",
      "Không lấy được số liệu tổng quan.",
      err
    );
  }
});

/* ------------------------------ routes: announcements ---------------- */
router.get("/announcements", async (req, res) => {
  try {
    const active = toInt(req.query.active, NaN);
    const limit = toInt(req.query.limit, 20, 1, 100);
    const order =
      String(req.query.order || "desc").toLowerCase() === "asc"
        ? "ASC"
        : "DESC";
    const where = Number.isFinite(active)
      ? `WHERE active=${active ? 1 : 0}`
      : "";
    const rows = await dbAll(
      `SELECT id, title, content, level, active, created_at, updated_at
         FROM announcements
         ${where}
         ORDER BY created_at ${order}
         LIMIT ?`,
      [limit]
    );
    return res.json({ ok: true, items: rows, total: rows.length });
  } catch (err) {
    return sendError(
      res,
      500,
      "announcements_failed",
      "Không lấy được thông báo.",
      err
    );
  }
});

/* ------------------------------ routes: campaigns -------------------- */
router.get("/campaigns", async (req, res) => {
  try {
    const wantFeatured = String(req.query.featured || "") === "1";
    const page = toInt(req.query.page, 1, 1, 1e6);
    const pageSize = toInt(req.query.pageSize, wantFeatured ? 6 : 8, 1, 50);
    const offset = (page - 1) * pageSize;

    const baseSelect = `
      SELECT
        c.id, c.type, c.title, c.description, c.location,
        c.goal, c.cover, c.cover_url, c.tags, c.meta, c.deadline,
        c.meal_price, c.meal_received_qty, c.delivered_meals,
        c.created_at, c.updated_at,
        ${AGG.raisedCol}       AS raised_calc,
        ${AGG.supportersCol}   AS supporters_calc,
        ${AGG.mealQtyCol}      AS meal_qty_calc,
        ${AGG.raisedMoneyCol}  AS raised_money_calc,
        c.raised AS raised_plain,
        c.supporters AS supporters_plain
      FROM campaigns c
      WHERE 1
    `;

    const orderSQL = wantFeatured
      ? `ORDER BY COALESCE(c.supporters, ${AGG.supportersCol}) DESC,
                 COALESCE(c.raised, ${AGG.raisedCol}) DESC,
                 c.created_at DESC`
      : `ORDER BY c.created_at DESC`;

    const listSQL = `${baseSelect} ${orderSQL} LIMIT ? OFFSET ?`;
    const countSQL = `SELECT COUNT(*) AS total FROM campaigns`;

    const [rows, totalRow, defaultMealPrice] = await Promise.all([
      dbAll(listSQL, [pageSize, offset]),
      dbGet(countSQL),
      getDefaultMealPrice(),
    ]);

    const items = rows.map((r) => mapCampaignRow(r, { defaultMealPrice }));

    return res.json({
      ok: true,
      items,
      total: toNum(totalRow?.total, 0),
      page,
      pageSize,
    });
  } catch (err) {
    return sendError(
      res,
      500,
      "campaigns_failed",
      "Không lấy được danh sách chiến dịch.",
      err
    );
  }
});

/* ------------------------------ routes: leaderboard ------------------ */
// /api/leaderboard?type=donors&limit=5
router.get("/leaderboard", async (req, res) => {
  try {
    const limit = toInt(req.query.limit, 5, 1, 100);
    const type = String(req.query.type || "donors").toLowerCase();

    if (type === "donors") {
      const rows = await dbAll(
        `SELECT COALESCE(u.name, d.donor_name, 'Ẩn danh') AS name,
                SUM(CASE WHEN d.status='success' THEN COALESCE(d.amount,0) ELSE 0 END) AS total
           FROM donations d
      LEFT JOIN users u ON u.id = d.user_id
          WHERE d.status='success'
          GROUP BY COALESCE(u.name, d.donor_name, 'Ẩn danh')
          ORDER BY total DESC
          LIMIT ?`,
        [limit]
      );
      return res.json({
        ok: true,
        items: rows.map((r) => ({ name: r.name, total: Number(r.total) || 0 })),
      });
    }

    return res.json({ ok: true, items: [] });
  } catch (err) {
    return sendError(
      res,
      500,
      "leaderboard_failed",
      "Không lấy được leaderboard.",
      err
    );
  }
});

/* ------------------------------ routes: donations (UPDATED) ---------- */
/**
 * Hỗ trợ:
 *  - limit
 *  - mine=1  (lấy donation của chính user theo JWT)
 *  - type=meal|money|any (lọc theo kiểu quyên góp)
 *  - order=desc|asc (mặc định desc theo created_at)
 *
 * FE Overview.jsx dùng:
 *   - /api/donations?limit=8  (activity list)
 *   - /api/donations?mine=1&type=meal&limit=200  (đếm bữa của tôi)
 */
router.get("/donations", async (req, res) => {
  try {
    const limit = toInt(req.query.limit, 8, 1, 500);
    const mine = String(req.query.mine || "") === "1";
    const type = String(req.query.type || "any").toLowerCase(); // meal|money|any
    const order =
      String(req.query.order || "desc").toLowerCase() === "asc"
        ? "ASC"
        : "DESC";

    let uid = null;
    if (mine) {
      uid = getAuthUserId(req);
      if (!uid) {
        // Không có token → không thể xác định "mine"
        return res.json({ ok: true, items: [], total: 0 });
      }
    }

    // Xây where điều kiện
    const where = [];
    const params = [];

    where.push(`d.status='success'`);

    if (mine) {
      where.push(`d.user_id = ?`);
      params.push(uid);
    }

    if (type === "meal") {
      // donation hiện vật: qty > 0 hoặc (amount=0 và qty >= 1)
      where.push(
        `(COALESCE(d.qty,0) > 0 OR (COALESCE(d.amount,0)=0 AND COALESCE(d.qty,0) >= 1))`
      );
    } else if (type === "money") {
      where.push(`COALESCE(d.amount,0) > 0`);
    } // else any → không thêm điều kiện

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT d.id, d.amount, d.qty, d.status, d.created_at, d.donor_name, d.type,
             d.campaign_id, d.user_id
        , COALESCE(u.name, d.donor_name, 'Ẩn danh') AS donor_name
      FROM donations d
      LEFT JOIN users u ON u.id = d.user_id
      ${whereSQL}
      ORDER BY d.created_at ${order}
      LIMIT ?
    `;
    const rows = await dbAll(sql, [...params, limit]);

    const items = rows.map((r) => ({
      id: r.id,
      amount: Number(r.amount) || 0,
      qty: Number(r.qty) || 0,
      unit: "phần", // nếu bạn có cột d.unit thì có thể thay thành r.unit ?? 'phần'
      type:
        r.type ||
        (Number(r.qty) > 0 && (!r.amount || Number(r.amount) === 0)
          ? "food"
          : "money"),
      status: r.status || "success",
      created_at: r.created_at,
      donor: { name: r.donor_name || "Ẩn danh" },
      campaign_id: r.campaign_id,
      user_id: r.user_id,
    }));

    return res.json({ ok: true, items, total: items.length });
  } catch (err) {
    return sendError(
      res,
      500,
      "donations_failed",
      "Không lấy được danh sách quyên góp.",
      err
    );
  }
});

// Alias tiện dụng: /api/donations/me → mine=1
router.get("/donations/me", async (req, res) => {
  req.query.mine = "1";
  return router.handle(req, res, () => {});
});

/* ------------------------------ routes: transactions ----------------- */
// Nếu không có bảng transactions, suy từ donations (DN000123)
router.get("/transactions", async (req, res) => {
  try {
    const limit = toInt(req.query.limit, 6, 1, 50);

    let rows = [];
    try {
      rows = await dbAll(
        `SELECT id, code, amount, status, created_at
           FROM transactions
          ORDER BY created_at DESC
          LIMIT ?`,
        [limit]
      );
    } catch {
      if (useMySQL) {
        rows = await dbAll(
          `SELECT id,
                  CONCAT('DN', LPAD(id,6,'0')) AS code,
                  amount,
                  CASE WHEN status='success' THEN 'paid'
                       WHEN status='failed'  THEN 'failed'
                       ELSE 'pending' END     AS status,
                  created_at
             FROM donations
            WHERE status IS NOT NULL
            ORDER BY created_at DESC
            LIMIT ?`,
          [limit]
        );
      } else {
        rows = await dbAll(
          `SELECT id,
                  'DN' || printf('%06d', id) AS code,
                  amount,
                  CASE WHEN status='success' THEN 'paid'
                       WHEN status='failed'  THEN 'failed'
                       ELSE 'pending' END     AS status,
                  created_at
             FROM donations
            WHERE status IS NOT NULL
            ORDER BY created_at DESC
            LIMIT ?`,
          [limit]
        );
      }
    }

    const items = rows.map((r) => ({
      id: r.id,
      code: r.code || null,
      amount: Number(r.amount) || 0,
      status: r.status || "pending",
      created_at: r.created_at,
    }));
    return res.json({ ok: true, items, total: items.length });
  } catch (err) {
    return sendError(
      res,
      500,
      "transactions_failed",
      "Không lấy được danh sách giao dịch.",
      err
    );
  }
});

/* ------------------------------ routes: foods (latest) --------------- */
router.get("/foods", async (req, res) => {
  try {
    const limit = toInt(req.query.limit, 6, 1, 50);
    const rows = await dbAll(
      useMySQL
        ? `SELECT id, title, description, images, qty, unit, tags, expire_at,
                  lat, lng,
                  location_addr, updated_at
             FROM food_items
            WHERE (expire_at IS NULL OR expire_at >= ${AGG.nowExpr})
              AND COALESCE(qty,0) > 0
            ORDER BY updated_at DESC
            LIMIT ?`
        : `SELECT id, title, description, images, qty, unit, tags, expire_at,
                  lat, lng,
                  location_addr, updated_at
             FROM food_items
            WHERE (expire_at IS NULL OR DATETIME(expire_at) >= ${AGG.nowExpr})
              AND COALESCE(qty,0) > 0
            ORDER BY updated_at DESC
            LIMIT ?`,
      [limit]
    );
    const items = rows.map((it) => ({
      ...it,
      tags: parseArrayMaybeCsv(it.tags),
      images: parseArrayMaybeCsv(it.images),
    }));
    return res.json({ ok: true, items, total: items.length });
  } catch (err) {
    return sendError(
      res,
      500,
      "foods_failed",
      "Không lấy được danh sách thực phẩm.",
      err
    );
  }
});

/* ------------------------------ reco: foods (smart) ------------------ */
function toRad(x) {
  return (x * Math.PI) / 180;
}
function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad((b.lat ?? 0) - (a.lat ?? 0));
  const dLng = toRad((b.lng ?? 0) - (a.lng ?? 0));
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat ?? 0)) *
      Math.cos(toRad(b.lat ?? 0)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

router.get("/reco/foods", async (req, res) => {
  try {
    const lat = toFloat(req.query.lat, NaN);
    const lng = toFloat(req.query.lng, NaN);
    const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);
    const maxKm = toInt(req.query.maxKm, 5, 1, 50);
    const diet = String(req.query.diet || "any").toLowerCase();
    const sort = String(req.query.sort || "priority").toLowerCase();
    const limit = toInt(req.query.limit, 9, 1, 24);

    const rows = await dbAll(
      useMySQL
        ? `SELECT id, title, description, images, qty, unit, tags, expire_at,
                  lat, lng,
                  location_addr, updated_at
             FROM food_items
            WHERE (expire_at IS NULL OR expire_at >= ${AGG.nowExpr})
              AND COALESCE(qty,0) > 0
            ORDER BY updated_at DESC
            LIMIT 400`
        : `SELECT id, title, description, images, qty, unit, tags, expire_at,
                  lat, lng,
                  location_addr, updated_at
             FROM food_items
            WHERE (expire_at IS NULL OR DATETIME(expire_at) >= ${AGG.nowExpr})
              AND COALESCE(qty,0) > 0
            ORDER BY updated_at DESC
            LIMIT 400`
    );

    const items = rows.map((it) => {
      const tags = parseArrayMaybeCsv(it.tags).map((t) => String(t));
      const images = parseArrayMaybeCsv(it.images);
      let distance_km = null;
      if (hasCenter && Number.isFinite(it.lat) && Number.isFinite(it.lng)) {
        distance_km = haversineKm(
          { lat, lng },
          { lat: Number(it.lat), lng: Number(it.lng) }
        );
      }
      return {
        ...it,
        tags,
        images,
        distance_km: Number.isFinite(distance_km) ? distance_km : null,
      };
    });

    let filtered = items;
    if (hasCenter)
      filtered = filtered.filter(
        (it) => it.distance_km == null || it.distance_km <= maxKm
      );

    if (diet !== "any" && diet !== "none") {
      filtered = filtered.filter((it) => {
        const t = (it.tags || []).map((x) => String(x).toLowerCase());
        if (diet === "chay")
          return (
            t.includes("chay") ||
            t.includes("vegetarian") ||
            t.includes("vegan")
          );
        if (diet === "halal") return t.includes("halal");
        if (diet === "kythit")
          return !t.includes("thit") && !t.includes("meat");
        return true;
      });
    }

    const now = Date.now();
    const scored = filtered.map((it) => {
      let expiryScore = 0;
      if (it.expire_at) {
        const diffH = (new Date(it.expire_at).getTime() - now) / 3600000;
        expiryScore = diffH <= 0 ? 1 : 1 / Math.log10(2 + diffH);
      }
      const distanceScore = hasCenter
        ? Number.isFinite(it.distance_km)
          ? 1 / (1 + it.distance_km)
          : 0.6
        : 0.6;
      const tagsLc = (it.tags || []).map((t) => String(t).toLowerCase());
      const dietMatch =
        (diet === "chay" &&
          (tagsLc.includes("chay") ||
            tagsLc.includes("vegetarian") ||
            tagsLc.includes("vegan"))) ||
        (diet === "halal" && tagsLc.includes("halal")) ||
        (diet === "kythit" &&
          !tagsLc.includes("thit") &&
          !tagsLc.includes("meat"));
      const priority =
        0.45 * distanceScore + 0.4 * expiryScore + 0.15 * (dietMatch ? 1 : 0);
      return { ...it, diet_match: !!dietMatch, reco_score: priority };
    });

    if (sort === "expiresoon" || sort === "expiry") {
      scored.sort((a, b) => {
        const ta = a.expire_at ? new Date(a.expire_at).getTime() : Infinity;
        const tb = b.expire_at ? new Date(b.expire_at).getTime() : Infinity;
        return ta - tb;
      });
    } else if (sort === "dietmatch") {
      scored.sort((a, b) => Number(b.diet_match) - Number(a.diet_match));
    } else if (sort === "distance" && hasCenter) {
      scored.sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9));
    } else {
      scored.sort((a, b) => (b.reco_score || 0) - (a.reco_score || 0));
    }

    return res.json(scored.slice(0, limit));
  } catch (err) {
    return sendError(
      res,
      500,
      "reco_foods_failed",
      "Không lấy được gợi ý món ăn.",
      err
    );
  }
});

/* ------------------------------ reco: pickup ------------------------ */
router.get("/reco/pickup", async (req, res) => {
  try {
    const lat = toFloat(req.query.lat, NaN);
    const lng = toFloat(req.query.lng, NaN);

    // Ở dump chưa thấy bảng pickup_points tiêu chuẩn; để tránh lỗi, trả danh sách trống có sẵn khung giờ
    const windows = [
      "11:30–12:30",
      "12:30–13:30",
      "17:30–18:30",
      "18:30–19:30",
    ];
    return res.json({ ok: true, windows, hubs: [] });
  } catch (err) {
    return sendError(
      res,
      500,
      "reco_pickup_failed",
      "Không lấy được gợi ý khung giờ/điểm hẹn.",
      err
    );
  }
});

/* ------------------------------ deliveries: recent (NEW) ------------ */
router.get("/deliveries/recent", async (req, res) => {
  try {
    const limit = toInt(req.query.limit, 6, 1, 50);
    const rows = await dbAll(
      `SELECT d.id, d.qty, d.status, d.created_at, d.updated_at,
              d.campaign_id, d.booking_id
         FROM deliveries d
        WHERE d.status='delivered'
        ORDER BY d.updated_at DESC, d.created_at DESC
        LIMIT ?`,
      [limit]
    );
    return res.json({ ok: true, items: rows, total: rows.length });
  } catch (err) {
    return sendError(
      res,
      500,
      "recent_deliveries_failed",
      "Không lấy được danh sách giao thành công.",
      err
    );
  }
});

export default router;
