import { useState, useMemo, useCallback } from "react";
import { apiGet } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

const toNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const pick = (obj, paths, fb = undefined) => {
  for (const p of paths) {
    const val = p?.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);
    if (val !== undefined && val !== null) return val;
  }
  return fb;
};
const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));

function normalizeFood(x) {
  return {
    id: x.id ?? x._id,
    title: pick(x, ["title", "name"], "Món ăn"),
    description: pick(x, ["description", "desc"], ""),
    qty: toNum(pick(x, ["qty", "quantity"], 0)),
    unit: pick(x, ["unit"], ""),
    expire_at: pick(x, ["expire_at", "expires_at"], null),
    tags: x.tags || [],
    images: x.images || [],
    distance_km: typeof x.distance_km === "number" ? x.distance_km : null,
    location_addr: pick(x, ["location.addr", "address"]),
    diet_match: !!x.diet_match,
    reco_score: typeof x.reco_score === "number" ? x.reco_score : null,
    donor_id: pick(x, ["donor.id", "user.id", "owner_id", "donor_id"], null),
    donor_name: pick(x, ["donor.name", "user.name", "owner_name", "donor_name"], null),
    donor_avatar: pick(x, ["donor.avatar", "user.avatar", "avatar"], null),
  };
}

function groupFoods(items = []) {
  const map = new Map();
  for (const f of items) {
    const donorKey = f.donor_id || (f.donor_name ? `n:${f.donor_name}` : "");
    const key = `${donorKey}|${(f.title || "").trim().toLowerCase()}|${(f.unit || "").trim().toLowerCase()}`;
    const ex = map.get(key);
    if (!ex) {
      map.set(key, { ...f });
    } else {
      ex.qty = toNum(ex.qty, 0) + toNum(f.qty, 0);
      const t1 = f.expire_at ? new Date(f.expire_at).getTime() : Infinity;
      const t2 = ex.expire_at ? new Date(ex.expire_at).getTime() : Infinity;
      ex.expire_at = (Math.min(t1, t2) !== Infinity) ? new Date(Math.min(t1, t2)).toISOString() : null;
      ex.distance_km = typeof ex.distance_km === "number" && typeof f.distance_km === "number" ? Math.min(ex.distance_km, f.distance_km) : (ex.distance_km ?? f.distance_km ?? null);
      ex.tags = uniq([...(ex.tags || []), ...(f.tags || [])]);
      ex.images = uniq([...(ex.images || []), ...(f.images || [])]);
      map.set(key, ex);
    }
  }
  return Array.from(map.values());
}

export function useFoodRecommendations() {
  const t = useToast();
  const [latlng, setLatlng] = useState({ lat: null, lng: null });
  const [filters, setFilters] = useState({ maxKm: 5, diet: "any", sort: "priority", personalize: true, merge: true });
  const [reco, setReco] = useState({ items: [], ok: true, msg: "" });
  const [loading, setLoading] = useState(false);

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) { t.error("Trình duyệt không hỗ trợ định vị."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatlng({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        t.success("Đã lấy vị trí của bạn.");
      },
      () => t.error("Không lấy được vị trí. Hãy cấp quyền cho trình duyệt."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [t]);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        maxKm: String(filters.maxKm),
        diet: filters.diet,
        personalize: String(filters.personalize),
        sort: filters.sort,
        limit: "50",
        lat: latlng.lat ?? "",
        lng: latlng.lng ?? "",
      }).toString();
      const data = await apiGet(`/api/reco/foods?${qs}`);
      const arr = Array.isArray(data) ? data : data?.items || [];
      const normalized = arr.map(normalizeFood);
      setReco({
        items: filters.merge ? groupFoods(normalized) : normalized,
        ok: true,
        msg: ""
      });
      t.info("Đã cập nhật gợi ý phù hợp.");
    } catch {
      setReco({ items: [], ok: false, msg: "Không lấy được gợi ý." });
      t.error("Không lấy được gợi ý. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  }, [filters, latlng, t]);

  const displayItems = useMemo(() => {
    return filters.merge ? groupFoods(reco.items) : reco.items;
  }, [reco.items, filters.merge]);

  return { latlng, getLocation, filters, setFilter, loading, reco, fetchRecommendations, displayItems };
}