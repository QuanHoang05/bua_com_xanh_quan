// src/routes/reports.js
// Reports API — khớp schema trong dump MariaDB
// - Tính số liệu từ donations với các trạng thái thành công: success|paid|completed|done
// - Qty dùng cột `qty` (KHÔNG phải `quantity`) nhưng có fallback nếu DB có cột quantity
// - Ưu tiên JSON meta.meal.price / meta.meal.target_qty; fallback cột/goal
// - List/sort/filter/paging đầy đủ; detail + series theo tháng; endpoint transactions thống nhất

const express = require("express");
const router = express.Router();
const { pool } = require("../db");

/* ========================= helpers ========================= */
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pageSizeBounds = (x, lo = 1, hi = 200) => clamp(x, lo, hi);

// Trạng thái donation được coi là "đã trả"
const STATUS_OK = "LOWER(d.status) IN ('success','paid','completed','done')";
// Cột tiền/bữa: ưu tiên amount/qty, nhưng có fallback value/quantity
const AMOUNT_SQL = "COALESCE(d.amount, d.value, 0)";
const MEALS_SQL  = "COALESCE(d.qty, d.quantity, 0)";

// ORDER BY an toàn
function getOrderBy(sort) {
  switch ((sort || "progress").toLowerCase()) {
    case "raised":
      return "c.raised_amount DESC";
    case "supporters":
      return "c.supporters DESC";
    case "newest":
      return "c.created_at DESC";
    case "progress":
    default:
      // progress = raised_amount / goal (NULLIF để tránh chia 0)
      return "(c.raised_amount / NULLIF(c.goal,0)) DESC";
  }
}

// Ưu tiên meal_price / target_qty từ JSON
const SQL_MEAL_PRICE_PREF = `
  NULLIF(
    COALESCE(
      c.meal_price,
      JSON_UNQUOTE(JSON_EXTRACT(c.meta,'$.meal.price'))
    ),
    0
  )
`;
const SQL_MEAL_TARGET_PREF = `
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.meta,'$.meal.target_qty')), 0)
`;

/* ============================================================
 * GET /reports/campaigns
 * Query: page, pageSize, q, status (all|active|archived|draft), sort, year
 * Trả: { page, pageSize, total, items: [...] }
 * ============================================================ */
