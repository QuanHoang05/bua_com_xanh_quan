// frontend/src/lib/api.js

// Base URL từ .env hoặc fallback localhost
export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api").replace(/\/$/, "");

/** Lấy token (ưu tiên localStorage) */
function token() {
  return (
    localStorage.getItem("bua_token") ||
    sessionStorage.getItem("bua_token") ||
    ""
  );
}

/** Request wrapper */
async function request(path, { method = "GET", body, headers = {} } = {}) {
  const m = method.toUpperCase();
  const isGet = m === "GET";

  const h = {
    Accept: "application/json",
    ...(isGet ? { "Cache-Control": "no-cache", Pragma: "no-cache" } : {}),
    ...headers,
  };

  const t = token();
  if (t) h["Authorization"] = `Bearer ${t}`;
  if (body && !(body instanceof FormData)) h["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method: m,
    headers: h,
    body: body && !(body instanceof FormData) ? JSON.stringify(body) : body,
    cache: isGet ? "no-store" : "default",
  });

  if (!res.ok) {
    let msg = "";
    try {
      const j = await res.clone().json();
      msg = j?.message || j?.error || JSON.stringify(j);
    } catch {
      msg = await res.text();
    }
    console.error("API error:", { path, status: res.status, msg });
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }

  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export const apiGet = (p) => request(p);
export const apiPost = (p, body) => request(p, { method: "POST", body });
export const apiPatch = (p, body) => request(p, { method: "PATCH", body });
export const apiDelete = (p) => request(p, { method: "DELETE" });

export function useApi() {
  return { apiGet, apiPost, apiPatch, apiDelete };
}
