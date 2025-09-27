// src/components/map/RouteMap.jsx
// Bản đồ chỉ đường + ETA cho shipper (layout tối ưu, controls đầy đủ)
// @react-google-maps/api + framer-motion
// ---------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer,
  TrafficLayer,
} from "@react-google-maps/api";
import { motion, AnimatePresence } from "framer-motion";

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const DEFAULT_CENTER = { lat: 10.776889, lng: 106.700806 }; // HCMC
const CONTAINER_STYLE = { width: "100%", height: "100%" };

// Giúp format thời gian/đoạn đường
function fmtDuration(sec) {
  if (!sec || sec <= 0) return "--";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h <= 0) return `${m} phút`;
  return `${h} giờ ${m} phút`;
}
const kmFmt = (m) => (m == null ? "--" : `${(m / 1000).toFixed(1)} km`);

// Lấy LatLng từ selected (ưu tiên lat/lng, fallback địa chỉ text)
function resolvePoint(obj, prefix) {
  if (!obj) return null;
  const lat = obj[`${prefix}_lat`] ?? obj[`${prefix}_latitude`] ?? null;
  const lng = obj[`${prefix}_lng`] ?? obj[`${prefix}_longitude`] ?? null;
  const text =
    obj[`${prefix}_address`] ||
    obj[`${prefix}_name`] ||
    obj[`${prefix}`] ||
    null;
  return {
    lat: lat != null ? Number(lat) : null,
    lng: lng != null ? Number(lng) : null,
    text: text || null,
  };
}

