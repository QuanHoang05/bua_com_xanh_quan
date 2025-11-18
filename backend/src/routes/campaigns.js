// backend/src/routes/campaigns.js
// Public routes for FE — aggregate safely, cross-DB (MariaDB/SQLite)
// - No placeholders in LIMIT/OFFSET to avoid "near ?"
// - No double-count: money/qty from donations(success) -> meals; delivered_meals kept by triggers
// - Pledges overlay (in-kind chưa nhận)
// - Recalc endpoint (uses proc on MySQL; derived on SQLite)

import { Router } from "express";
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
    const [r] = await db.query(sql, params);
    return r;
  }
  return db.prepare(sql).run(...params);
}

/* ---------------- Utils ---------------- */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const MEAL_PRICE_VND = toNum(process.env.MEAL_PRICE_VND, 10000);
function parseJson(raw, fallback = {}) {
  try {
    return raw == null || raw === ""
      ? fallback
      : typeof raw === "string"
      ? JSON.parse(raw)
      : raw;
  } catch {
    return fallback;
  }
}
function normalizeTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
const monthExpr = useMySQL
  ? "DATE_FORMAT(COALESCE(paid_at,created_at),'%Y-%m')"
  : "strftime('%Y-%m', COALESCE(paid_at,created_at))";

/* ---------------- Aggregation columns (subqueries) ---------------- */
const AGG = {
  raisedMoney:
    "(SELECT COALESCE(SUM(CASE WHEN d.status='success' AND d.amount>0 THEN d.amount ELSE 0 END),0) FROM donations d WHERE d.campaign_id=c.id)",
  supporters:
    "(SELECT COUNT(*) FROM donations d WHERE d.campaign_id=c.id AND d.status='success')",
  mealQty:
    "(SELECT COALESCE(SUM(CASE WHEN d.status='success' AND d.qty>0 THEN d.qty ELSE 0 END),0) FROM donations d WHERE d.campaign_id=c.id)",
  pledgedQty:
    "(SELECT COALESCE(SUM(CASE WHEN d.status IN ('pledged','scheduled') AND d.qty>0 THEN d.qty ELSE 0 END),0) FROM donations d WHERE d.campaign_id=c.id)",
};

/* ---------------- Calculations ---------------- */
function computeMealsFrom(money, qty, price) {
  const p = Math.max(1, toNum(price, MEAL_PRICE_VND));
  return Math.floor(toNum(money, 0) / p) + toNum(qty, 0);
}

/* ---------------- Row → API object (no double count) ---------------- */
function mapCampaignRow(r) {
  const meta = parseJson(r.meta, {});
  const type = (r.type || meta?.type || "money").toLowerCase();
  const cover_url = r.cover_url || r.cover || "";

  const raised_money_calc = toNum(r.raised_money_calc, 0);
  const supporters_calc = toNum(r.supporters_calc, 0);
  const meal_qty_calc = toNum(r.meal_qty_calc, 0);
  const meal_pledged_calc = toNum(r.meal_pledged_qty_calc, 0);

  const configured_price = toNum(
    r.meal_price ?? meta?.meal?.price,
    MEAL_PRICE_VND
  );
  const derived_meals = computeMealsFrom(
    raised_money_calc,
    meal_qty_calc,
    configured_price
  );

  // prefer cached columns when present; fall back to calculated
  const raised_amount = toNum(
    r.raised_amount ?? r.raised ?? r.raised_money_calc,
    0
  );
  const supporters = toNum(r.supporters, 0) || supporters_calc;

  // received meals: if column exists and >0 (MySQL dump có), dùng; SQLite tính động
  const meal_received_qty = useMySQL
    ? toNum(r.meal_received_qty, 0) || derived_meals
    : derived_meals;

  return {
    id: r.id,
    title: r.title,
    description: r.description,
    location: r.location,
    status: r.status,
    type,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deadline: r.deadline,
    cover_url,
    tags: normalizeTags(r.tags),
    meta,

    // money
    target_amount: toNum(r.target_amount ?? r.goal, 0),
    raised_amount,
    supporters,

    // meals
    meal_price: configured_price,
    meal_unit: meta?.meal?.unit || "phần",
    meal_target_qty: toNum(meta?.meal?.target_qty, 0),
    meal_received_qty,
    meal_pledged_qty: meal_pledged_calc,

    // delivered counter (DB triggers maintain this)
    delivered_meals: toNum(r.delivered_meals, 0) || 0,

    // misc
    payment_method: (meta?.payment?.method || "").toLowerCase() || null,
  };
}

