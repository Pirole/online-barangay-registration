// src/lib/api.ts
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api/v1";

export async function apiFetch(path: string, opts: RequestInit = {}, token?: string) {
  const headers = new Headers(opts.headers || {});
  if (!headers.has("Content-Type") && !(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
    credentials: opts.credentials ?? "same-origin",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // not JSON
  }

  if (!res.ok) {
    const errMsg = (json && json.message) || text || `Request failed ${res.status}`;
    const e: any = new Error(errMsg);
    e.status = res.status;
    e.body = json;
    throw e;
  }
  return json;
}
