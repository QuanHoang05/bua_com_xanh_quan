// backend/src/routes/admincampaigns.js
// ESM, MySQL/SQLite compatible — campaigns CRUD + donations APIs in one file.

import { Router } from "express";
import crypto from "crypto";
import "dotenv/config";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const useMySQL = (process.env.DB_DRIVER || "sqlite").toLowerCase() === "mysql";
let db;
if (useMySQL) ({ db } = await import("../lib/db.js"));
else ({ db } = await import("../lib/db.js"));

/* =============== utils =============== */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const safe = (v, d = "") => (v == null ? d : String(v));
const parseJson = (raw, fb = {}) => {
  try {
    if (!raw) return fb;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return fb;
  }
};
const normalizeTags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const p = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
};

async function dbGet(sql, params = []) {
  if (useMySQL) {
    if (typeof db.get === "function") return await db.get(sql, params);
    const [rows] = await db.query(sql, params);
    return rows?.[0] ?? null;
  }
  return db.prepare(sql).get(...params);
}
async function dbAll(sql, params = []) {
  if (useMySQL) {
    if (typeof db.all === "function") return await db.all(sql, params);
    const [rows] = await db.query(sql, params);
    return rows ?? [];
  }
  return db.prepare(sql).all(...params);
}
async function dbRun(sql, params = []) {
  if (useMySQL) {
    if (typeof db.run === "function") return await db.run(sql, params);
    const [result] = await db.query(sql, params);
    return result;
  }
  return db.prepare(sql).run(...params);
}

/* =============== Map row -> FE =============== */
function mapCampaignRow(r) {
  const meta = parseJson(r.meta, {});
  const type = String(r.type ?? meta?.type ?? "money");
  const goal = toNum(r.target_amount ?? r.goal, 0);
  const raised = toNum(r.raised_amount ?? r.raised, 0);
  const supporters = toNum(r.supporters, 0);
  const meal_price = toNum(r.meal_price, 0);
  const meal_received_qty = toNum(r.meal_received_qty, 0);

  if (!meta.meal) meta.meal = {};
  if (toNum(meta.meal.received_qty, -1) !== meal_received_qty)
    meta.meal.received_qty = meal_received_qty;
  if (toNum(meta.meal.price, -1) !== meal_price) meta.meal.price = meal_price;

  return {
    id: r.id,
    title: r.title,
    description: r.description,
    location: r.location,
    status: r.status,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deadline: r.deadline,
    cover_url: r.cover_url || r.cover || "",
    goal,
    raised,
    target_amount: goal,
    raised_amount: raised,
    supporters,
    type,
    meal_price,
    meal_unit: meta?.meal?.unit || "phần",
    meal_target_qty: toNum(meta?.meal?.target_qty, 0),
    meal_received_qty,
    meta,
    payment_method: meta?.payment?.method || "momo",
    payment: meta?.payment || null,
    tags: normalizeTags(r.tags),
  };
}

/* =============== SQL order =============== */
function buildOrderSQL(sort) {
  switch ((sort || "latest").toLowerCase()) {
    case "progress":
      return `CASE WHEN COALESCE(target_amount,0)>0
                THEN (COALESCE(raised,raised_amount,0)*1.0/NULLIF(target_amount,0))
                ELSE 0 END DESC, created_at DESC`;
    case "goal":
      return `target_amount DESC, created_at DESC`;
    case "endsoon":
      return `CASE WHEN deadline IS NULL THEN 1 ELSE 0 END ASC, deadline ASC, created_at DESC`;
    case "latest":
    default:
      return `created_at DESC`;
  }
}

/* ======================================================================
   Campaigns router (default export)  -> mount at /api/admin/campaigns
   ====================================================================== */
const router = Router();

