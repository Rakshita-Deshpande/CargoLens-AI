export const DOC_TYPES = ["invoice", "packing_list", "bill_of_lading"];
export const DOC_LABELS = {
  invoice: "Commercial Invoice",
  packing_list: "Packing List",
  bill_of_lading: "Bill of Lading",
};
export const DOC_SHORT = { invoice: "Invoice", packing_list: "Packing list", bill_of_lading: "B/L" };

// Statuses in which the backend lets an executive edit fields / resolve issues.
export const EDITABLE_STATUSES = ["needs_review", "rejected", "ready_for_approval"];
export const UPLOAD_STATUSES = ["draft", "documents_uploaded", "needs_review", "rejected"];
export const EXTRACT_STATUSES = ["documents_uploaded", "ai_processing", "needs_review", "rejected"];

export const WORKFLOW = [
  "draft",
  "documents_uploaded",
  "ai_processing",
  "needs_review",
  "ready_for_approval",
  "approved",
  "exported",
];

export const STATUS_META = {
  draft: { label: "Draft", tone: "slate" },
  documents_uploaded: { label: "Documents uploaded", tone: "blue" },
  ai_processing: { label: "AI processing", tone: "violet" },
  needs_review: { label: "Needs review", tone: "amber" },
  ready_for_approval: { label: "Ready for approval", tone: "indigo" },
  approved: { label: "Approved", tone: "emerald" },
  rejected: { label: "Rejected", tone: "rose" },
  exported: { label: "Exported", tone: "teal" },
};

export const TONES = {
  slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/25",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/20",
  teal: "bg-teal-50 text-teal-700 ring-teal-600/20",
};

const dateTime = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export const formatDateTime = (iso) => (iso ? dateTime.format(new Date(iso)) : "-");
export const formatDate = (iso) => (iso ? dateOnly.format(new Date(iso)) : "-");

export function timeAgo(iso) {
  if (!iso) return "-";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return formatDate(iso);
}

export function formatBytes(n) {
  if (n == null) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const ACTION_LABELS = {
  login: "signed in",
  login_failed: "failed sign-in attempt",
  logout: "signed out",
  shipment_created: "created the shipment",
  document_uploaded: "uploaded a document",
  document_replaced: "replaced a document",
  extraction_completed: "completed extraction",
  field_corrected: "corrected a field",
  field_verified: "verified a field",
  field_unverified: "removed a verification",
  issue_resolved: "resolved a discrepancy",
  validation_run: "re-ran validation",
  status_change: "changed the status",
  exported: "exported the shipment",
};
export const actionLabel = (a) => ACTION_LABELS[a] || a.replace(/_/g, " ");

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Client-side CSV for report tables. Neutralises spreadsheet formula injection.
export function rowsToCsv(columns, rows) {
  const esc = (v) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\ufeff" + [columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(","))].join("\r\n");
}

export const CODE_LABELS = {
  GROSS_WEIGHT_MISMATCH: "Gross weight mismatch",
  PACKAGE_COUNT_MISMATCH: "Package count mismatch",
  TOTAL_MISMATCH: "Invoice total mismatch",
  LINE_TOTAL_MISMATCH: "Line total mismatch",
  QUANTITY_MISMATCH: "Quantity mismatch",
  ITEM_NOT_IN_PACKING_LIST: "Item missing on packing list",
  ITEM_NOT_IN_INVOICE: "Item missing on invoice",
  NET_EXCEEDS_GROSS: "Net exceeds gross weight",
  MISSING_DOCUMENT: "Missing document",
  DOC_NOT_EXTRACTED: "Not extracted",
  MISSING_FIELD: "Missing field",
  LOW_CONFIDENCE: "Low confidence",
};

export const pct = (c) => `${Math.round((c ?? 0) * 100)}%`;
