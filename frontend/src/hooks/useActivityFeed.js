import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const pick = (obj, paths, fb = undefined) => {
  for (const p of paths) {
    const val = p?.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);
    if (val !== undefined && val !== null) return val;
  }
  return fb;
};

function normalizeDonation(x) {
  const name = pick(x, ["donor.name", "user.name", "donor_name", "name"], null) || "Ẩn danh";
  const status = (x.status || "success").toLowerCase();
  const qty = toNum(pick(x, ["qty", "quantity", "item.qty", "food.qty"], 0), 0);
  const hasItem = !!pick(x, ["item.title", "food.title", "item_title"]);
  const money = toNum(pick(x, ["amount", "money", "value"], 0), 0);
  const isMeal = hasItem || (money <= 0 && qty > 0);

  return {
    id: x.id ?? x._id,
    donor: name,
    amount: money,
    item_title: pick(x, ["item.title", "food.title", "item_title"]),
    qty,
    ok: status === "success" || status === "paid",
    isMeal,
  };
}

function normalizeTransaction(x) {
  const status = (pick(x, ["status", "state"], "pending") || "").toLowerCase();
  const ok = status === "paid" || status === "success";
  return {
    id: x.id ?? x._id,
    code: pick(x, ["code", "txn_code"], null),
    amount: toNum(pick(x, ["amount", "value"], 0)),
    ok,
  };
}

export function useActivityFeed() {
  const [topDonors, setTopDonors] = useState([]);
  const [recentDonations, setRecentDonations] = useState([]);
  const [recentTxns, setRecentTxns] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [lb, dons, txs] = await Promise.allSettled([
          apiGet("/api/leaderboard?type=donors&limit=5"),
          apiGet("/api/donations?limit=8"),
          apiGet("/api/transactions?limit=6"),
        ]);
        if (lb.status === "fulfilled") setTopDonors((lb.value?.items || lb.value || []).slice(0, 5));
        if (dons.status === "fulfilled") setRecentDonations((dons.value?.items || dons.value || []).map(normalizeDonation).filter(d => d.ok).slice(0, 6));
        if (txs.status === "fulfilled") setRecentTxns((txs.value?.items || txs.value || []).map(normalizeTransaction).filter(t => t.ok).slice(0, 6));
      } catch { /* no-op */ }
    })();
  }, []);

  return { topDonors, recentDonations, recentTxns };
}