/* ---- GET / (list) ---- */
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
    const params = [];
    if (q.length > 200) {
      return res.status(400).json({ ok: false, message: "Query too long" });
    }
    if (q) {
      where.push(
        "(c.title LIKE ? OR c.description LIKE ? OR c.location LIKE ?)"
      );
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status !== "all") {
      where.push("c.status=?");
      params.push(status);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const orderSQL = buildOrderSQL(sort);

    let totalRow, rows;
    try {
      totalRow = await dbGet(
        `SELECT COUNT(*) AS total FROM campaigns ${whereSQL}`,
        params
      );
      rows = await dbAll(
        `
        SELECT c.id, c.owner_id, c.title, c."type", c.location,
               goal, raised, supporters, tags, meta, cover, status,
               created_at, description, cover_url,
               target_amount, raised_amount, updated_at, deadline,
               meal_price, meal_received_qty
        FROM campaigns c
        ${whereSQL}
        ORDER BY ${orderSQL}
        LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );
    } catch (err) {
      return res.status(400).json({ ok: false, message: "Invalid query" });
    }

    res.json({
      ok: true,
      items: rows.map(mapCampaignRow),
      total: toNum(totalRow?.total, 0),
      page,
      pageSize,
    });
  } catch (err) {
    res.status(400).json({ ok: false, message: "Invalid request" });
  }
});

/* ---- GET /:id ---- */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const row = await dbGet(
      `SELECT id, owner_id, title, \`type\`, location,
              goal, raised, supporters, tags, meta, cover, status,
              created_at, description, cover_url,
              target_amount, raised_amount, updated_at, deadline,
              meal_price, meal_received_qty
       FROM campaigns WHERE id=?`,
      [id]
    );
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    res.json({ ok: true, ...mapCampaignRow(row) });
  } catch (err) {
    console.error("[GET /api/admin/campaigns/:id] error:", err);
    res.status(500).json({ ok: false, message: "Không lấy được chiến dịch" });
  }
});

/* ---------- helper: điều kiện lọc các MEAL chờ duyệt ---------- */
function mealWaitingSQLParts() {
  // In-kind: type IN ('food','goods') hoặc qty > 0
  // Status chờ duyệt: pledged | scheduled | pending
  const isMealExpr = "(LOWER(type) IN ('food','goods') OR COALESCE(qty,0) > 0)";
  const waitingExpr = "(LOWER(status) IN ('pledged','scheduled','pending'))";
  return { isMealExpr, waitingExpr };
}

