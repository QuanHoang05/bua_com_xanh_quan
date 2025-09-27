// backend/src/routes/admin_dashboard.js
// Admin Stats API — giàu dữ liệu, hỗ trợ MySQL & SQLite, có Success Rate

import { Router } from "express";
import "dotenv/config";

const useMySQL = (process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else ({ db } = await import("../lib/db.js"));

/* ---------------- DB helpers (agnostic) ---------------- */
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
const NOW_SQL = useMySQL ? "NOW()" : "datetime('now')";
const BETWEEN_TODAY_SQL = useMySQL
  ? "created_at >= CONCAT(DATE(NOW()), ' 00:00:00') AND created_at <= CONCAT(DATE(NOW()), ' 23:59:59')"
  : "datetime(created_at) >= datetime(date('now') || ' 00:00:00') AND datetime(created_at) <= datetime(date('now') || ' 23:59:59')";

/* ---------------- tiny utils ---------------- */
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const safeArr = (v) => (Array.isArray(v) ? v : []);

/* ---------------- Core aggregations ---------------- */
async function deliveriesAgg() {
  // tổng & theo status
  const total = await dbGet("SELECT COUNT(*) AS c FROM deliveries").catch(() => ({ c: 0 }));
  const byStatus = await dbAll("SELECT status, COUNT(*) AS count FROM deliveries GROUP BY status").catch(() => []);

  const deliveredTotal = await dbGet(
    "SELECT COUNT(*) AS c FROM deliveries WHERE status='delivered'"
  ).catch(() => ({ c: 0 }));

  // hôm nay
  const todayCount = await dbGet(`SELECT COUNT(*) AS c FROM deliveries WHERE ${BETWEEN_TODAY_SQL}`).catch(() => ({ c: 0 }));
  const todayDelivered = await dbGet(
    `SELECT COUNT(*) AS c FROM deliveries WHERE status='delivered' AND ${BETWEEN_TODAY_SQL}`
  ).catch(() => ({ c: 0 }));

  // 7 ngày gần nhất (để vẽ series)
  const weekScope = useMySQL
    ? "DATE(created_at) BETWEEN DATE_SUB(DATE(NOW()), INTERVAL 6 DAY) AND DATE(NOW())"
    : "DATE(created_at) BETWEEN date('now','-6 day') AND date('now')";
  const weekTotal = await dbGet(`SELECT COUNT(*) AS c FROM deliveries WHERE ${weekScope}`).catch(() => ({ c: 0 }));
  const weekDelivered = await dbGet(
    `SELECT COUNT(*) AS c FROM deliveries WHERE status='delivered' AND ${weekScope}`
  ).catch(() => ({ c: 0 }));

  // tháng này
  const monthScope = useMySQL
    ? "DATE(created_at) >= DATE_FORMAT(NOW(),'%Y-%m-01')"
    : "DATE(created_at) >= date('now','start of month')";
  const monthTotal = await dbGet(`SELECT COUNT(*) AS c FROM deliveries WHERE ${monthScope}`).catch(() => ({ c: 0 }));
  const monthDelivered = await dbGet(
    `SELECT COUNT(*) AS c FROM deliveries WHERE status='delivered' AND ${monthScope}`
  ).catch(() => ({ c: 0 }));

  // rescued_meals: qty/quantity/items (fallback 1) — tổng & hôm nay
  const sumMealsAll = await dbGet(
    "SELECT COALESCE(SUM(COALESCE(qty, quantity, items, 1)),0) AS c FROM deliveries"
  ).catch(() => ({ c: 0 }));
  const sumMealsToday = await dbGet(
    `SELECT COALESCE(SUM(COALESCE(qty, quantity, items, 1)),0) AS c FROM deliveries WHERE ${BETWEEN_TODAY_SQL}`
  ).catch(() => ({ c: 0 }));

  // theo shipper (top 10)
  const byShipper = await dbAll(
    (useMySQL
      ? `SELECT d.shipper_id, u.name AS shipper_name,
                COUNT(*) AS total,
                SUM(CASE WHEN d.status='delivered' THEN 1 ELSE 0 END) AS delivered
           FROM deliveries d
           LEFT JOIN users u ON u.id COLLATE utf8mb4_bin = d.shipper_id COLLATE utf8mb4_bin
          GROUP BY d.shipper_id, u.name
          ORDER BY delivered DESC, total DESC
          LIMIT 10`
      : `SELECT d.shipper_id, u.name AS shipper_name,
                COUNT(*) AS total,
                SUM(CASE WHEN d.status='delivered' THEN 1 ELSE 0 END) AS delivered
           FROM deliveries d
           LEFT JOIN users u ON u.id = d.shipper_id
          GROUP BY d.shipper_id, u.name
          ORDER BY delivered DESC, total DESC
          LIMIT 10`)
  ).catch(() => []);

  // theo campaign (top 10)
  const byCampaign = await dbAll(
    `SELECT d.campaign_id,
            COALESCE(c.title, CONCAT('Campaign #', d.campaign_id)) AS campaign_title,
            COUNT(*) AS total,
            SUM(CASE WHEN d.status='delivered' THEN 1 ELSE 0 END) AS delivered
       FROM deliveries d
       LEFT JOIN campaigns c ON c.id = d.campaign_id
      GROUP BY d.campaign_id, campaign_title
      ORDER BY delivered DESC, total DESC
      LIMIT 10`
  ).catch(() => []);

  // theo ngày (7 ngày) → series
  const last7 = await dbAll(
    useMySQL
      ? `SELECT DATE(created_at) AS d,
               COUNT(*) AS total,
               SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered
          FROM deliveries
         WHERE DATE(created_at) BETWEEN DATE_SUB(DATE(NOW()), INTERVAL 6 DAY) AND DATE(NOW())
         GROUP BY DATE(created_at)
         ORDER BY d`
      : `SELECT DATE(created_at) AS d,
               COUNT(*) AS total,
               SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered
          FROM deliveries
         WHERE DATE(created_at) BETWEEN date('now','-6 day') AND date('now')
         GROUP BY DATE(created_at)
         ORDER BY d`
  ).catch(() => []);

  const totalNum = num(total?.c);
  const deliveredNum = num(deliveredTotal?.c);
  const rate = totalNum > 0 ? deliveredNum / totalNum : 0;

  return {
    total: totalNum,
    byStatus: safeArr(byStatus).map(r => ({ status: r.status ?? "unknown", count: num(r.count ?? r.c) })),
    delivered_total: deliveredNum,
    success_rate: rate, // 0..1
    today: {
      total: num(todayCount?.c),
      delivered: num(todayDelivered?.c),
      rate: num(todayDelivered?.c) && num(todayCount?.c) ? num(todayDelivered?.c) / num(todayCount?.c) : 0,
      rescued_meals: num(sumMealsToday?.c),
    },
    last7d: {
      total: num(weekTotal?.c),
      delivered: num(weekDelivered?.c),
      rate: num(weekDelivered?.c) && num(weekTotal?.c) ? num(weekDelivered?.c) / num(weekTotal?.c) : 0,
      series: last7.map(r => ({ day: r.d, total: num(r.total), delivered: num(r.delivered) })),
    },
    month: {
      total: num(monthTotal?.c),
      delivered: num(monthDelivered?.c),
      rate: num(monthDelivered?.c) && num(monthTotal?.c) ? num(monthDelivered?.c) / num(monthTotal?.c) : 0,
    },
    rescued_meals_all: num(sumMealsAll?.c),
    top_shippers: byShipper.map(r => ({
      shipper_id: r.shipper_id,
      shipper_name: r.shipper_name ?? "—",
      total: num(r.total),
      delivered: num(r.delivered),
      rate: num(r.delivered) && num(r.total) ? num(r.delivered) / num(r.total) : 0,
    })),
    top_campaigns: byCampaign.map(r => ({
      campaign_id: r.campaign_id,
      campaign_title: r.campaign_title ?? "—",
      total: num(r.total),
      delivered: num(r.delivered),
      rate: num(r.delivered) && num(r.total) ? num(r.delivered) / num(r.total) : 0,
    })),
  };
}

/* ---------------- Router ---------------- */
const router = Router();

/**
 * GET /api/admin/stats
 * Trả payload đầy đủ cho AdminDashboard.jsx
 */
router.get("/stats", async (_req, res) => {
  try {
    /* ---------- USERS ---------- */
    const usersTotal = await dbGet("SELECT COUNT(*) AS c FROM users").catch(() => ({ c: 0 }));
    const usersByRole = await dbAll("SELECT role, COUNT(*) AS count FROM users GROUP BY role").catch(() => []);

    /* ---------- CAMPAIGNS ---------- */
    const campTotal = await dbGet("SELECT COUNT(*) AS c FROM campaigns").catch(() => ({ c: 0 }));
    const campActive = await dbGet("SELECT COUNT(*) AS c FROM campaigns WHERE status='active'").catch(() => ({ c: 0 }));
    const campAgg = await dbGet(
      `SELECT
          COALESCE(SUM(raised_amount),0)      AS raised_amount,
          COALESCE(SUM(supporters),0)         AS supporters,
          COALESCE(SUM(meal_received_qty),0)  AS meal_received_qty,
          COALESCE(SUM(delivered_meals),0)    AS delivered_meals
       FROM campaigns`
    ).catch(() => ({ raised_amount: 0, supporters: 0, meal_received_qty: 0, delivered_meals: 0 }));

    /* ---------- DONATIONS ---------- */
    const donTotal = await dbGet("SELECT COUNT(*) AS c FROM donations").catch(() => ({ c: 0 }));
    const donSuccess = await dbGet("SELECT COUNT(*) AS c FROM donations WHERE status='success'").catch(() => ({ c: 0 }));
    const donFailed = await dbGet("SELECT COUNT(*) AS c FROM donations WHERE status IN ('failed','cancelled','error')").catch(() => ({ c: 0 }));
    const donAmtSuccess = await dbGet("SELECT COALESCE(SUM(amount),0) AS s FROM donations WHERE status='success'").catch(() => ({ s: 0 }));
    const donLatest = await dbAll(
      `SELECT d.id, d.amount, d.status, d.created_at, d.paid_at,
              COALESCE(c.title, CONCAT('Campaign #', d.campaign_id)) AS campaign_title,
              d.campaign_id
         FROM donations d
         LEFT JOIN campaigns c ON c.id = d.campaign_id
        ORDER BY d.created_at DESC
        LIMIT 10`
    ).catch(() => []);

    /* ---------- DELIVERIES (đầy đủ + success rate) ---------- */
    const deliveries = await deliveriesAgg();

    /* ---------- BOOKINGS ---------- */
    const bookTotal = await dbGet("SELECT COUNT(*) AS c FROM bookings").catch(() => ({ c: 0 }));
    const bookByStatus = await dbAll("SELECT status, COUNT(*) AS count FROM bookings GROUP BY status").catch(() => []);

    /* ---------- PAYMENTS breakdown ---------- */
    const paymentsByProvider = await dbAll(
      `SELECT COALESCE(provider, method, gateway, 'unknown') AS provider, COUNT(*) AS count
         FROM payments
        GROUP BY COALESCE(provider, method, gateway, 'unknown')`
    ).catch(() => []);

    /* ---------- PICKUP POINTS ---------- */
    const pickupPointsTotal = await dbGet("SELECT COUNT(*) AS c FROM pickup_points").catch(() => ({ c: 0 }));

    /* ---------- ANNOUNCEMENTS (đúng cột active) ---------- */
    const announcementsActive = await dbGet("SELECT COUNT(*) AS c FROM announcements WHERE active=1")
      .catch(() => ({ c: 0 }));
    const announcementsLatest = await dbAll(
      "SELECT id, title, content, created_at FROM announcements WHERE active=1 ORDER BY created_at DESC LIMIT 6"
    ).catch(() => []);

    /* ---------- METRICS DAILY (yêu cầu có thì trả, không thì fallback) ---------- */
    const metricsToday = await dbGet(
      useMySQL
        ? "SELECT * FROM metrics_daily WHERE day = DATE(NOW())"
        : "SELECT * FROM metrics_daily WHERE day = date('now')"
    ).catch(() => null);

    /* ---------- AUDIT LATEST (nếu có) ---------- */
    const auditLatest = await dbAll(
      "SELECT id, action, detail, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10"
    ).catch(() => []);

    /* ---------- Compose payload ---------- */
    res.json({
      users: {
        total: num(usersTotal?.c),
        byRole: safeArr(usersByRole).map(r => ({ role: r.role ?? "user", count: num(r.count ?? r.c) })),
      },
      campaigns: {
        total: num(campTotal?.c),
        active: num(campActive?.c),
        raised_amount: num(campAgg?.raised_amount),
        supporters: num(campAgg?.supporters),
        meal_received_qty: num(campAgg?.meal_received_qty),
        delivered_meals: num(campAgg?.delivered_meals),
      },
      donations: {
        total: num(donTotal?.c),
        success: num(donSuccess?.c),
        failed: num(donFailed?.c),
        amount_success: num(donAmtSuccess?.s),
        latest: donLatest,
      },
      deliveries, // <— gói đủ success_rate + series/top lists
      bookings: {
        total: num(bookTotal?.c),
        byStatus: safeArr(bookByStatus).map(r => ({ status: r.status ?? "unknown", count: num(r.count ?? r.c) })),
      },
      payments: safeArr(paymentsByProvider).map(p => ({ provider: p.provider ?? "unknown", count: num(p.count ?? p.c) })),
      metrics_daily_today: metricsToday
        ? { ...metricsToday, at: NOW_SQL }
        : { rescued_meals: deliveries.today.rescued_meals, deliveries: deliveries.today.total, at: NOW_SQL },
      pickup_points: { total: num(pickupPointsTotal?.c) },
      announcements: {
        active: num(announcementsActive?.c),
        latest: announcementsLatest,
      },
      audit_latest: auditLatest,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[/api/admin/stats] error:", e);
    res.status(500).json({ error: "server_error", message: e?.message || "Server error" });
  }
});

/* --------- Back-compat alias --------- */
router.get("/dashboard", async (_req, res) => {
  res.redirect(307, "/api/admin/stats");
});

export default router;
