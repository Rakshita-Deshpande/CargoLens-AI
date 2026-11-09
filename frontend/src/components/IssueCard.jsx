import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, AlertTriangle, CheckCircle2, ScanSearch } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { SeverityBadge } from "./Badge";
import { CODE_LABELS, DOC_SHORT, formatDateTime } from "../utils/format";

const FIX_HINTS = {
  MISSING_DOCUMENT: ["Upload the document", "documents"],
  DOC_NOT_EXTRACTED: ["Run extraction", "overview"],
  MISSING_FIELD: ["Enter the value in Review", "review"],
  LOW_CONFIDENCE: ["Verify or correct the value in Review", "review"],
};

export default function IssueCard({ issue, shipmentRef, canResolve, onResolve }) {
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = issue.status === "open";
  const tone = !open ? "border-blue-200 bg-blue-50/40" : issue.blocking ? "border-rose-200 bg-rose-50/40" : "border-amber-200 bg-amber-50/40";
  const Icon = !open ? CheckCircle2 : issue.blocking ? AlertOctagon : AlertTriangle;
  const iconCls = !open ? "text-blue-600" : issue.blocking ? "text-rose-600" : "text-amber-600";
  const hint = FIX_HINTS[issue.code];

  const submit = async () => {
    setBusy(true);
    const ok = await onResolve(issue.id, note.trim());
    setBusy(false);
    if (ok) setConfirming(false);
  };

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconCls}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{CODE_LABELS[issue.code] || issue.code}</p>
            <SeverityBadge issue={issue} />
            {issue.doc_types.map((d) => <span key={d} className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">{DOC_SHORT[d]}</span>)}
          </div>
          <p className="mt-1.5 text-sm text-slate-700">{issue.message}</p>

          {!open && (
            <div className="mt-3 rounded-lg bg-white p-3 text-sm ring-1 ring-blue-100">
              <p className="eyebrow">Reviewer resolution</p>
              <p className="mt-1 text-slate-700">{issue.resolution_note}</p>
              <p className="mt-1 text-xs text-slate-500">{issue.resolved_by} - {formatDateTime(issue.resolved_at)}</p>
            </div>
          )}

          {open && issue.reviewable && (
            <div className="mt-3">
              <p className="text-xs text-slate-600">CargoLens does not decide which document is correct. Correct a value in Review, or record your decision and evidence here.</p>
              {canResolve ? (
                <div className="mt-2 flex flex-wrap items-start gap-2">
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} className="input min-w-[240px] flex-1" aria-label="Resolution note" placeholder="Describe the evidence you checked and your decision (min. 5 characters)" />
                  <div className="flex flex-col gap-2">
                    <button className="btn-primary btn-sm" disabled={note.trim().length < 5} onClick={() => setConfirming(true)}>Record resolution</button>
                    <Link to={`/shipments/${shipmentRef}/review`} className="btn-secondary btn-sm"><ScanSearch className="h-3.5 w-3.5" /> Open review</Link>
                  </div>
                </div>
              ) : <p className="mt-2 text-xs font-medium text-slate-500">Resolution is recorded by the assigned executive.</p>}
            </div>
          )}

          {open && !issue.reviewable && hint && (
            <p className="mt-2 text-xs text-slate-600">
              Must be fixed in the data (cannot be waived): <Link className="font-medium text-brand-700 hover:underline" to={hint[1] === "review" ? `/shipments/${shipmentRef}/review` : `/shipments/${shipmentRef}?tab=${hint[1]}`}>{hint[0]}</Link>
            </p>
          )}
        </div>
      </div>
      <ConfirmDialog open={confirming} loading={busy} title="Record this resolution?" confirmLabel="Record resolution" onCancel={() => setConfirming(false)} onConfirm={submit}
        message="You are accepting this discrepancy. Your name, the time and your note go to the audit trail and the manager will see them. If the compared values change later, the issue re-opens.">
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{note}</p>
      </ConfirmDialog>
    </div>
  );
}