/* ---- GET /:id/donations ---- */
router.get("/:id/donations", async (req, res) => {
  try {
    const id = req.params.id;
    const rawStatus = (req.query.status || "success").toString().toLowerCase();
    const kind = (req.query.kind || "all").toString().toLowerCase(); // meal|money|all
    const scope = (req.query.scope || "").toString().toLowerCase(); // waiting_meal
    const limit = clamp(parseInt(req.query.limit) || 500, 1, 1000);
    const offset = clamp(parseInt(req.query.offset) || 0, 0, 1e9);

    // Alias: status=pending_meal <=> scope=waiting_meal
    const effectiveScope =
      scope || (rawStatus === "pending_meal" ? "waiting_meal" : "");

    const where = ["campaign_id=?"];
    const params = [id];

    // kind filter
    if (kind === "meal")
      where.push("(LOWER(type) IN ('food','goods') OR COALESCE(qty,0) > 0)");
    else if (kind === "money")
      where.push(
        "(LOWER(type)='money' OR (COALESCE(qty,0)=0 AND COALESCE(amount,0)>0))"
      );

    // scope waiting_meal
    if (effectiveScope === "waiting_meal") {
      const { isMealExpr, waitingExpr } = mealWaitingSQLParts();
      where.push(`${isMealExpr} AND ${waitingExpr}`);
    } else {
      // status handling
      if (rawStatus && rawStatus !== "all" && rawStatus !== "pending_meal") {
        // Nếu FE truyền status=pending và kind=meal -> hiểu là chờ duyệt (pledged|scheduled|pending)
        if (rawStatus === "pending" && kind === "meal") {
          const { isMealExpr, waitingExpr } = mealWaitingSQLParts();
          where.push(`${isMealExpr} AND ${waitingExpr}`);
        } else {
          where.push("LOWER(status)=?");
          params.push(rawStatus);
        }
      }
    }

    const items = await dbAll(
      `SELECT id, campaign_id, order_id, type, amount, qty, currency,
              donor_name, donor_note, bank_txn_id, memo,
              status, paid_at, created_at
       FROM donations
       WHERE ${where.join(" AND ")}
       ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const safeItems = items.map((it) => ({
      id: it.id,
      order_id: it.order_id || "",
      type: it.type || (toNum(it.qty, 0) > 0 ? "food" : "money"),
      amount: Number(it.amount ?? 0),
      qty: toNum(it.qty, 0),
      currency: it.currency || "VND",
      donor_name: it.donor_name || "Ẩn danh",
      donor_note: it.donor_note || "",
      paid_at: it.paid_at || it.created_at,
      memo: it.memo || "",
      bank_txn_id: it.bank_txn_id || "",
      status: it.status || "pending",
      created_at: it.created_at,
      campaign_id: it.campaign_id,
    }));
    res.json({ ok: true, items: safeItems });
  } catch (err) {
    console.error("[GET /api/admin/campaigns/:id/donations] error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Không lấy được danh sách ủng hộ" });
  }
});

/* ---- helper: build default meta ---- */
function buildMeta(c = {}) {
  const paymentMethod = c.payment?.method || c.payment_method || "momo";
  const payment =
    paymentMethod === "momo"
      ? { method: "momo" }
      : paymentMethod === "custom_qr"
      ? {
          method: "custom_qr",
          qr_url: c.payment?.qr_url || c.payment_qr_url || "",
        }
      : {
          method: "vietqr",
          bank: c.payment?.bank || c.payment_bank || "",
          account: c.payment?.account || c.payment_account || "",
          name: c.payment?.name || c.payment_name || "",
          memo: c.payment?.memo || c.payment_memo || "",
          qr_url: c.payment?.qr_url || c.payment_qr_url || "",
        };

  return {
    type: (c.type || c.meta?.type || "money").toString(),
    start_at: c.start_at ?? c.meta?.start_at ?? null,
    end_at: c.end_at ?? c.meta?.end_at ?? null,
    payment,
    meal: {
      unit: c.meal_unit || c.meta?.meal?.unit || "phần",
      target_qty: toNum(c.meal_target_qty ?? c.meta?.meal?.target_qty, 0),
      received_qty: toNum(c.meal_received_qty ?? c.meta?.meal?.received_qty, 0),
      wish: c.meal_wish || c.meta?.meal?.wish || "",
      price: toNum(c.meal_price ?? c.meta?.meal?.price, 10000),
    },
    ledger: { enabled: true },
  };
}

/* ---- POST / (create) ---- */
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const c = req.body || {};
    const sqliteId = !useMySQL ? c.id || crypto.randomUUID() : null;

    const metaObj = c.meta != null ? c.meta : buildMeta(c);
    const tags = Array.isArray(c.tags) ? c.tags : [];

    const target = toNum(c.target_amount ?? c.goal, 0);
    const raised = toNum(c.raised_amount ?? c.raised, 0);
    const mealQty = toNum(
      c.meal_received_qty ?? metaObj?.meal?.received_qty,
      0
    );
    const mealPrice = toNum(c.meal_price ?? metaObj?.meal?.price, 10000);

    const sql = `
      INSERT INTO campaigns (${useMySQL ? "" : "id,"}
        owner_id, title, \`type\`, location,
        goal, raised, supporters,
        tags, meta, cover, status,
        created_at, description, cover_url,
        target_amount, raised_amount, updated_at, deadline,
        meal_price, meal_received_qty
      )
      VALUES (${useMySQL ? "" : "?,"}
        ?,?,?,?,
        ?,?,?,
        ?,?,?,?,
        ${useMySQL ? "CURRENT_TIMESTAMP" : "datetime('now')"}, ?, ?,
        ?,?, NULL, ?,
        ?,?
      )`;

    const args = [];
    if (!useMySQL) args.push(sqliteId);
    args.push(
      c.owner_id || null,
      safe(c.title).trim(),
      (c.type || metaObj.type || "money").toString(),
      safe(c.location),
      target,
      raised,
      toNum(c.supporters, 0),
      JSON.stringify(tags),
      JSON.stringify(metaObj),
      safe(c.cover),
      safe(c.status, "draft"),
      safe(c.description),
      safe(c.cover_url ?? c.cover),
      target,
      raised,
      c.end_at ?? c.deadline ?? null,
      mealPrice,
      mealQty
    );

    const result = await dbRun(sql, args);
    const newId = useMySQL ? result?.insertId : sqliteId;

    const row = await dbGet(
      `SELECT id, owner_id, title, \`type\`, location,
              goal, raised, supporters, tags, meta, cover, status,
              created_at, description, cover_url,
              target_amount, raised_amount, updated_at, deadline,
              meal_price, meal_received_qty
       FROM campaigns WHERE id=?`,
      [newId]
    );
    res.status(201).json({ ok: true, ...mapCampaignRow(row) });
  } catch (err) {
    console.error("[POST /api/admin/campaigns] error:", err);
    res.status(500).json({ ok: false, message: "Tạo chiến dịch thất bại" });
  }
});

/* ---- PATCH /:id ---- */
router.patch("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;
    const cur = await dbGet("SELECT * FROM campaigns WHERE id=?", [id]);
    if (!cur) return res.status(404).json({ ok: false, message: "Not found" });

    const c = { ...cur, ...req.body };
    const curMeta = parseJson(cur.meta, {}) || {};
    const incomingMeta = c.meta != null ? c.meta : {};
    const mergedMeta = {
      ...curMeta,
      ...incomingMeta,
      type: (
        incomingMeta.type ||
        c.type ||
        cur.type ||
        curMeta.type ||
        "money"
      ).toString(),
      meal: { ...(curMeta.meal || {}), ...(incomingMeta.meal || {}) },
      payment: { ...(curMeta.payment || {}), ...(incomingMeta.payment || {}) },
      ledger: {
        enabled: true,
        ...(curMeta.ledger || {}),
        ...(incomingMeta.ledger || {}),
      },
    };
    if (c.meal_received_qty != null) {
      mergedMeta.meal = mergedMeta.meal || {};
      mergedMeta.meal.received_qty = toNum(c.meal_received_qty, 0);
    }

    const target = toNum(
      c.target_amount ?? c.goal ?? cur.target_amount ?? cur.goal,
      0
    );
    const raised = toNum(
      c.raised_amount ?? c.raised ?? cur.raised_amount ?? cur.raised,
      0
    );
    const mealQty = toNum(
      c.meal_received_qty ??
        mergedMeta?.meal?.received_qty ??
        cur.meal_received_qty,
      0
    );
    const mealPrice = toNum(c.meal_price ?? cur.meal_price, 10000);

    const nowSQL = useMySQL ? "CURRENT_TIMESTAMP" : "datetime('now')";
    await dbRun(
      `
      UPDATE campaigns SET
        owner_id=?,
        title=?, \`type\`=?, location=?,
        goal=?, raised=?, supporters=?,
        tags=?, meta=?, cover=?, status=?,
        description=?, cover_url=?,
        target_amount=?, raised_amount=?, updated_at=${nowSQL}, deadline=?,
        meal_price=?, meal_received_qty=?
      WHERE id=?`,
      [
        c.owner_id ?? cur.owner_id,
        safe(c.title ?? cur.title).trim(),
        (c.type ?? mergedMeta.type ?? cur.type ?? "money").toString(),
        safe(c.location ?? cur.location),
        target,
        raised,
        toNum(c.supporters ?? cur.supporters, 0),
        JSON.stringify(
          Array.isArray(c.tags) ? c.tags : normalizeTags(cur.tags)
        ),
        JSON.stringify(mergedMeta),
        safe(c.cover ?? cur.cover),
        safe(c.status ?? cur.status ?? "draft"),
        safe(c.description ?? cur.description),
        safe(c.cover_url ?? cur.cover_url ?? cur.cover),
        target,
        raised,
        c.end_at ?? c.deadline ?? cur.deadline ?? null,
        mealPrice,
        mealQty,
        id,
      ]
    );

    const row = await dbGet(
      `SELECT id, owner_id, title, \`type\`, location,
              goal, raised, supporters, tags, meta, cover, status,
              created_at, description, cover_url,
              target_amount, raised_amount, updated_at, deadline,
              meal_price, meal_received_qty
       FROM campaigns WHERE id=?`,
      [id]
    );
    res.json({ ok: true, ...mapCampaignRow(row) });
  } catch (err) {
    console.error("[PATCH /api/admin/campaigns/:id] error:", err);
    res
      .status(500)
      .json({ ok: false, message: "Cập nhật chiến dịch thất bại" });
  }
});

