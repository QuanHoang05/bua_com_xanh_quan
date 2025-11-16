import { useState, useRef, useCallback } from 'react';
import { useToast } from '../components/ui/Toast';

async function getGeoPermissionState() {
  try {
    if (!navigator.permissions?.query) return "prompt";
    const s = await navigator.permissions.query({ name: "geolocation" });
    return s.state; // 'granted' | 'prompt' | 'denied'
  } catch {
    return "prompt";
  }
}

function getPositionOnce(opts) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, opts);
  });
}

export function useGeolocation(setProfileField) {
  const t = useToast();
  const [isLocating, setIsLocating] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const watchIdRef = useRef(null);

  const applyPosition = useCallback((pos) => {
    if (!pos?.coords) return;
    const { latitude, longitude, accuracy } = pos.coords;
    setProfileField("lat", Number(latitude.toFixed(6)));
    setProfileField("lng", Number(longitude.toFixed(6)));
    setAccuracy(Math.round(accuracy));
  }, [setProfileField]);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current != null && navigator.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const refinePosition = useCallback(async (maxMs = 8000, targetAcc = 20) => {
    if (!navigator.geolocation) return;
    clearWatch();
    const start = Date.now();
    return new Promise((resolve) => {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (p) => {
          applyPosition(p);
          if (p?.coords?.accuracy && p.coords.accuracy <= targetAcc) resolve();
          else if (Date.now() - start > maxMs) resolve();
        },
        () => resolve(),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    });
  }, [applyPosition, clearWatch]);

  const detectLocation = useCallback(async () => {
    if (!navigator.geolocation) { t.error("Trình duyệt không hỗ trợ định vị"); return; }
    setIsLocating(true); setAccuracy(null);
    try {
      const perm = await getGeoPermissionState();
      if (perm === "denied") { t.error("Bạn đã chặn quyền định vị. Hãy bật lại trong cài đặt trình duyệt."); return; }
      const first = await getPositionOnce({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      applyPosition(first);
      await refinePosition(8000, 20);
      t.success("Đã lấy vị trí hiện tại");
    } catch (err) { console.error(err); t.error("Không lấy được vị trí"); }
    finally { clearWatch(); setIsLocating(false); }
  }, [t, applyPosition, refinePosition, clearWatch]);

  return { isLocating, accuracy, detectLocation };
}