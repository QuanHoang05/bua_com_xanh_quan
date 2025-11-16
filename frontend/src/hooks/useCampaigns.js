import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { apiGet } from "@/lib/api";
import { normalizeCampaign } from "@/lib/campaignUtils";

const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

function useDebounced(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export function useCampaigns() {
  const location = useLocation();
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [filters, setFilters] = useState({ diet: false, expiring: false, activeOnly: true });

  const [gateways, setGateways] = useState([]);
  const [mealPrice, setMealPrice] = useState(10000);

  const debouncedQ = useDebounced(q);

  // Load campaigns and settings
  useEffect(() => {
    let isMounted = true;
    const ac = new AbortController();

    const loadData = async () => {
      try {
        setError("");
        setLoading(true);
        
        // Fetch campaigns
        const data = await apiGet("/api/campaigns?status=active&page=1&pageSize=1000", { signal: ac.signal });
        const arr = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        if (isMounted) setRaw(arr);

        // Fetch site settings in parallel
        try {
          const feeRes = await apiGet("/api/site-settings?key=meal_price_vnd", { signal: ac.signal }).catch(() => null);
          const v = Number(feeRes?.value ?? feeRes?.items);
          if (isMounted && Number.isFinite(v) && v > 0) setMealPrice(v);

          let gws = await apiGet("/api/payments/gateways", { signal: ac.signal }).catch(() => null);
          if (!gws) {
            const s = await apiGet("/api/site-settings?key=payment_gateways", { signal: ac.signal }).catch(() => null);
            gws = s?.value || s?.items || [];
          }
          if (isMounted) {
            let gatewaysList = Array.isArray(gws) ? gws.map(x => (typeof x === "string" ? { code: x, name: x } : x)).filter(x => x && (x.enabled === undefined || x.enabled)) : [];
            if (gatewaysList.length === 0) gatewaysList = [{ code: "momo", name: "MoMo (Sandbox)" }];
            setGateways(gatewaysList);
          }
        } catch {}

      } catch (e) {
        if (e?.name !== "AbortError" && isMounted) {
          setError(e?.message || "Không thể tải danh sách chiến dịch.");
          setRaw([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; ac.abort(); };
  }, [location.key]);

  // Memoized list processing
  const list = useMemo(() => {
    const pct = (c) => {
      const raised = toNum(c.raised_amount || c.raised, 0);
      const goal = toNum(c.target_amount || c.goal, 0);
      return Math.min(100, Math.round((raised / (goal || 1)) * 100));
    };
    const daysLeft = (c) => (c.deadline ? Math.ceil((new Date(c.deadline) - new Date()) / 86400000) : Infinity);

    let arr = raw.map((r) => normalizeCampaign(r, mealPrice));
    if (debouncedQ) arr = arr.filter(c => (c.title || "").toLowerCase().includes(debouncedQ.toLowerCase()));
    if (filters.activeOnly) arr = arr.filter(c => (c.status || "active") === "active");
    if (sortBy === "progress") arr.sort((a, b) => pct(b) - pct(a));
    else if (sortBy === "newest") arr.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    
    return arr;
  }, [raw, mealPrice, debouncedQ, filters, sortBy]);

  return { list, loading, error, q, setQ, sortBy, setSortBy, filters, setFilters, gateways, mealPrice };
}