/* ======================= GET /api/campaigns ======================= */
router.get("/", async (req, res) => {
  try {
    // Validate input
    const allowedStatus = ["active", "closed", "all"];
    const status = String(req.query.status || "active").toLowerCase();
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ ok: false, message: "Invalid status" });
    }

    const sort = String(req.query.sort || "latest").toLowerCase();
    const allowedSort = ["latest", "progress", "goal", "endSoon"];
    if (!allowedSort.includes(sort)) {
      return res.status(400).json({ ok: false, message: "Invalid sort" });
    }

    const page = clamp(parseInt(req.query.page) || 1, 1, 1e9);
    const pageSize = clamp(parseInt(req.query.pageSize) || 24, 1, 1000);
    if (isNaN(page) || isNaN(pageSize)) {
      return res.status(400).json({ ok: false, message: "Invalid pagination" });
    }

    const q = String(req.query.q || "").trim();
    const typeF = String(req.query.type || "").toLowerCase();
    const offset = (page - 1) * pageSize;

    const where = [];
    const p = [];
    if (q.length > 200) {
      return res.status(400).json({ ok: false, message: "Query too long" });
    }
    if (q) {
      where.push(
        "(c.title LIKE ? OR c.description LIKE ? OR c.location LIKE ?)"
      );
      p.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status !== "all") {
      where.push("c.status=?");
      p.push(status);
    }
    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    let orderSQL = "c.created_at DESC";
    if (sort === "progress") {
      orderSQL =
        "CASE WHEN c.goal>0 THEN ((raised_money_calc*1.0)/c.goal) ELSE 0 END DESC, c.created_at DESC";
    } else if (sort === "goal") {
      orderSQL = "c.goal DESC, c.created_at DESC";
    } else if (sort === "endSoon") {
      orderSQL =
        "CASE WHEN c.deadline IS NULL THEN 1 ELSE 0 END ASC, c.deadline ASC, c.created_at DESC";
    }

    // inline LIMIT/OFFSET to avoid placeholder issue
    const listSQL = `
      SELECT
        c.id, c.title, c.description, c.location, c.goal, c.type,
        c.cover, c.cover_url, c.tags, c.meta, c.status, c.created_at, c.updated_at, c.deadline,
        c.target_amount, c.raised_amount, c.supporters, c.meal_price, c.meal_received_qty, c.delivered_meals,
        COALESCE(d_agg.raised_money_calc, 0) AS raised_money_calc,
        COALESCE(d_agg.supporters_calc, 0) AS supporters_calc,
        COALESCE(d_agg.meal_qty_calc, 0) AS meal_qty_calc,
        COALESCE(d_agg.meal_pledged_qty_calc, 0) AS meal_pledged_qty_calc
      FROM campaigns c
      LEFT JOIN (
        SELECT
          campaign_id,
          SUM(CASE WHEN status='success' AND amount>0 THEN amount ELSE 0 END) AS raised_money_calc,
          COUNT(CASE WHEN status='success' THEN 1 END) AS supporters_calc,
          SUM(CASE WHEN status='success' AND qty>0 THEN qty ELSE 0 END) AS meal_qty_calc,
          SUM(CASE WHEN status IN ('pledged','scheduled') AND qty>0 THEN qty ELSE 0 END) AS meal_pledged_qty_calc
        FROM donations
        GROUP BY campaign_id
      ) d_agg ON c.id = d_agg.campaign_id
      ${whereSQL}
      ORDER BY ${orderSQL}
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    let totalRow, rows;
    try {
      totalRow = await dbGet(
        `SELECT COUNT(*) AS total FROM campaigns c ${whereSQL}`,
        p
      );
      rows = await dbAll(listSQL, p);
    } catch (err) {
      return res.status(400).json({ ok: false, message: "Invalid query" });
    }

    let items = rows.map(mapCampaignRow);
    if (typeF) items = items.filter((it) => (it.type || "money") === typeF);

    res.json({
      ok: true,
      items,
      total: toNum(totalRow?.total, 0),
      page,
      pageSize,
    });
  } catch (e) {
    res.status(400).json({ ok: false, message: "Invalid request" });
  }
});

/* ======================= GET /api/campaigns/stats ======================= */
router.get("/stats", async (_req, res) => {
  try {
    const topline = await dbGet(`
      SELECT
        (SELECT COUNT(*) FROM campaigns) AS campaigns,
        (SELECT COALESCE(SUM(amount),0) FROM donations WHERE status='success' AND amount>0) AS raised,
        (SELECT COUNT(*) FROM donations WHERE status='success') AS supporters,
        (SELECT COUNT(*) FROM campaigns WHERE status='active') AS active
    `);

    const rows = await dbAll(`
      SELECT c.id, c.meta, c.meal_price, c.meal_received_qty,
             ${AGG.mealQty}     AS meal_qty_calc,
             ${AGG.raisedMoney} AS raised_money_calc,
             ${AGG.pledgedQty}  AS meal_pledged_qty_calc
      FROM campaigns c
    `);

    let meals_received_total = 0;
    let meals_pledged_total = 0;

    for (const r of rows) {
      const price = toNum(
        r.meal_price ?? parseJson(r.meta, {})?.meal?.price,
        MEAL_PRICE_VND
      );
      const derived = computeMealsFrom(
        r.raised_money_calc,
        r.meal_qty_calc,
        price
      );
      const received = useMySQL
        ? toNum(r.meal_received_qty, 0) || derived
        : derived;
      meals_received_total += received;
      meals_pledged_total += toNum(r.meal_pledged_qty_calc, 0);
    }

    res.json({
      ok: true,
      campaigns: toNum(topline?.campaigns, 0),
      raised: toNum(topline?.raised, 0),
      supporters: toNum(topline?.supporters, 0),
      active: toNum(topline?.active, 0),
      meals: meals_received_total,
      meals_received: meals_received_total,
      meals_pledged: meals_pledged_total,
    });
  } catch (e) {
    console.error("[GET /campaigns/stats] ", e);
    res.status(500).json({ ok: false, message: "Không lấy được thống kê" });
  }
});

/* ======================= GET /api/campaigns/:id ======================= */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const row = await dbGet(
      `
      SELECT
        c.id, c.title, c.description, c.location, c.goal, c.type,
        c.cover, c.cover_url, c.tags, c.meta, c.status, c.created_at, c.updated_at, c.deadline,
        c.target_amount, c.raised_amount, c.supporters, c.meal_price, c.meal_received_qty, c.delivered_meals,
        COALESCE(d_agg.raised_money_calc, 0) AS raised_money_calc,
        COALESCE(d_agg.supporters_calc, 0) AS supporters_calc,
        COALESCE(d_agg.meal_qty_calc, 0) AS meal_qty_calc,
        COALESCE(d_agg.meal_pledged_qty_calc, 0) AS meal_pledged_qty_calc
      FROM campaigns c
      LEFT JOIN (
        SELECT
          campaign_id,
          SUM(CASE WHEN status='success' AND amount>0 THEN amount ELSE 0 END) AS raised_money_calc,
          COUNT(CASE WHEN status='success' THEN 1 END) AS supporters_calc,
          SUM(CASE WHEN status='success' AND qty>0 THEN qty ELSE 0 END) AS meal_qty_calc,
          SUM(CASE WHEN status IN ('pledged','scheduled') AND qty>0 THEN qty ELSE 0 END) AS meal_pledged_qty_calc
        FROM donations GROUP BY campaign_id
      ) d_agg ON c.id = d_agg.campaign_id
      WHERE c.id=?
    `,
      [id]
    );
    if (!row)
      return res
        .status(404)
        .json({ ok: false, message: "Không tìm thấy chiến dịch" });
    res.json({ ok: true, ...mapCampaignRow(row) });
  } catch (e) {
    console.error("[GET /campaigns/:id] ", e);
    res.status(500).json({ ok: false, message: "Không lấy được chiến dịch" });
  }
});

/* =================== GET /api/campaigns/:id/donations =================== */
router.get("/:id/donations", async (req, res) => {
  try {
    const items = await dbAll(
      `
      SELECT id, type, amount, qty, currency, donor_name, donor_note, memo, status, paid_at, created_at
      FROM donations
      WHERE campaign_id=? AND status='success'
      ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
      LIMIT 500
      `,
      [req.params.id]
    );
    const safe = items.map((it) => ({
      id: it.id,
      type: it.type || (toNum(it.qty, 0) > 0 ? "food" : "money"),
      amount: toNum(it.amount, 0),
      qty: toNum(it.qty, 0),
      currency: it.currency || "VND",
      donor_name: it.donor_name || "Ẩn danh",
      donor_note: it.donor_note || "",
      paid_at: it.paid_at || it.created_at,
      memo: it.memo || "",
    }));
    res.json({ ok: true, items: safe });
  } catch (e) {
    console.error("[GET /campaigns/:id/donations] ", e);
    res
      .status(500)
      .json({ ok: false, message: "Không lấy được danh sách ủng hộ" });
  }
});

/* ==================== GET /api/campaigns/:id/pledges ==================== */
router.get("/:id/pledges", async (req, res) => {
  try {
    const items = await dbAll(
      `
      SELECT id, type, qty, donor_name, donor_note, status, memo, created_at, paid_at
      FROM donations
      WHERE campaign_id=?
        AND type IN ('food','goods')
        AND status IN ('pledged','scheduled')
      ORDER BY created_at DESC, id DESC
      LIMIT 500
      `,
      [req.params.id]
    );
    const safe = items.map((it) => ({
      id: it.id,
      type: it.type || "food",
      qty: toNum(it.qty, 0),
      donor_name: it.donor_name || "Ẩn danh",
      donor_note: it.donor_note || "",
      status: it.status,
      memo: it.memo || "",
      created_at: it.created_at,
      expected_at: it.paid_at || null,
    }));
    res.json({ ok: true, items: safe });
  } catch (e) {
    console.error("[GET /campaigns/:id/pledges] ", e);
    res
      .status(500)
      .json({ ok: false, message: "Không lấy được danh sách pledge" });
  }
});

/* ========================= Reports (mini) ========================= */
router.get("/:id/reports", async (req, res) => {
  try {
    const id = req.params.id;
    const row = await dbGet(
      `
      SELECT
        c.id, c.title, c.description, c.location, c.goal, c.type,
        c.cover, c.cover_url, c.tags, c.meta, c.status, c.created_at, c.updated_at, c.deadline,
        c.target_amount, c.raised_amount, c.supporters, c.meal_price, c.meal_received_qty, c.delivered_meals,
        ${AGG.raisedMoney}  AS raised_money_calc,
        ${AGG.supporters}   AS supporters_calc,
        ${AGG.mealQty}      AS meal_qty_calc,
        ${AGG.pledgedQty}   AS meal_pledged_qty_calc
      FROM campaigns c WHERE c.id=?`,
      [id]
    );
    if (!row)
      return res
        .status(404)
        .json({ ok: false, message: "Không tìm thấy chiến dịch" });

    const byMonth = await dbAll(
      `
      SELECT ${monthExpr} AS month, SUM(amount) AS total
      FROM donations
      WHERE campaign_id=? AND status='success'
      GROUP BY month
      ORDER BY month ASC
      `,
      [id]
    );

    res.json({
      ok: true,
      campaign: mapCampaignRow(row),
      donationsByMonth: byMonth.map((d) => ({
        month: d.month,
        total: toNum(d.total, 0),
      })),
    });
  } catch (e) {
    console.error("[GET /campaigns/:id/reports] ", e);
    res.status(500).json({ ok: false, message: "Không lấy được báo cáo" });
  }
});

/* ========================= /active (quick cards) ======================== */
router.get("/active", async (req, res) => {
  try {
    const limit = clamp(parseInt(req.query.limit) || 12, 1, 100);
    const rows = await dbAll(`
      SELECT
        c.id, c.title, c.type, c.status, c.updated_at,
        COALESCE(c.cover_url, c.cover) AS cover_url,
        c.meta, c.tags,
        c.target_amount, c.raised_amount, c.supporters, c.meal_price, c.meal_received_qty, c.delivered_meals
      FROM campaigns c
      WHERE c.status='active'
      ORDER BY c.updated_at DESC
      LIMIT ${limit}
    `);
    const items = rows.map((r) => {
      const m = mapCampaignRow(r);
      return {
        id: m.id,
        title: m.title,
        cover_url: m.cover_url,
        type: m.type,
        raised_amount: m.raised_amount,
        supporters: m.supporters,
        meal_price: m.meal_price,
        meal_received_qty: m.meal_received_qty,
        meal_pledged_qty: m.meal_pledged_qty,
        delivered_meals: m.delivered_meals,
        status: m.status,
        updated_at: m.updated_at,
      };
    });
    res.json(items);
  } catch (e) {
    console.error("[GET /campaigns/active] ", e);
    res.status(500).json([]);
  }
});

/* ================== POST /api/campaigns/:id/donations =================== */
/** Một endpoint cho cả "đăng ký gửi bữa" (in-kind) và "ủng hộ tiền".
 *  - Nếu body có qty>0  -> in-kind: status 'pledged' (đợi duyệt)
 *  - Nếu body có amount>0 -> money: status 'pending' (đợi IPN/đối soát)
 *  Trả về next_action cho money để FE mở bước thanh toán (MoMo/VietQR/QR custom).
 */
router.post("/:id/donations", async (req, res) => {
  try {
    const id = req.params.id;
    if (!id)
      return res
        .status(400)
        .json({ ok: false, message: "campaign_id không hợp lệ" });

    const camp = await dbGet(
      "SELECT id, meta, meal_price, target_amount, raised_amount FROM campaigns WHERE id=?",
      [id]
    );
    if (!camp)
      return res
        .status(404)
        .json({ ok: false, message: "Chiến dịch không tồn tại" });

    const meta = parseJson(camp.meta, {});
    const payCfg = meta?.payment || {};

    // ---- input từ form "Đăng ký gửi"
    const {
      donor_name,
      donor_note,
      memo,
      amount,
      currency, // money
      qty,
      unit, // meal/in-kind
      pickup_point_id,
      in_kind,
      user_location,
      paid_at,
    } = req.body || {};

    const qtyVal = toNum(qty, 0);
    const amountVal = toNum(amount, 0);
    const cur = (currency || "VND").toUpperCase().slice(0, 8);

    const donorName =
      (donor_name || "").toString().trim().slice(0, 120) || "Ẩn danh";
    const donorNote = (donor_note || "").toString().trim().slice(0, 500);

    const memoBits = [];
    if (pickup_point_id) memoBits.push(`pickup_point=${pickup_point_id}`);
    if (user_location?.lat != null && user_location?.lng != null)
      memoBits.push(`lat=${user_location.lat},lng=${user_location.lng}`);
    if (unit) memoBits.push(`unit=${unit}`);
    if (in_kind) memoBits.push("IN_KIND");
    if (memo) memoBits.push(String(memo).slice(0, 600));
    const finalMemo = memoBits.join(" | ").slice(0, 1000);

    const nowSQL = useMySQL ? "NOW()" : "CURRENT_TIMESTAMP";
    const paidDt = paid_at ? new Date(paid_at) : null;
    const paidSQL =
      paidDt && !isNaN(paidDt)
        ? paidDt.toISOString().slice(0, 19).replace("T", " ")
        : null;

    // ---- Phân nhánh ý định
    let kind = null; // 'meal' | 'money'
    if (qtyVal > 0 && amountVal <= 0) kind = "meal";
    else if (amountVal > 0 && qtyVal <= 0) kind = "money";
    else {
      return res.status(400).json({
        ok: false,
        message: "Cần truyền *hoặc* qty>0 (in-kind) *hoặc* amount>0 (money)",
      });
    }

    // ---- Insert donation
    const insertType = kind === "meal" ? "food" : "money";
    const insertAmount = kind === "money" ? amountVal : 0;
    const insertQty = kind === "meal" ? qtyVal : 0;
    const insertStatus = kind === "meal" ? "pledged" : "pending"; // meal -> admin duyệt, money -> chờ IPN

    await dbRun(
      `
      INSERT INTO donations
        (order_id, campaign_id, user_id, type, amount, qty, currency, donor_name, donor_note, memo, status, created_at, paid_at)
      VALUES
        ('', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ${nowSQL}, ?)
      `,
      [
        id,
        insertType,
        insertAmount,
        insertQty,
        cur,
        donorName,
        donorNote,
        finalMemo,
        insertStatus,
        paidSQL,
      ]
    );

    // ---- Chuẩn bị next_action cho FE
    let next_action = { type: "none" };

    if (kind === "money") {
      const method = (payCfg?.method || "").toLowerCase();
      if (method === "momo") {
        next_action = {
          type: "pay",
          method: "momo",
          hint: "Chuyển hướng qua MoMo để thanh toán",
          memo: payCfg?.memo || "",
          amount: amountVal,
          currency: cur,
        };
      } else if (method === "vietqr") {
        const bank = payCfg?.bank || "";
        const account = payCfg?.account || "";
        const name = payCfg?.name || "";
        const memoQR = payCfg?.memo || donorName;
        const qr_url = `https://img.vietqr.io/image/${encodeURIComponent(
          bank
        )}-${encodeURIComponent(
          account
        )}-qr_only.png?amount=${amountVal}&accountName=${encodeURIComponent(
          name
        )}&addInfo=${encodeURIComponent(memoQR)}`;
        next_action = {
          type: "pay",
          method: "vietqr",
          qr_url,
          bank,
          account,
          name,
          currency: cur,
          amount: amountVal,
          memo: memoQR,
        };
      } else if (method === "custom_qr" && payCfg?.qr_url) {
        next_action = {
          type: "pay",
          method: "custom_qr",
          qr_url: payCfg.qr_url,
          currency: cur,
          amount: amountVal,
          memo: payCfg?.memo || "",
        };
      } else {
        next_action = {
          type: "info",
          message:
            "Đã tạo yêu cầu ủng hộ tiền (pending). Kênh thanh toán chưa được cấu hình.",
        };
      }
    } else {
      next_action = {
        type: "await_approval",
        message:
          "Đã ghi nhận đăng ký gửi bữa. Quản trị viên sẽ duyệt và liên hệ nếu cần.",
      };
    }

    return res.json({ ok: true, kind, next_action });
  } catch (e) {
    console.error("[POST /campaigns/:id/donations] ", e);
    res.status(500).json({ ok: false, message: "Không tạo được donation" });
  }
});

/* ====================== Legacy fallback (in-kind) ====================== */
router.post("/meals/donate", async (req, res) => {
  try {
    const {
      campaign_id,
      servings,
      pickup_point_id,
      in_kind,
      user_location,
      contact_name,
      contact_phone,
      contact_note,
    } = req.body || {};
    const exist = await dbGet("SELECT id FROM campaigns WHERE id=?", [
      campaign_id,
    ]);
    if (!exist)
      return res
        .status(404)
        .json({ ok: false, message: "Chiến dịch không tồn tại" });

    const qtyVal = toNum(servings, 0);
    if (!in_kind || qtyVal <= 0)
      return res.status(400).json({
        ok: false,
        message: "Yêu cầu không hợp lệ (in_kind + servings > 0)",
      });

    const donorName =
      (contact_name || "").toString().trim().slice(0, 120) || "Ẩn danh";
    const donorNote = (contact_note || "").toString().trim().slice(0, 500);
    const bits = [
      "IN_KIND",
      pickup_point_id ? `pickup_point=${pickup_point_id}` : null,
      contact_phone ? `phone=${contact_phone}` : null,
      user_location?.lat != null && user_location?.lng != null
        ? `lat=${user_location.lat},lng=${user_location.lng}`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const nowSQL = useMySQL ? "NOW()" : "CURRENT_TIMESTAMP";
    await dbRun(
      `
      INSERT INTO donations
        (order_id, campaign_id, user_id, type, amount, qty, currency, donor_name, donor_note, memo, status, created_at, paid_at)
      VALUES
        ('', ?, NULL, 'food', 0, ?, 'VND', ?, ?, ?, 'pledged', ${nowSQL}, NULL)
      `,
      [campaign_id, qtyVal, donorName, donorNote, bits]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error("[POST /campaigns/meals/donate] ", e);
    res
      .status(500)
      .json({ ok: false, message: "Không tạo được đăng ký gửi bữa" });
  }
});

/* ======================= POST /:id/recalc (admin-ish) ======================= */
router.post("/:id/recalc", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id))
      return res
        .status(400)
        .json({ ok: false, message: "campaign_id không hợp lệ" });

    if (useMySQL) {
      await dbRun("CALL recalc_campaign(?)", [id]);
      return res.json({ ok: true, message: "Đã chạy recalc_campaign()" });
    }

    // SQLite: tự tính
    const row = await dbGet(
      `SELECT
         COALESCE(SUM(CASE WHEN status='success' AND amount>0 THEN amount ELSE 0 END),0) AS money,
         COALESCE(SUM(CASE WHEN status='success' AND qty>0 THEN qty ELSE 0 END),0) AS qty,
         COALESCE(SUM(CASE WHEN status='success' THEN 1 ELSE 0 END),0) AS supporters
       FROM donations WHERE campaign_id=?`,
      [id]
    );
    const cfg = await dbGet(
      "SELECT meal_price, meta FROM campaigns WHERE id=?",
      [id]
    );
    const price = toNum(
      cfg?.meal_price ?? parseJson(cfg?.meta, {})?.meal?.price,
      MEAL_PRICE_VND
    );
    const meals = computeMealsFrom(row?.money || 0, row?.qty || 0, price);

    await dbRun(
      `UPDATE campaigns
         SET raised=?, raised_amount=?, supporters=?, meal_received_qty=?, updated_at=${
           useMySQL ? "NOW()" : "datetime('now')"
         }
       WHERE id=?`,
      [
        toNum(row?.money, 0),
        toNum(row?.money, 0),
        toNum(row?.supporters, 0),
        meals,
        id,
      ]
    );
    res.json({ ok: true, message: "Đã tính lại (SQLite)" });
  } catch (e) {
    console.error("[POST /campaigns/:id/recalc] ", e);
    res.status(500).json({ ok: false, message: "Không recalc được" });
  }
});

export default router;