/* ---- DELETE /:id ---- */
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await dbRun("DELETE FROM campaigns WHERE id=?", [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error("[DELETE /api/admin/campaigns/:id] error:", err);
    res.status(500).json({ ok: false, message: "Xoá chiến dịch thất bại" });
  }
});

/* ---- recalc from donations ---- */
async function recalcCampaignFromDonations(campaignId) {
  const nowSQL = useMySQL ? "CURRENT_TIMESTAMP" : "datetime('now')";
  if (useMySQL) {
    try {
      await dbRun(`CALL recalc_campaign(?)`, [campaignId]);
    } catch {
      await dbRun(
        `UPDATE campaigns c
         LEFT JOIN (
            SELECT COALESCE(SUM(CASE WHEN status='success' THEN amount ELSE 0 END),0) AS sum_amount,
                   SUM(status='success') AS cnt
            FROM donations WHERE campaign_id = ?
         ) d ON TRUE
         SET c.raised = COALESCE(d.sum_amount,0),
             c.supporters = COALESCE(d.cnt,0)
         WHERE c.id = ?`,
        [campaignId, campaignId]
      );
    }
    const qtyRow = await dbGet(
      `SELECT COALESCE(SUM(qty),0) AS q
       FROM donations WHERE campaign_id=? AND status='success' AND COALESCE(qty,0)>0`,
      [campaignId]
    );
    const addQty = toNum(qtyRow?.q, 0);
    const moneyRow = await dbGet(
      `SELECT COALESCE(SUM(amount),0) AS s FROM donations
       WHERE campaign_id=? AND status='success' AND amount>0`,
      [campaignId]
    );
    const info = await dbGet(`SELECT meal_price FROM campaigns WHERE id=?`, [
      campaignId,
    ]);
    const moneyMeals = Math.floor(
      toNum(moneyRow?.s, 0) / Math.max(1, toNum(info?.meal_price, 10000))
    );

    await dbRun(
      `UPDATE campaigns SET meal_received_qty=?, updated_at=${nowSQL} WHERE id=?`,
      [moneyMeals + addQty, campaignId]
    );
    const row = await dbGet(
      `SELECT meta, meal_received_qty, meal_price FROM campaigns WHERE id=?`,
      [campaignId]
    );
    const meta = parseJson(row?.meta, {});
    if (!meta.meal) meta.meal = {};
    meta.meal.received_qty = toNum(row?.meal_received_qty, 0);
    meta.meal.price = toNum(row?.meal_price, 0);
    await dbRun(
      `UPDATE campaigns SET meta=?, updated_at=${nowSQL} WHERE id=?`,
      [JSON.stringify(meta), campaignId]
    );
  } else {
    const money = await dbGet(
      `SELECT COALESCE(SUM(amount),0) AS s FROM donations WHERE campaign_id=? AND status='success' AND amount>0`,
      [campaignId]
    );
    const cnt = await dbGet(
      `SELECT SUM(status='success') AS c FROM donations WHERE campaign_id=?`,
      [campaignId]
    );
    const meal = await dbGet(
      `SELECT COALESCE(SUM(qty),0) AS q FROM donations WHERE campaign_id=? AND status='success' AND qty>0`,
      [campaignId]
    );
    const info = await dbGet(`SELECT meal_price FROM campaigns WHERE id=?`, [
      campaignId,
    ]);
    const moneyMeals = Math.floor(
      toNum(money?.s, 0) / Math.max(1, toNum(info?.meal_price, 10000))
    );
    await dbRun(
      `UPDATE campaigns
         SET raised=?, supporters=?, meal_received_qty=?, updated_at=${nowSQL}
       WHERE id=?`,
      [
        toNum(money?.s, 0),
        toNum(cnt?.c, 0),
        moneyMeals + toNum(meal?.q, 0),
        campaignId,
      ]
    );
    const row = await dbGet(
      `SELECT meta, meal_received_qty, meal_price FROM campaigns WHERE id=?`,
      [campaignId]
    );
    const meta = parseJson(row?.meta, {});
    if (!meta.meal) meta.meal = {};
    meta.meal.received_qty = toNum(row?.meal_received_qty, 0);
    meta.meal.price = toNum(row?.meal_price, 0);
    await dbRun(
      `UPDATE campaigns SET meta=?, updated_at=${nowSQL} WHERE id=?`,
      [JSON.stringify(meta), campaignId]
    );
  }
}

