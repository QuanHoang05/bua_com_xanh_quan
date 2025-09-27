// backend/src/routes/admin.payments.js
import { Router } from "express";
import "dotenv/config";

// 🔒 ÉP dùng MySQL để chắc chắn đọc đúng DB có dữ liệu
import { db } from "../lib/db.mysql.js";

async function dbAll(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows ?? [];
}
async function dbGet(sql, params = []) {
  const [rows] = await db.query(sql, params);
  return rows?.[0] ?? null;
}

const router = Router();
const ORDERABLE = new Set(["created_at", "amount", "id", "paid_at"]);

// map phương thức theo cột thực tế của bảng donations
const methodExpr = (a = "d") => `
  CASE
    WHEN ${a}.order_id LIKE 'MOMO%' THEN 'momo'
    WHEN UPPER(${a}.bank_code) IN ('VNPAY','VNPAYQR') THEN 'vnpay'
    WHEN UPPER(${a}.bank_code)='ZALOPAY' THEN 'zalopay'
    WHEN ${a}.bank_account IS NOT NULL AND ${a}.bank_account<>'' THEN 'bank'
    ELSE 'other'
  END
`;

/* ================= LIST ================= */
router.get("/payments", async (req, res) => {
  try {
    const {
      q = "", status = "all", method = "all",
      date_from = "", date_to = "",
      page = 1, pageSize = 20,
      sortBy = "created_at", order = "desc",
    } = req.query;

    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(200, Math.max(1, Number(pageSize) || 20));
    const offset = (p - 1) * ps;
    const ord = String(order).toLowerCase() === "asc" ? "ASC" : "DESC";
    const sortCol = ORDERABLE.has(String(sortBy)) ? sortBy : "created_at";

    const where = [];
    const params = [];

    // 🔍 Tìm theo id / bank_txn_id / order_id / donor_name / email
    if (q) {
      const like = `%${q}%`;
      where.push(`(
        CAST(d.id AS CHAR) LIKE ? OR
        COALESCE(d.bank_txn_id,'') LIKE ? OR
        COALESCE(d.order_id,'') LIKE ? OR
        COALESCE(d.donor_name,'') LIKE ? OR
        COALESCE(u.email,'') LIKE ?
      )`);
      params.push(like, like, like, like, like);
    }

    // trạng thái
    if (status !== "all") {
      where.push("LOWER(d.status) = LOWER(?)");
      params.push(status);
    }

    // ngày tạo
    if (date_from) { where.push("d.created_at >= ?"); params.push(`${date_from} 00:00:00`); }
    if (date_to)   { where.push("d.created_at <= ?"); params.push(`${date_to} 23:59:59`); }

    // method (map từ cột thật) — lọc ở SQL để nhanh
    if (method !== "all") {
      where.push(`${methodExpr("d")} = ?`);
      params.push(method);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // Đếm tổng
    const totalRow = await dbGet(
      `SELECT COUNT(*) AS n
         FROM donations d
         LEFT JOIN users u ON u.id = d.user_id
       ${whereSQL}`,
      params
    );

    // Lấy trang
    const rows = await dbAll(
      `
      SELECT
        d.id,
        d.created_at,
        d.paid_at,
        d.amount,
        d.status,
        ${methodExpr("d")}                AS method,
        COALESCE(d.bank_txn_id, d.order_id, '') AS reference,
        d.user_id                         AS payer_id,
        COALESCE(d.donor_name, u.name, u.email, '') AS payer_name,
        d.campaign_id,
        c.title                           AS campaign_title,
        d.bank_code,
        d.bank_account,
        d.order_id,
        d.bank_txn_id
      FROM donations d
      LEFT JOIN users u     ON u.id = d.user_id
      LEFT JOIN campaigns c ON c.id = d.campaign_id
      ${whereSQL}
      ORDER BY d.${sortCol} ${ord}
      LIMIT ${ps} OFFSET ${offset}
      `,
      params
    );

    res.json({
      items: rows,
      total: Number(totalRow?.n || 0),
      page: p,
      pageSize: ps,
      sum_page_amount: rows.reduce((a, b) => a + Number(b.amount || 0), 0),
    });
  } catch (e) {
    console.error("[admin.payments] LIST error:", e);
    res.status(500).json({ ok: false, message: e.message || "Server error" });
  }
});

/* ================= EXPORT CSV ================= */
router.get("/payments/export", async (_req, res) => {
  try {
    const rows = await dbAll(
      `
      SELECT
        d.id, d.created_at, d.paid_at, d.amount, d.status,
        ${methodExpr("d")} AS method,
        COALESCE(d.bank_txn_id, d.order_id, '') AS reference,
        d.user_id AS payer_id,
        d.donor_name AS payer_name,
        d.campaign_id
      FROM donations d
      ORDER BY d.created_at DESC
      LIMIT 10000
      `
    );

    const header = [
      "id","created_at","paid_at","payer_id","payer_name",
      "campaign_id","amount","method","status","reference"
    ];

    const esc = (v) => {
      if (v == null) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const body = rows.map(r => header.map(k => esc(r[k])).join(",")).join("\n");
    const csv = header.join(",") + "\n" + body + "\n";

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=payments.csv");
    res.send("\uFEFF" + csv);
  } catch (e) {
    console.error("[admin.payments] EXPORT error:", e);
    res.status(500).json({ ok: false, message: e.message || "Server error" });
  }
});
/* ---------- DEBUG (tạm thời) ---------- */
router.get("/_debug/payments-ping", async (_req, res) => {
  try {
    const [dbNameRow] = await db.query("SELECT DATABASE() AS dbname");
    const dbname = dbNameRow?.[0]?.dbname || dbNameRow?.dbname || null;

    const [cntRows] = await db.query("SELECT COUNT(*) AS n FROM donations");
    const n = cntRows?.[0]?.n ?? cntRows?.n ?? 0;

    const [sampleRows] = await db.query(
      "SELECT id, created_at, amount, status, donor_name, bank_code, order_id FROM donations ORDER BY created_at DESC LIMIT 3"
    );

    res.json({
      ok: true,
      driver: "mysql (forced)",
      database: dbname,
      donations_count: n,
      sample: sampleRows || [],
    });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default router;
