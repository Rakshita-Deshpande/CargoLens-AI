import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

// sessionStorage keeps the token only for this browser tab/session (shorter exposure than localStorage).
const TOKEN_KEY = "cargolens_token";
export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

const client = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

client.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let unauthorizedHandler = null;
export const setUnauthorizedHandler = (fn) => {
  unauthorizedHandler = fn;
};

client.interceptors.response.use(
  (r) => r,
  (error) => {
    const isLogin = error.config?.url?.includes("/auth/login");
    if (error.response?.status === 401 && !isLogin && tokenStore.get()) {
      tokenStore.clear();
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  }
);

/** Turn any axios/FastAPI error into { message, blockers, status } that is safe to show. */
export function parseError(err) {
  if (!err.response) {
    if (err.code === "ECONNABORTED") return { message: "The request timed out. Please try again.", blockers: [], status: 0 };
    return { message: `Cannot reach the server at ${API_BASE_URL}. Check that the backend is running.`, blockers: [], status: 0 };
  }
  const { status, data } = err.response;
  const detail = data?.detail;
  if (typeof detail === "string") return { message: detail, blockers: [], status };
  if (Array.isArray(detail)) {
    const msg = detail.map((d) => (d.loc ? `${d.loc.slice(1).join(".")}: ${d.msg}` : d.msg)).join("; ");
    return { message: msg || "Some of the submitted values are invalid.", blockers: [], status };
  }
  if (detail && typeof detail === "object") return { message: detail.message || "Request failed.", blockers: detail.blockers || [], status };
  return { message: `Request failed (HTTP ${status}).`, blockers: [], status };
}

const data = (p) => p.then((r) => r.data);

function filenameFrom(headers, fallback) {
  const m = /filename="?([^";]+)"?/i.exec(headers["content-disposition"] || "");
  return m ? m[1] : fallback;
}

export const api = {
  // auth
  login: (username, password) => data(client.post("/auth/login", { username, password })),
  me: () => data(client.get("/auth/me")),
  logout: () => data(client.post("/auth/logout")),

  // shipments
  listShipments: (params = {}) => data(client.get("/shipments", { params })),
  stats: () => data(client.get("/shipments/stats")),
  createShipment: (body) => data(client.post("/shipments", body)),
  getShipment: (ref) => data(client.get(`/shipments/${ref}`)),
  submitShipment: (ref) => data(client.post(`/shipments/${ref}/submit`)),

  // documents
  uploadDocument: (ref, docType, file, onProgress) => {
    const form = new FormData();
    form.append("doc_type", docType);
    form.append("file", file);
    return data(
      client.post(`/shipments/${ref}/documents`, form, {
        timeout: 120000,
        onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
      })
    );
  },
  documentBlob: (id) => client.get(`/documents/${id}/file`, { responseType: "blob" }).then((r) => r.data),

  // extraction + fields
  extractionStatus: () => data(client.get("/extraction/status")),
  extract: (ref, force = false) => data(client.post(`/shipments/${ref}/extract`, null, { params: { force }, timeout: 180000 })),
  updateField: (id, body) => data(client.patch(`/fields/${id}`, body)),

  // validation
  validation: (ref) => data(client.get(`/shipments/${ref}/validation`)),
  validate: (ref) => data(client.post(`/shipments/${ref}/validate`)),
  resolveIssue: (id, note) => data(client.post(`/issues/${id}/resolve`, { note })),

  // approvals
  approve: (ref, comment) => data(client.post(`/shipments/${ref}/approve`, { comment: comment || null })),
  reject: (ref, comment) => data(client.post(`/shipments/${ref}/reject`, { comment })),

  // export
  exportShipment: async (ref, format) => {
    const r = await client.get(`/shipments/${ref}/export`, { params: { format }, responseType: "blob", timeout: 60000 });
    return { blob: r.data, filename: filenameFrom(r.headers, `${ref}.${format}`) };
  },
  exportHistory: () => data(client.get("/exports")),

  // reports + activity
  reportSummary: () => data(client.get("/reports/summary")),
  reportDiscrepancies: (status) => data(client.get("/reports/discrepancies", { params: status ? { status } : {} })),
  reportAccuracy: () => data(client.get("/reports/accuracy")),
  reportCorrections: () => data(client.get("/reports/corrections")),
  activity: (params = {}) => data(client.get("/activity", { params })),
};

/** axios blob error bodies are Blobs; this reads the FastAPI JSON error out of one. */
export async function parseBlobError(err) {
  if (err.response?.data instanceof Blob) {
    try {
      const json = JSON.parse(await err.response.data.text());
      return parseError({ response: { status: err.response.status, data: json } });
    } catch {
      /* fall through */
    }
  }
  return parseError(err);
}
