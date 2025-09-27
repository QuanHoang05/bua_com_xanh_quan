// backend/src/routes/analytics.deliveries.js (ESM)
import { Router } from "express";
import "dotenv/config";

let requireAuth = (req,res,next)=>next(), requireRole = ()=>(req,res,next)=>next();
try {
  const mw = await import("../middlewares/auth.js");
  requireAuth = mw.requireAuth || requireAuth;
  requireRole = mw.requireRole || requireRole;
} catch {}

const useMySQL = (process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.mysql.js"));
else          ({ db } = await import("../lib/db.js"));

const r = Router();

/*
  GET /api/analytics/delivery-rate
  Query:
    - from, to (ISO) => filter theo updated_at (hoặc created_at nếu muốn)
    - mine=1 => chỉ đơn của user (shipper/receiver); nếu scope=all + admin => all
    - group_by=none|day|shipper|campaign (default: day)
    - basis=completed|all  (default: completed)
*/
r.get("/delivery-rate", requireAuth, async (req, res) => {
  try {
    const { from = "", to = "", group_by = "day", basis = "completed", scope = "", mine = "" } = req.query;

    // where base
    const where = [];
    const params = [];

    // time range
    if (from) {
      where.push(useMySQL ? "d.updated_at >= ?" : "d.updated_at >= ?");
      params.push(from);
    }
    if (to) {
      where.push(useMySQL ? "d.updated_at <= ?" : "d.updated_at <= ?");
      params.push(to);
    }

    // scope/mine
    const isAdmin = (req.user?.role === "admin") || (req.user?.roles || []).includes?.("admin");
    if (!(isAdmin && String(scope).toLowerCase() === "all")) {
      // mine: shipper hoặc receiver
      // shipper được ưu tiên; nếu không có role shipper thì lọc theo receiver
      const isShipper = (req.user?.role === "shipper") || (req.user?.roles || []).includes?.("shipper");
      if (isShipper) {
        where.push("d.shipper_id = ?");
        params.push(req.user.id);
      } else {
        where.push("b.receiver_id = ?");
        params.push(req.user.id);
      }
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // group selector
    let groupSel = "", groupCol = "grp";
    if (group_by === "shipper") {
      groupSel = useMySQL
        ? "u.id AS grp, u.name AS grp_name"
        : "u.id AS grp, u.name AS grp_name";
    } else if (group_by === "campaign") {
      groupSel = useMySQL
        ? "d.campaign_id AS grp, d.campaign_id AS grp_name"
        : "d.campaign_id AS grp, d.campaign_id AS grp_name";
    } else if (group_by === "none") {
      groupSel = useMySQL ? "1 AS grp, 'Tổng' AS grp_name" : "1 AS grp, 'Tổng' AS grp_name";
    } else {
      // day
      groupSel = useMySQL
        ? "DATE(d.updated_at) AS grp, DATE(d.updated_at) AS grp_name"
        : "date(d.updated_at) AS grp, date(d.updated_at) AS grp_name";
    }

    // basis
    const cntDelivered = "SUM(CASE WHEN d.status = 'delivered' THEN 1 ELSE 0 END) AS delivered";
    const cntCancelled = "SUM(CASE WHEN d.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled";
    const cntAll       = "COUNT(*) AS total";

    // choose denominator
    const denom = basis === "all"
      ? "NULLIF(COUNT(*),0)"
      : "NULLIF(SUM(CASE WHEN d.status IN ('delivered','cancelled') THEN 1 ELSE 0 END),0)";

    const sql =
      `SELECT ${groupSel},
              ${cntDelivered}, ${cntCancelled}, ${cntAll},
              ROUND(100.0 * SUM(CASE WHEN d.status='delivered' THEN 1 ELSE 0 END) / ${denom}, 2) AS success_rate
       FROM deliveries d
       LEFT JOIN bookings b ON b.id = d.booking_id
       LEFT JOIN users u ON u.id = d.shipper_id
       ${whereSQL}
       GROUP BY ${groupCol}
       ORDER BY ${groupCol} ASC`;

    const rows = useMySQL ? (await db.query(sql, params))[0] : await db.prepare(sql).all(...params);

    // Also return a global summary
    let summary = { delivered: 0, cancelled: 0, total: 0, success_rate: 0 };
    for (const r of rows) {
      summary.delivered += Number(r.delivered||0);
      summary.cancelled += Number(r.cancelled||0);
      summary.total     += Number(r.total||0);
    }
    const denomSum = basis === "all" ? summary.total : (summary.delivered + summary.cancelled);
    summary.success_rate = denomSum ? +(100 * summary.delivered / denomSum).toFixed(2) : 0;

    res.json({ items: rows, summary, basis, group_by });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "delivery_rate_failed", message: e?.message || "Server error" });
  }
});

export default r;