/* ---- POST /:id/donations (manual add) ---- */
router.post(
  "/:id/donations",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const campaign_id = req.params.id;
      const {
        type = "money",
        amount = 0,
        qty = 0,
        currency = "VND",
        donor_name = "",
        donor_note = "",
        memo = "",
        paid_at = null,
        bank_txn_id = null,
        bank_code = null,
        bank_account = null,
        status = "success",
      } = req.body || {};

      const nowSQL = useMySQL ? "CURRENT_TIMESTAMP" : "datetime('now')";
      await dbRun(
        `INSERT INTO donations
        (order_id, campaign_id, user_id, type, amount, qty, currency,
         donor_name, donor_note, bank_txn_id, bank_code, bank_account, memo,
         status, paid_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ${nowSQL})`,
        [
          bank_txn_id || "",
          campaign_id,
          null,
          type,
          toNum(amount, 0),
          toNum(qty, 0),
          currency,
          donor_name || null,
          donor_note || null,
          bank_txn_id || null,
          bank_code || null,
          bank_account || null,
          memo || null,
          status,
          paid_at,
        ]
      );

      if (status === "success") await recalcCampaignFromDonations(campaign_id);
      res.status(201).json({ ok: true });
    } catch (err) {
      console.error("[POST /api/admin/campaigns/:id/donations] error:", err);
      res.status(500).json({ ok: false, message: "Thêm ủng hộ thất bại" });
    }
  }
);

