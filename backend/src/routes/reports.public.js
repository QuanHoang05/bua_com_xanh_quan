// src/routes/reports.public.js  (ESM)
// Reports API — đọc đúng dữ liệu từ MySQL/MariaDB dump của Bữa Cơm Xanh
// - Tiền/bữa lấy từ donations với trạng thái OK: success|paid|completed|done
// - Qty bữa dùng cột `qty` (fallback `quantity` nếu có)
// - “Bữa đã phát” lấy từ deliveries (status=delivered), có series theo tháng + latest
// - Ưu tiên JSON meta.meal.price / meta.meal.target_qty; fallback cột/goal
// - List/sort/filter/paging; detail; transactions (money | meal | meals_out | all | all_plus_out)

import express from "express";

// dùng cùng connection adapter với server
const isMySQL = (process.env.DB_DRIVER || "mysql").toLowerCase() === "mysql";
if (!isMySQL) {
  // API này nhắm tới MySQL/MariaDB theo dump; nếu cần SQLite thì phải viết lại JSON_EXTRACT tương ứng.
  console.warn("[reports.public] DB_DRIVER != mysql – JSON_EXTRACT có thể không hoạt động trên SQLite.");
}
const { db } = await import("../lib/db.mysql.js");

const router = express.Router();

/* ========================= helpers ========================= */
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pageSizeBounds = (x, lo = 1, hi = 200) => clamp(x, lo, hi);

// Trạng thái donation được coi là thành công
const STATUS_OK = "LOWER(d.status) IN ('success','paid','completed','done')";

