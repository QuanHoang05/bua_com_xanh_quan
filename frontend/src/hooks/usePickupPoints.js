import { useState, useEffect, useMemo, useCallback } from "react";
import { apiGet } from "../lib/api";

const toNum = (v) => (v == null || v === "" ? null : Number(v));

const haversineKm = (a, b) => {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const ra =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(ra)));
};

export function usePickupPoints() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [myLoc, setMyLoc] = useState(null);
  const [geoError, setGeoError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        let res = await apiGet("/api/pickup-points?active=1").catch(() => null);
        if (!res) {
          const s = await apiGet("/api/site-settings?key=pickup_points").catch(() => null);
          res = s?.value || s?.items || [];
        }
        if (!Array.isArray(res)) res = res?.items ?? res?.value ?? [];
        if (!Array.isArray(res)) res = [];

        const normalized = res
          .map((p) => ({
            id: p.id ?? p.point_id ?? p.code ?? Math.random().toString(36).slice(2),
            name: p.name ?? p.title ?? "Điểm nhận",
            address: p.address ?? p.location ?? "",
            lat: toNum(p.lat ?? p.latitude),
            lng: toNum(p.lng ?? p.longitude),
            open_hours: p.open_hours ?? p.opening ?? p.hours ?? "",
            status: p.status ?? (p.active ? "active" : "inactive"),
          }))
          .filter((p) => (p.status || "active") === "active");

        if (mounted) setPoints(normalized);
      } catch {
        if (mounted) {
          setPoints([]);
          setError("Không tải được điểm nhận.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const nearest = useMemo(() => {
    if (!points?.length) return [];
    return points
      .map((p) => ({ ...p, _distance: myLoc ? haversineKm(myLoc, p) : null }))
      .sort((a, b) => (a._distance ?? Infinity) - (b._distance ?? Infinity))
      .slice(0, 8);
  }, [points, myLoc]);

  const getMyLocation = useCallback(() => {
    setGeoError("");
    if (!navigator?.geolocation) {
      setGeoError("Trình duyệt không hỗ trợ Geolocation.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const crd = pos?.coords;
        if (crd) setMyLoc({ lat: crd.latitude, lng: crd.longitude });
      },
      (err) => setGeoError(err?.message || "Không lấy được vị trí."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  return { points, loading, error, myLoc, geoError, getMyLocation, nearest };
}