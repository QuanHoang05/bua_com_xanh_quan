import { apiPost } from "./api";

const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const parseJson = (raw, fb = {}) => {
  try {
    return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : fb;
  } catch {
    return fb;
  }
};

export function buildVietQRUrl({ bank, account, name, memo, amount }) {
  if (!bank || !account) return "";
  const base = `https://img.vietqr.io/image/${encodeURIComponent(bank)}-${encodeURIComponent(account)}-compact2.jpg`;
  const p = new URLSearchParams();
  if (name) p.set("accountName", name);
  if (memo) p.set("addInfo", memo);
  if (amount && Number(amount) > 0) p.set("amount", String(amount));
  return `${base}?${p.toString()}`;
}

export function gatewaysForCampaign(campaign, globalGateways) {
  const m = (campaign?.payment_method || "").toLowerCase();
  if (m === "momo") return [{ code: "momo", name: "MoMo" }];
  if (m === "custom_qr") return [{ code: "custom_qr", name: "QR tải lên" }];
  if (m === "vietqr") return [{ code: "vietqr", name: "VietQR" }];
  const g = (globalGateways || []).map((x) => ({ ...x, code: (x.code || "").toLowerCase() }));
  return g.length ? g : [{ code: "momo", name: "MoMo" }];
}

export async function createPayment({ method, amount, campaign_id, orderInfo, extraData }) {
  const m = (method || "").toLowerCase();
  const body = {
    amount: Number(amount),
    orderInfo: orderInfo || "Ủng hộ",
    extraData: extraData || "",
    campaign_id,
    method: m || undefined,
  };
  if (m === "momo") {
    const res = await apiPost("/api/payments/momo/create", body);
    return {
      pay_url: res?.payUrl || res?.momoRaw?.deeplink || res?.momoRaw?.payUrl,
      qr_svg: res?.qr_svg,
      qr_image: res?.qr_image,
      raw: res,
    };
  }
  const res = await apiPost("/api/payments/create", body).catch(() => ({}));
  return { pay_url: res?.pay_url || res?.payUrl, qr_svg: res?.qr_svg, qr_image: res?.qr_image, raw: res };
}

export function normalizeCampaign(r, siteMealPrice = 10000) {
  const meta = parseJson(r.meta ?? r.tags, {});
  const type = r.type || meta?.type || "money";

  const raised = toNum(r.raised_amount ?? r.raised, 0);
  const supporters = toNum(r.supporters, 0);

  const mealFromApi = toNum(r.meal_received_qty, NaN);
  const fallbackMeals = Math.floor(raised / (toNum(meta?.meal?.price, siteMealPrice) || siteMealPrice));

  return {
    id: r.id,
    title: r.title || "",
    description: r.description || "",
    location: r.location || "",
    created_at: r.created_at,
    updated_at: r.updated_at,
    deadline: r.deadline || meta?.end_at || null,
    status: r.status || "active",
    target_amount: toNum(r.target_amount ?? r.goal, 0),
    raised_amount: raised,
    supporters,
    type,
    meal_unit: meta?.meal?.unit || "phần",
    meal_target_qty: toNum(meta?.meal?.target_qty, 0),
    meal_received_qty: Number.isFinite(mealFromApi) ? mealFromApi : fallbackMeals,
    meta,
    payment: meta?.payment || r.payment || null,
    payment_method: (meta?.payment?.method || r.payment_method || "momo").toLowerCase(),
    cover_url: r.cover_url || r.cover || "",
    tags: Array.isArray(r.tags) ? r.tags : [],
  };
}

export const isMealCampaign = (c = {}) => {
  const t = (c.type || c.kind || c.category || "").toString().toLowerCase();
  return t === "meal" || t.includes("meal") || t.includes("bữa");
};