// Cột tiền/bữa (có fallback)
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
    // total
    const [cnt] = await db.query(`SELECT COUNT(*) AS total FROM campaigns c ${whereSQL}`, params);
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
        c.delivered_meals,
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
    const [rows] = await db.query(sql, [...params, pageSize, offset]);

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
        meals_delivered: toNum(r.delivered_meals),
        supporters: toNum(r.supporters),
        cover: r.cover || r.cover_url || null,
        created_at: r.created_at,
      };
    });

    res.json({ page, pageSize, total, items });
  } catch (e) {
    console.error("GET /reports/campaigns error:", e);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

/* ============================================================
 * GET /reports/campaigns/:id
 * Trả: {
 *   item,
 *   series:[{month,value,meals,donations,meals_out}],
 *   latest:[donations...],
 *   latest_out:[deliveries...]
 * }
 * ============================================================ */
router.get("/campaigns/:id", async (req, res) => {
  const id = req.params.id;

  try {
    // campaign
    const [cRows] = await db.query(`SELECT * FROM campaigns WHERE id = ? LIMIT 1`, [id]);
    const c = cRows?.[0];
    if (!c) return res.status(404).json({ ok: false, message: "Not found" });

    // pref meal price/target
    const [pref] = await db.query(
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
    const mealGoal = toNum(pref?.[0]?.meal_target_pref) || (mealPrice > 0 ? Math.floor(goal / mealPrice) : 0);

    // series theo tháng từ donations (trạng thái OK)
    const [series] = await db.query(
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

    // series bữa đã phát theo tháng từ deliveries (status delivered)
    const [seriesOut] = await db.query(
      `
      SELECT
        DATE_FORMAT(COALESCE(v.delivered_at, v.updated_at, v.created_at), '%Y-%m') AS ym,
        SUM(v.qty) AS meals_out
      FROM deliveries v
      WHERE v.campaign_id = ? AND LOWER(v.status) = 'delivered'
      GROUP BY ym
      ORDER BY ym
      `,
      [id]
    );

    // latest 10 donations (trạng thái OK)
    const [latest] = await db.query(
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

    // latest 10 deliveries (bữa phát)
    const [latestOut] = await db.query(
      `
      SELECT
        v.id,
        COALESCE(v.delivered_at, v.updated_at, v.created_at) AS at,
        v.qty AS meals,
        COALESCE(ru.name, v.dropoff_name) AS receiver,
        COALESCE(b.note, v.note, v.dropoff_address, '') AS note
      FROM deliveries v
      LEFT JOIN bookings b ON b.id = v.booking_id
      LEFT JOIN users ru ON ru.id = b.receiver_id
      WHERE v.campaign_id = ? AND LOWER(v.status) = 'delivered'
      ORDER BY COALESCE(v.delivered_at, v.updated_at, v.created_at) DESC
      LIMIT 10
      `,
      [id]
    );

    // gộp series theo tháng (donations + deliveries)
    const seriesMap = new Map();
    (series || []).forEach(r => {
      seriesMap.set(r.ym, {
        month: r.ym,
        value: toNum(r.value),
        meals: toNum(r.meals),
        donations: toNum(r.donations),
        meals_out: 0
      });
    });
    (seriesOut || []).forEach(r => {
      const exist = seriesMap.get(r.ym);
      if (exist) exist.meals_out = toNum(r.meals_out);
      else seriesMap.set(r.ym, { month: r.ym, value: 0, meals: 0, donations: 0, meals_out: toNum(r.meals_out) });
    });
    const seriesMerged = Array.from(seriesMap.values()).sort((a,b)=>a.month.localeCompare(b.month));

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
        meals_delivered: toNum(c.delivered_meals),

        supporters: toNum(c.supporters),
        cover: c.cover || c.cover_url || null,
        created_at: c.created_at,
      },
      series: seriesMerged, // có thêm field meals_out
      latest: (latest || []).map(d => ({
        id: d.id,
        at: d.at,
        amount: toNum(d.amount),
        meals: toNum(d.meals),
        donor: d.donor,
      })),
      latest_out: (latestOut || []).map(v => ({
        id: v.id,
        at: v.at,
        amount: 0,
        meals: toNum(v.meals),
        receiver: v.receiver || "—",
        note: v.note || "",
      })),
    });
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
 *   kind = money | meal | meals_out | all | all_plus_out
 *   q    = tìm theo tên/ghi chú (donations) hoặc người nhận/ghi chú (deliveries)
 * Trả: { page, pageSize, total, items:[{id,at,party,content,amount,meals}] }
 * ============================================================ */
router.get("/transactions", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = pageSizeBounds(parseInt(req.query.pageSize || "50", 10), 1, 200);
  const campaignId = req.query.campaignId || null;
  const kind = String(req.query.kind || "all").toLowerCase();
  const q = (req.query.q || "").trim();

  const offset = (page - 1) * pageSize;

  try {
    // helper: build donations where
    const whereDon = [STATUS_OK];
    const paramsDon = [];

    if (campaignId) {
      whereDon.push("d.campaign_id = ?");
      paramsDon.push(campaignId);
    }
    if (kind === "money") whereDon.push(`${AMOUNT_SQL} > 0`);
    if (kind === "meal")  whereDon.push(`${MEALS_SQL}  > 0`);
    if (q) {
      const kw = `%${q}%`;
      whereDon.push("(COALESCE(u.name, d.donor_name) LIKE ? OR COALESCE(d.donor_note, d.memo, d.message, '') LIKE ?)");
      paramsDon.push(kw, kw);
    }
    const whereSQLDon = `WHERE ${whereDon.join(" AND ")}`;

    // helper: build deliveries where
    const whereDel = ["LOWER(v.status) = 'delivered'"];
    const paramsDel = [];
    if (campaignId) {
      whereDel.push("v.campaign_id = ?");
      paramsDel.push(campaignId);
    }
    if (q) {
      const kw = `%${q}%`;
      // tìm theo tên người nhận (users.name/dropoff_name) hoặc note
      whereDel.push("(COALESCE(ru.name, v.dropoff_name, '') LIKE ? OR COALESCE(b.note, v.note, v.dropoff_address, '') LIKE ?)");
      paramsDel.push(kw, kw);
    }
    const whereSQLDel = `WHERE ${whereDel.join(" AND ")}`;

    // Branch by kind
    if (kind === "meals_out") {
      const [cnt] = await db.query(
        `
        SELECT COUNT(*) AS total
        FROM deliveries v
        LEFT JOIN bookings b ON b.id = v.booking_id
        LEFT JOIN users ru   ON ru.id = b.receiver_id
        ${whereSQLDel}
        `,
        paramsDel
      );
      const total = toNum(cnt?.[0]?.total);

      const [rows] = await db.query(
        `
        SELECT
          v.id,
          COALESCE(v.delivered_at, v.updated_at, v.created_at) AS at,
          COALESCE(ru.name, v.dropoff_name) AS party,
          COALESCE(b.note, v.note, v.dropoff_address, '') AS content,
          0 AS amount,
          v.qty AS meals
        FROM deliveries v
        LEFT JOIN bookings b ON b.id = v.booking_id
        LEFT JOIN users ru   ON ru.id = b.receiver_id
        ${whereSQLDel}
        ORDER BY COALESCE(v.delivered_at, v.updated_at, v.created_at) DESC, v.id DESC
        LIMIT ? OFFSET ?
        `,
        [...paramsDel, pageSize, offset]
      );

      return res.json({
        page, pageSize, total,
        items: rows.map(r => ({
          id: r.id, at: r.at, party: r.party, content: r.content,
          amount: 0, meals: toNum(r.meals)
        }))
      });
    }

    if (kind === "all_plus_out") {
      // Lấy donations + deliveries, merge và paginate ở app (đơn giản, chắc chắn đúng)
      const [rowsDon] = await db.query(
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
        ${whereSQLDon}
        ORDER BY COALESCE(d.paid_at, d.created_at) DESC, d.id DESC
        LIMIT 500
        `,
        paramsDon
      );

      const [rowsDel] = await db.query(
        `
        SELECT
          v.id,
          COALESCE(v.delivered_at, v.updated_at, v.created_at) AS at,
          COALESCE(ru.name, v.dropoff_name) AS party,
          COALESCE(b.note, v.note, v.dropoff_address, '') AS content,
          0 AS amount,
          v.qty AS meals
        FROM deliveries v
        LEFT JOIN bookings b ON b.id = v.booking_id
        LEFT JOIN users ru   ON ru.id = b.receiver_id
        ${whereSQLDel}
        ORDER BY COALESCE(v.delivered_at, v.updated_at, v.created_at) DESC, v.id DESC
        LIMIT 500
        `,
        paramsDel
      );

      const merged = [
        ...(rowsDon || []).map(r => ({ ...r, amount: toNum(r.amount), meals: toNum(r.meals) })),
        ...(rowsDel || []).map(r => ({ ...r, amount: 0, meals: toNum(r.meals) })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at));

      const total = merged.length;
      const items = merged.slice(offset, offset + pageSize);

      return res.json({
        page, pageSize, total,
        items
      });
    }

    // default: donations only (kind: money | meal | all)
    const [cnt] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM donations d
      LEFT JOIN users u ON u.id = d.user_id
      ${whereSQLDon}
      `,
      paramsDon
    );
    const total = toNum(cnt?.[0]?.total);

    const [rows] = await db.query(
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
      ${whereSQLDon}
      ORDER BY COALESCE(d.paid_at, d.created_at) DESC, d.id DESC
      LIMIT ? OFFSET ?
      `,
      [...paramsDon, pageSize, offset]
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
  } catch (e) {
    console.error("GET /reports/transactions error:", e);
    res.status(500).json({ ok: false, message: "Server error" });
  }
});

export default router;