export default function RouteMap({ selected }) {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [me, setMe] = useState(null); // vị trí shipper
  const [dir, setDir] = useState(null);
  const [eta, setEta] = useState(null);
  const [travelMode, setTravelMode] = useState("DRIVING");
  const [showTraffic, setShowTraffic] = useState(true);
  const [error, setError] = useState("");

  const mapRef = useRef(null);
  const watchIdRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: MAPS_KEY || "",
    region: "VN",
    libraries: ["places"],
    id: "bua-com-xanh-maps",
  });

  // Theo dõi vị trí shipper
  useEffect(() => {
    let cancelled = false;

    if (!("geolocation" in navigator)) {
      setError("Trình duyệt không hỗ trợ GPS.");
      return;
    }

    // watchPosition để cập nhật liên tục
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(c);
        setCenter(c);
      },
      () => {
        // fallback lấy 1 lần
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setMe(c);
            setCenter(c);
          },
          () => setError((e) => e || "Không lấy được vị trí hiện tại."),
          { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 }
        );
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
    );

    return () => {
      cancelled = true;
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Tính route & ETA khi selected/me/travelMode thay đổi
  useEffect(() => {
    setDir(null);
    setEta(null);
    setError("");

    if (!isLoaded || !selected) return;

    const g = window.google;
    if (!g || !g.maps) return;

    const origin = me ? new g.maps.LatLng(me.lat, me.lng) : DEFAULT_CENTER;

    const pickup = resolvePoint(selected, "pickup");
    const dropoff = resolvePoint(selected, "dropoff");

    // Không có điểm đích -> bỏ
    if (!pickup?.lat && !pickup?.text && !dropoff?.lat && !dropoff?.text) {
      return;
    }

    const service = new g.maps.DirectionsService();
    const request = {
      origin,
      destination:
        (dropoff?.lat != null && dropoff?.lng != null
          ? new g.maps.LatLng(dropoff.lat, dropoff.lng)
          : dropoff?.text) ||
        (pickup?.lat != null && pickup?.lng != null
          ? new g.maps.LatLng(pickup.lat, pickup.lng)
          : pickup?.text) ||
        origin,
      waypoints:
        pickup?.text || (pickup?.lat != null && pickup?.lng != null)
          ? [
              {
                location:
                  pickup?.lat != null && pickup?.lng != null
                    ? new g.maps.LatLng(pickup.lat, pickup.lng)
                    : pickup?.text,
                stopover: true,
              },
            ]
          : undefined,
      optimizeWaypoints: true,
      travelMode: g.maps.TravelMode[travelMode],
      provideRouteAlternatives: false,
    };

    service.route(request, (res, st) => {
      if (st === "OK" && res) {
        setDir(res);
        try {
          const legs = res.routes?.[0]?.legs || [];
          const totalSec = legs.reduce((s, l) => s + (l.duration?.value || 0), 0);
          const totalMeters = legs.reduce((s, l) => s + (l.distance?.value || 0), 0);
          setEta({ text: fmtDuration(totalSec), meters: totalMeters });

          // Fit bounds
          const bounds = new g.maps.LatLngBounds();
          legs.forEach((leg) => {
            bounds.extend(leg.start_location);
            bounds.extend(leg.end_location);
          });
          if (mapRef.current) {
            mapRef.current.fitBounds(bounds, 64); // padding
          }
        } catch (e) {
          // ignore
        }
      } else {
        setError("Không tính được tuyến đường. Hãy thử lại sau.");
      }
    });
  }, [selected, me, travelMode, isLoaded]);

  const onLoadMap = (map) => {
    mapRef.current = map;
    if (me) map.panTo(me);
  };

  const recenter = () => {
    if (!mapRef.current) return;
    const target = me || DEFAULT_CENTER;
    mapRef.current.panTo(target);
    mapRef.current.setZoom(14);
  };

  const etaText = useMemo(() => {
    if (!eta) return null;
    return `${eta.text} • ${kmFmt(eta.meters)}`;
  }, [eta]);

  if (loadError) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-red-600">
        Không tải được Google Maps. {String(loadError.message || "")}
      </div>
    );
  }
  if (!MAPS_KEY) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-red-600">
        Thiếu VITE_GOOGLE_MAPS_API_KEY. Vui lòng cấu hình trong .env.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Overlay: ETA + địa chỉ */}
      <AnimatePresence>
        {eta || selected ? (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            className="absolute left-3 top-3 z-20 max-w-[70%] rounded-2xl bg-white/95 backdrop-blur px-4 py-3 text-xs shadow-lg ring-1 ring-slate-200"
          >
            <div className="font-semibold text-slate-900">
              {eta ? `Ước tính: ${etaText}` : "Đang tính tuyến..."}
            </div>
            {selected ? (
              <div className="mt-1 space-y-0.5 text-slate-700">
                <div className="truncate">
                  <span className="font-medium">Lấy: </span>
                  <span className="truncate align-top">
                    {resolvePoint(selected, "pickup")?.text || "—"}
                  </span>
                </div>
                <div className="truncate">
                  <span className="font-medium">Giao: </span>
                  <span className="truncate align-top">
                    {resolvePoint(selected, "dropoff")?.text || "—"}
                  </span>
                </div>
              </div>
            ) : null}
            {error ? (
              <div className="mt-1 text-red-600">{error}</div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Controls */}
      <div className="absolute right-3 top-3 z-20 flex gap-2">
        <button
          onClick={recenter}
          className="rounded-xl bg-white/95 px-3 py-2 text-xs font-medium shadow ring-1 ring-slate-200 hover:bg-white"
          title="Đưa bản đồ về vị trí của tôi"
        >
          Recenter
        </button>
        <button
          onClick={() => setShowTraffic((s) => !s)}
          className={`
            rounded-xl px-3 py-2 text-xs font-medium shadow ring-1 ring-slate-200
            ${showTraffic ? "bg-emerald-600 text-white" : "bg-white/95"}
          `}
          title="Bật/Tắt Traffic"
        >
          Traffic
        </button>
        <select
          value={travelMode}
          onChange={(e) => setTravelMode(e.target.value)}
          className="rounded-xl bg-white/95 px-2 py-2 text-xs shadow ring-1 ring-slate-200"
          title="Chế độ di chuyển"
        >
          <option value="DRIVING">Ô tô</option>
          <option value="WALKING">Đi bộ</option>
        </select>
      </div>

      {/* Bản đồ */}
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={CONTAINER_STYLE}
          center={center}
          zoom={13}
          onLoad={onLoadMap}
          options={{
            disableDefaultUI: false,
            streetViewControl: false,
            fullscreenControl: true,
            mapTypeControl: false,
          }}
        >
          {/* Lớp Traffic */}
          {showTraffic ? <TrafficLayer autoUpdate /> : null}

          {/* Marker vị trí shipper */}
          {me ? (
            <Marker
              position={me}
              title="Vị trí của bạn"
              icon={{
                path: window.google?.maps?.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: "#10B981",
                fillOpacity: 1,
                strokeColor: "#065F46",
                strokeWeight: 2,
              }}
            />
          ) : null}

          {/* Vẽ đường đi */}
          {dir ? (
            <DirectionsRenderer
              directions={dir}
              options={{ suppressMarkers: false, preserveViewport: true }}
            />
          ) : null}
        </GoogleMap>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm text-slate-600">
          Đang tải bản đồ…
        </div>
      )}
    </div>
  );
}
