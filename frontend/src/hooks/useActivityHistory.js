import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../lib/api';
import { useToast } from '../components/ui/Toast';

// --- Normalization Helpers (can be moved to a utils file) ---
const pickAmount = (...vals) => {
  for (const v of vals) if (v != null && !Number.isNaN(Number(v))) return Number(v);
  return null;
};

const pickInt = (...vals) => {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0) return n;
  }
  return null;
};

const normalizeGiven = (arr) => {
  return (Array.isArray(arr) ? arr : []).map((x, i) => {
    const id = x.id || x.delivery_id || x.item_id || `g-${i}`;
    const title = x.title || x.item_title || x.dropoff_name || x.name || "Đã cho";
    const qty = pickInt(x.qty, x.quantity);
    const timeText = x.delivered_at || x.arrived_at || x.created_at || x.at || "";
    const status = x.status || (x.delivered_at ? "delivered" : x.state);
    const sub = x.dropoff_address || x.address || undefined;
    return { id, title, qty, status, timeText, sub };
  });
};

const normalizeReceived = (arr) => {
  return (Array.isArray(arr) ? arr : []).map((x, i) => {
    const id = x.id || x.booking_id || `r-${i}`;
    const title = x.title || x.item_title || x.pickup_name || x.name || "Đã nhận";
    const qty = pickInt(x.qty, x.quantity);
    const timeText = x.completed_at || x.delivered_at || x.created_at || x.at || "";
    const status = x.status || (x.completed_at ? "completed" : x.state);
    const sub = x.pickup_address || x.dropoff_address || x.address || undefined;
    return { id, title, qty, status, timeText, sub };
  });
};

const normalizePayments = (arr) => {
  return (Array.isArray(arr) ? arr : []).map((x, i) => {
    const id = x.id || x.payment_id || `p-${i}`;
    const amountVND = pickAmount(x.amount, x.amount_vnd, x.value);
    const rawStatus = (x.status || "").toLowerCase();
    const status = rawStatus === "success" ? "success" : rawStatus; // unify
    const timeText = x.created_at || x.paid_at || x.at || "";
    const orderShort = (x.order_id && String(x.order_id).slice(0, 6)) || (x.booking_id && String(x.booking_id).slice(0, 6)) || null;
    const title = x.title || (orderShort ? `#${orderShort}` : "Giao dịch");
    const sub = x.provider ? `Cổng: ${String(x.provider).toUpperCase()}` : (x.currency ? `Tiền tệ: ${x.currency}` : undefined);
    return { id, title, amountVND, status, timeText, sub };
  });
};

export function useActivityHistory() {
  const t = useToast();
  const [history, setHistory] = useState({ given: [], received: [], payments: [] });
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiGet("/api/users/history?limit=8");
      const hist = {
        given: normalizeGiven(data?.given ?? []),
        received: normalizeReceived(data?.received ?? []),
        payments: normalizePayments(data?.payments ?? data?.donations ?? []),
      };
      setHistory(hist);
    } catch (e) {
      t.error("Không tải được lịch sử hoạt động");
      setHistory({ given: [], received: [], payments: [] });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return { history, isLoading };
}