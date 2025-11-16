import { useState, useEffect, useMemo } from "react";
import { apiGet } from "../lib/api";

const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

async function fetchSupportersFlexible(campaignId) {
  try {
    const r1 = await apiGet(`/api/campaigns/${campaignId}/donations?page=1&pageSize=200`);
    if (r1) return r1.items ?? r1.value ?? r1.data ?? r1;
  } catch { }
  return [];
}

function normalizeSupporter(x) {
  const amount = toNum(x.amount ?? x.value ?? x.money ?? x.total, 0);
  const name = (x.donor_name ?? x.name ?? x.full_name ?? x.display_name ?? "Ẩn danh").toString();
  const message = x.donor_note ?? x.message ?? x.note ?? x.memo ?? "";
  const at = x.paid_at ?? x.created_at ?? x.time ?? x.date ?? x.updated_at ?? null;
  const anon = false; // BE đã ẩn tên khi cần
  const avatar = x.avatar_url ?? x.avatar ?? "";
  return { id: x.id ?? Math.random().toString(36).slice(2), name, message, amount, at, anonymous: anon, avatar };
}

export function useSupporters(campaignId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!campaignId) {
      setItems([]);
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const raw = await fetchSupportersFlexible(campaignId);
        let arr = Array.isArray(raw) ? raw : raw?.items ?? [];
        if (!Array.isArray(arr)) arr = [];
        const normalized = arr.map(normalizeSupporter);
        if (mounted) setItems(normalized);
      } catch (e) {
        if (mounted) setError(e?.message || "Không tải được danh sách ủng hộ.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [campaignId]);

  const total = useMemo(() => items.reduce((s, x) => s + (x.amount || 0), 0), [items]);

  return { items, total, loading, error };
}