router.get("/campaigns", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = pageSizeBounds(parseInt(req.query.pageSize || "18", 10), 1, 200);
  const q = (req.query.q || "").trim();
  const status = (req.query.status || "all").toLowerCase();
  const sort = (req.query.sort || "progress").toLowerCase();
  const year = req.query.year && req.query.year !== "all" ? parseInt(req.query.year, 10) : null;

  const where = [];
  const params = [];

  if (status !== "all") {
    where.push("LOWER(c.status) = ?");
    params.push(status);
  }
  if (q) {
    const kw = `%${q}%`;
    where.push("(c.title LIKE ? OR c.location LIKE ? OR c.description LIKE ?)");
    params.push(kw, kw, kw);
  }
  if (year) {
    where.push("YEAR(c.created_at) = ?");
    params.push(year);
  }

  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const ORDER_BY = getOrderBy(sort);
  const offset = (page - 1) * pageSize;

  try {
    const conn = await pool.getConnection();
    try {
      // total
      const [cnt] = await conn.query(`SELECT COUNT(*) AS total FROM campaigns c ${whereSQL}`, params);
      const total = toNum(cnt?.[0]?.total);

      // rows
      const sql = `
        SELECT
          c.id, c.title, c.location, c.description, c.type,
          LOWER(c.status) AS status,
          c.goal,
          c.raised_amount,
          c.supporters,
          c.cover, c.cover_url,
          c.created_at,
          c.meal_price,
          c.meal_received_qty,
          /* meal_goal ưu tiên JSON, rồi fallback floor(goal/meal_price_pref) */
          COALESCE(
            ${SQL_MEAL_TARGET_PREF},
            CASE WHEN ${SQL_MEAL_PRICE_PREF} IS NOT NULL THEN FLOOR(c.goal / ${SQL_MEAL_PRICE_PREF}) ELSE NULL END
          ) AS meal_goal_calc
        FROM campaigns c
        ${whereSQL}
        ORDER BY ${ORDER_BY}
        LIMIT ? OFFSET ?
      `;
      const [rows] = await conn.query(sql, [...params, pageSize, offset]);

      const items = rows.map(r => {
        const goal = toNum(r.goal);
        const mealPriceCol = toNum(r.meal_price);
        const moneyRaised = toNum(r.raised_amount);
        const mealsRaised = toNum(r.meal_received_qty);
        const mealGoalCalc = toNum(r.meal_goal_calc) || (mealPriceCol > 0 ? Math.floor(goal / mealPriceCol) : 0);

        return {
          id: r.id,
          title: r.title,
          location: r.location,
          description: r.description,
          status: r.status,
          type: r.type,
          goal,
          money_goal: goal,
          money_raised: moneyRaised,
          meal_price: mealPriceCol || 0,
          meal_goal: mealGoalCalc,
          meals_raised: mealsRaised,
          supporters: toNum(r.supporters),
          cover: r.cover || r.cover_url || null,
          created_at: r.created_at,
        };
      });

      res.json({ page, pageSize, total, items });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("GET /reports/campaigns error:", e);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* ============================================================
 * GET /reports/campaigns/:id
 * Trả: { item, series:[{month,value,meals,donations}], latest:[{...}] }
 * ============================================================ */
router.get("/campaigns/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const conn = await pool.getConnection();
    try {
      // campaign
      const [cRows] = await conn.query(`SELECT * FROM campaigns WHERE id = ? LIMIT 1`, [id]);
      const c = cRows?.[0];
      if (!c) return res.status(404).json({ ok: false, message: "Not found" });

      // pref meal price/target
      const [pref] = await conn.query(
        `
        SELECT
          NULLIF(COALESCE(c.meal_price, JSON_UNQUOTE(JSON_EXTRACT(c.meta,'$.meal.price'))),0) AS meal_price_pref,
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(c.meta,'$.meal.target_qty')),0) AS meal_target_pref
        FROM campaigns c
        WHERE c.id = ?
        LIMIT 1
        `,
        [id]
      );
      const mealPrice = toNum(pref?.[0]?.meal_price_pref) || toNum(c.meal_price);
      const goal = toNum(c.goal);
      const mealGoal =
        toNum(pref?.[0]?.meal_target_pref) ||
        (mealPrice > 0 ? Math.floor(goal / mealPrice) : 0);

      // series theo tháng từ donations (trạng thái OK)
      const [series] = await conn.query(
        `
        SELECT
          DATE_FORMAT(COALESCE(d.paid_at, d.created_at), '%Y-%m') AS ym,
          SUM(CASE WHEN ${STATUS_OK} THEN ${AMOUNT_SQL} ELSE 0 END) AS value,
          SUM(CASE WHEN ${STATUS_OK} THEN ${MEALS_SQL}  ELSE 0 END) AS meals,
          COUNT(CASE WHEN ${STATUS_OK} THEN 1 END)                 AS donations
        FROM donations d
        WHERE d.campaign_id = ?
        GROUP BY ym
        ORDER BY ym
        `,
        [id]
      );

      // latest 10 donations (trạng thái OK)
      const [latest] = await conn.query(
        `
        SELECT
          d.id,
          COALESCE(d.paid_at, d.created_at) AS at,
          ${AMOUNT_SQL} AS amount,
          ${MEALS_SQL}  AS meals,
          COALESCE(u.name, d.donor_name)     AS donor
        FROM donations d
        LEFT JOIN users u ON u.id = d.user_id
        WHERE d.campaign_id = ? AND ${STATUS_OK}
        ORDER BY COALESCE(d.paid_at, d.created_at) DESC, d.id DESC
        LIMIT 10
        `,
        [id]
      );

      res.json({
        item: {
          id: c.id,
          title: c.title,
          description: c.description,
          location: c.location,
          status: c.status,
          type: c.type,

          goal,
          money_goal: goal,
          money_raised: toNum(c.raised_amount),

          meal_price: mealPrice,
          meal_goal: mealGoal,
          meals_raised: toNum(c.meal_received_qty),

          supporters: toNum(c.supporters),
          cover: c.cover || c.cover_url || null,
          created_at: c.created_at,
        },
        series: (series || []).map(r => ({
          month: r.ym,
          value: toNum(r.value),
          meals: toNum(r.meals),
          donations: toNum(r.donations),
        })),
        latest: (latest || []).map(d => ({
          id: d.id,
          at: d.at,
          amount: toNum(d.amount),
          meals: toNum(d.meals),
          donor: d.donor,
        })),
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("GET /reports/campaigns/:id error:", e);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* ============================================================
 * GET /reports/transactions
 * Query:
 *   page, pageSize (<=200)
 *   campaignId (optional)
 *   kind = money | meal | all
 *   q    = tìm kiếm theo tên người ủng hộ / ghi chú
 * Trả: { page, pageSize, total, items:[{id,at,party,content,amount,meals}] }
 * ============================================================ */
router.get("/transactions", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = pageSizeBounds(parseInt(req.query.pageSize || "50", 10), 1, 200);
  const campaignId = req.query.campaignId || null;
  const kind = String(req.query.kind || "all").toLowerCase();
  const q = (req.query.q || "").trim();

  const where = [STATUS_OK];
  const params = [];

  if (campaignId) {
    where.push("d.campaign_id = ?");
    params.push(campaignId);
  }
  if (kind === "money") where.push(`${AMOUNT_SQL} > 0`);
  if (kind === "meal")  where.push(`${MEALS_SQL}  > 0`);
  if (q) {
    const kw = `%${q}%`;
    // mở rộng: donor_note / memo / message
    where.push("(COALESCE(u.name, d.donor_name) LIKE ? OR COALESCE(d.donor_note, d.memo, d.message, '') LIKE ?)");
    params.push(kw, kw);
  }

  const whereSQL = `WHERE ${where.join(" AND ")}`;
  const offset = (page - 1) * pageSize;

  try {
    const conn = await pool.getConnection();
    try {
      const [cnt] = await conn.query(
        `
        SELECT COUNT(*) AS total
        FROM donations d
        LEFT JOIN users u ON u.id = d.user_id
        ${whereSQL}
        `,
        params
      );
      const total = toNum(cnt?.[0]?.total);

      const [rows] = await conn.query(
        `
        SELECT
          d.id,
          COALESCE(d.paid_at, d.created_at) AS at,
          COALESCE(u.name, d.donor_name)     AS party,
          COALESCE(d.donor_note, d.memo, d.message, '') AS content,
          ${AMOUNT_SQL} AS amount,
          ${MEALS_SQL}  AS meals
        FROM donations d
        LEFT JOIN users u ON u.id = d.user_id
        ${whereSQL}
        ORDER BY COALESCE(d.paid_at, d.created_at) DESC, d.id DESC
        LIMIT ? OFFSET ?
        `,
        [...params, pageSize, offset]
      );

      res.json({
        page,
        pageSize,
        total,
        items: rows.map(r => ({
          id: r.id,
          at: r.at,
          party: r.party,
          content: r.content,
          amount: toNum(r.amount),
          meals: toNum(r.meals),
        })),
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("GET /reports/transactions error:", e);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

module.exports = router;