/* ---- PATCH /:id/donations/:donationId ---- */
router.patch(
  "/:id/donations/:donationId",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const campaign_id = req.params.id;
      const donationId = req.params.donationId;

      const cur = await dbGet(
        `SELECT id, campaign_id, status FROM donations WHERE id=? AND campaign_id=?`,
        [donationId, campaign_id]
      );
      if (!cur)
        return res
          .status(404)
          .json({ ok: false, message: "Donation không tồn tại" });

      const nextStatus = (req.body?.status || cur.status || "").toLowerCase();
      const amount = req.body?.amount;
      const qty = req.body?.qty;

      const nowSQL = useMySQL ? "CURRENT_TIMESTAMP" : "datetime('now')";
      const sets = [],
        args = [];
      if (nextStatus) {
        sets.push("status=?");
        args.push(nextStatus);
      }
      if (amount != null) {
        sets.push("amount=?");
        args.push(toNum(amount, 0));
      }
      if (qty != null) {
        sets.push("qty=?");
        args.push(toNum(qty, 0));
      }
      if (nextStatus === "success")
        sets.push(`paid_at=COALESCE(paid_at, ${nowSQL})`);
      if (!sets.length) return res.json({ ok: true, noop: true });

      await dbRun(`UPDATE donations SET ${sets.join(", ")} WHERE id=?`, [
        ...args,
        donationId,
      ]);
      await recalcCampaignFromDonations(campaign_id);
      res.json({ ok: true });
    } catch (err) {
      console.error(
        "[PATCH /api/admin/campaigns/:id/donations/:donationId] error:",
        err
      );
      res
        .status(500)
        .json({ ok: false, message: "Cập nhật donation thất bại" });
    }
  }
);

