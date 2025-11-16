import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useToast } from "../components/ui/Toast";
import { apiGet, apiPatch, apiPost } from "../lib/api";

/* ---------------- Endpoints ---------------- */
const LIST_URL = (status, q) => {
  const sp = new URLSearchParams();
  sp.set("status", status || "active");
  if (q?.trim()) sp.set("q", q.trim());
  return `/api/shipper/deliveries?${sp.toString()}`;
};
const PATCH_URL = (id) => `/api/shipper/deliveries/${id}`;
const POD_URL = (id) => `/api/shipper/deliveries/${id}/proof`;

/* ---------------- Donation helpers ---------------- */
const isDonation = (d) =>
  !!d && (
    d.kind === "donation" ||
    d.type === "donation" ||
    d.is_donation === true ||
    d.source === "donor"
  );

const getMealQty = (d) => {
  const n = Number(d?.qty ?? d?.booking_qty ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const INC_CAMPAIGN_MEALS_URL = (campaignId) =>
  `/api/campaigns/${campaignId}/meals/increment`;

export function useDeliveries() {
  const t = useToast();
  const [status, setStatus] = useState("active");
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("status", status);
    if (q.trim()) sp.set("q", q.trim());
    return sp.toString();
  }, [status, q]);

  const load = useCallback(async (currentSelectionId) => {
    setLoading(true);
    let newSelection = null;
    try {
      const res = await apiGet(LIST_URL(status, q));
      const list = Array.isArray(res?.items) ? res.items : [];
      setItems(list);
      if (currentSelectionId) {
        newSelection = list.find((d) => d.id === currentSelectionId) || list[0] || null;
      } else {
        newSelection = list[0] || null;
      }
    } catch {
      t.error("Không tải được danh sách đơn");
      setItems([]);
    } finally {
      setLoading(false);
    }
    return newSelection;
  }, [status, q, t]);

  const timerRef = useRef(null);
  useEffect(() => {
    if (!auto || status !== "active") {
      timerRef.current && clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => load(), 5000);
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [auto, status, load]);

  async function recordDonationToCampaign(d) {
    try {
      if (!isDonation(d)) return;
      const cid = d.campaign_id || d.campaignId;
      const qty = getMealQty(d);
      if (!cid || !qty) return;
      await apiPost(INC_CAMPAIGN_MEALS_URL(cid), {
        delta: qty,
        reason: "donation_delivery",
        delivery_id: d.id
      });
      t.success(`Đã cộng ${qty} suất vào chiến dịch.`);
    } catch {
      t.info("Không cộng được suất vào chiến dịch (BE chưa bật hoặc lỗi).");
    }
  }

  const updateStatus = useCallback(async (id, next, currentItems) => {
    try {
      await apiPatch(PATCH_URL(id), { status: next });
      t.success(`Đã cập nhật: ${next}`);
      if (next === "delivered") {
        const d = currentItems.find((x) => x.id === id);
        if (d) await recordDonationToCampaign(d);
      }
    } catch (e) {
      const m = String(e?.message || "");
      t.error(m.includes("invalid_transition") ? "Chuyển trạng thái không hợp lệ." : (e.message || "Không cập nhật được"));
    }
  }, [t]);

  return {
    items, loading, status, setStatus, q, setQ, auto, setAuto,
    load, updateStatus, recordDonationToCampaign,
  };
}