// src/hooks/useDeliveries.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../lib/api";

function authHeader() {
  const t = localStorage.getItem("bua_token") || sessionStorage.getItem("bua_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function useDeliveries({ scope = "auto", booking_id = "", status = "", q = "", pageSize = 20 } = {}) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (scope) sp.set("scope", scope);
    if (booking_id) sp.set("booking_id", booking_id);
    if (status) sp.set("status", status);
    if (q) sp.set("q", q);
    sp.set("expand", "actors,route");
    sp.set("page", String(page));
    sp.set("pageSize", String(pageSize));
    return sp.toString();
  }, [scope, booking_id, status, q, page, pageSize]);

  const fetcher = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/deliveries?${qs}`, { headers: { ...authHeader() } });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      setItems(data.items || []);
      setTotal(Number(data.total || 0));
    } catch (e) {
      console.error(e);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => { fetcher(); }, [fetcher]);

  return {
    items, total, page, setPage, loading,
    refresh: fetcher,
  };
}