/* ---- POST /:id/recalc ---- */
router.post(
  "/:id/recalc",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const id = req.params.id;
      await recalcCampaignFromDonations(id);
      const row = await dbGet(
        `SELECT id, owner_id, title, \`type\`, location,
              goal, raised, supporters, tags, meta, cover, status,
              created_at, description, cover_url,
              target_amount, raised_amount, updated_at, deadline,
              meal_price, meal_received_qty
       FROM campaigns WHERE id=?`,
        [id]
      );
      res.json({ ok: true, ...mapCampaignRow(row) });
    } catch (err) {
      console.error("[POST /api/admin/campaigns/:id/recalc] error:", err);
      res
        .status(500)
        .json({ ok: false, message: "Không recalc được chiến dịch" });
    }
  }
);

/* ======================================================================
   Donations router (named export) -> mount at /api/admin/donations
   ====================================================================== */
const donationsRouter = Router();

/* GET /api/admin/donations?status=&campaign_id=&kind=&scope=&order=&limit=&offset= */
donationsRouter.get(
  "/",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const rawStatus = String(req.query.status || "").toLowerCase();
      const campaignId = req.query.campaign_id
        ? String(req.query.campaign_id)
        : null;
      const kind = (req.query.kind || "all").toString().toLowerCase(); // meal|money|all
      const scope = (req.query.scope || "").toString().toLowerCase(); // waiting_meal
      const order =
        (req.query.order || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
      const limit = clamp(parseInt(req.query.limit) || 50, 1, 500);
      const offset = clamp(parseInt(req.query.offset) || 0, 0, 1e9);

      const where = [],
        params = [];
      if (campaignId) {
        where.push("campaign_id=?");
        params.push(campaignId);
      }

      // kind filter
      if (kind === "meal")
        where.push("(LOWER(type) IN ('food','goods') OR COALESCE(qty,0) > 0)");
      else if (kind === "money")
        where.push(
          "(LOWER(type)='money' OR (COALESCE(qty,0)=0 AND COALESCE(amount,0)>0))"
        );

      // scope alias
      const effectiveScope =
        scope || (rawStatus === "pending_meal" ? "waiting_meal" : "");

      if (effectiveScope === "waiting_meal") {
        const { isMealExpr, waitingExpr } = mealWaitingSQLParts();
        where.push(`${isMealExpr} AND ${waitingExpr}`);
      } else if (rawStatus) {
        // Nếu FE truyền status=pending & kind=meal => hiểu là chờ duyệt
        if (rawStatus === "pending" && kind === "meal") {
          const { isMealExpr, waitingExpr } = mealWaitingSQLParts();
          where.push(`${isMealExpr} AND ${waitingExpr}`);
        } else if (rawStatus !== "all" && rawStatus !== "pending_meal") {
          where.push("LOWER(status)=?");
          params.push(rawStatus);
        }
      }

      const rows = await dbAll(
        `SELECT id, campaign_id, order_id, type, amount, qty, currency,
              donor_name, donor_note, bank_txn_id, bank_code, bank_account, memo,
              status, paid_at, created_at
       FROM donations
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY COALESCE(paid_at, created_at) ${order}, id ${order}
       LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({ ok: true, items: rows });
    } catch (err) {
      console.error("[GET /api/admin/donations] error:", err);
      res.status(500).json({ ok: false, message: "Không lấy được donations" });
    }
  }
);

/* POST /api/admin/donations */
donationsRouter.post(
  "/",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const {
        campaign_id,
        type = "money",
        amount = 0,
        qty = 0,
        currency = "VND",
        donor_name = "",
        donor_note = "",
        memo = "",
        status = "success",
        paid_at = null,
        bank_txn_id = null,
        bank_code = null,
        bank_account = null,
        user_id = null,
        order_id = null,
      } = req.body || {};

      if (!campaign_id)
        return res
          .status(422)
          .json({ ok: false, message: "campaign_id là bắt buộc" });

      const nowSQL = useMySQL ? "CURRENT_TIMESTAMP" : "datetime('now')";
      await dbRun(
        `INSERT INTO donations
        (order_id, campaign_id, user_id, type, amount, qty, currency,
         donor_name, donor_note, bank_txn_id, bank_code, bank_account, memo,
         status, paid_at, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ${nowSQL})`,
        [
          order_id || bank_txn_id || "",
          campaign_id,
          user_id,
          type,
          toNum(amount, 0),
          toNum(qty, 0),
          currency,
          donor_name || null,
          donor_note || null,
          bank_txn_id || null,
          bank_code || null,
          bank_account || null,
          memo || null,
          status,
          paid_at,
        ]
      );

      if (status === "success") await recalcCampaignFromDonations(campaign_id);
      res.status(201).json({ ok: true });
    } catch (err) {
      console.error("[POST /api/admin/donations] error:", err);
      res.status(500).json({ ok: false, message: "Tạo donation thất bại" });
    }
  }
);

/* PATCH /api/admin/donations/:donationId */
donationsRouter.patch(
  "/:donationId",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const donationId = req.params.donationId;
      const cur = await dbGet(
        `SELECT id, campaign_id, status FROM donations WHERE id=?`,
        [donationId]
      );
      if (!cur)
        return res
          .status(404)
          .json({ ok: false, message: "Donation không tồn tại" });

      const next = (req.body?.status || cur.status || "").toLowerCase();
      const amount = req.body?.amount;
      const qty = req.body?.qty;

      const nowSQL = useMySQL ? "CURRENT_TIMESTAMP" : "datetime('now')";
      const sets = [],
        args = [];
      if (next) {
        sets.push("status=?");
        args.push(next);
      }
      if (amount != null) {
        sets.push("amount=?");
        args.push(toNum(amount, 0));
      }
      if (qty != null) {
        sets.push("qty=?");
        args.push(toNum(qty, 0));
      }
      if (next === "success") sets.push(`paid_at=COALESCE(paid_at, ${nowSQL})`);
      if (!sets.length) return res.json({ ok: true, noop: true });

      await dbRun(`UPDATE donations SET ${sets.join(", ")} WHERE id=?`, [
        ...args,
        donationId,
      ]);
      await recalcCampaignFromDonations(cur.campaign_id);
      res.json({ ok: true });
    } catch (err) {
      console.error("[PATCH /api/admin/donations/:donationId] error:", err);
      res
        .status(500)
        .json({ ok: false, message: "Cập nhật donation thất bại" });
    }
  }
);

export default router;
export { donationsRouter };
