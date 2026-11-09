import { useState } from "react";
import { RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import ComparisonTable from "./ComparisonTable";
import IssueCard from "./IssueCard";
import Spinner from "./Spinner";
import { EmptyState } from "./States";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api, parseError } from "../services/api";
import { EDITABLE_STATUSES } from "../utils/format";

export default function ValidationPanel({ detail, onReload }) {
  const { isExecutive } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const canResolve = isExecutive && EDITABLE_STATUSES.includes(detail.status);

  const rerun = async () => {
    setBusy(true);
    try {
      await api.validate(detail.ref);
      await onReload();
      toast.success("Validation re-run", "Results are up to date.");
    } catch (err) {
      toast.error("Validation failed", parseError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (id, note) => {
    try {
      await api.resolveIssue(id, note);
      await onReload();
      toast.success("Resolution recorded", "The discrepancy is marked as resolved by you.");
      return true;
    } catch (err) {
      toast.error("Could not record resolution", parseError(err).message);
      return false;
    }
  };

  const blocking = detail.issues.filter((i) => i.status === "open" && i.blocking);
  const warnings = detail.issues.filter((i) => i.status === "open" && !i.blocking);
  const resolved = detail.issues.filter((i) => i.status === "resolved");
  const extracted = detail.fields.length > 0 || detail.documents.length === 0;

  return (
    <div className="space-y-6">
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4 ${blocking.length ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
        <div className="flex items-center gap-3">
          {blocking.length ? <ShieldAlert className="h-6 w-6 text-rose-600" aria-hidden /> : <ShieldCheck className="h-6 w-6 text-emerald-600" aria-hidden />}
          <div>
            <p className="text-sm font-semibold text-slate-900">{blocking.length ? `${blocking.length} blocking ${blocking.length === 1 ? "issue" : "issues"} - export stays blocked` : "No blocking issues"}</p>
            <p className="text-xs text-slate-600">Checks are deterministic rules, not an AI opinion. Weight tolerance and thresholds are provisional demo defaults awaiting client approval.</p>
          </div>
        </div>
        <button className="btn-secondary btn-sm" onClick={rerun} disabled={busy}>{busy ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />} Re-run validation</button>
      </div>

      {!extracted ? (
        <div className="card"><EmptyState title="Nothing to compare yet" message="Upload the documents and run extraction to compare the invoice, packing list and bill of lading." /></div>
      ) : (
        <section className="card">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Cross-document comparison</h3>
            <p className="mt-0.5 text-xs text-slate-500">When documents disagree, every value in the row is highlighted. Neither is assumed correct.</p>
          </div>
          <ComparisonTable detail={detail} />
        </section>
      )}

      {[["Blocking issues", blocking], ["Warnings", warnings], ["Resolved by reviewer", resolved]].map(([title, list]) =>
        list.length ? (
          <section key={title}>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">{title} <span className="font-normal text-slate-400">({list.length})</span></h3>
            <div className="space-y-3">{list.map((i) => <IssueCard key={i.id} issue={i} shipmentRef={detail.ref} canResolve={canResolve} onResolve={resolve} />)}</div>
          </section>
        ) : null
      )}
    </div>
  );
}
