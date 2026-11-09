import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, ScanSearch, XCircle } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Tabs from "../components/Tabs";
import ConfirmDialog from "../components/ConfirmDialog";
import { StatusBadge, ValidationBadge, ModeBadge, Pill } from "../components/Badge";
import { TransitionTimeline } from "../components/HistoryTimeline";
import DemoBanner from "../components/DemoBanner";
import { CardSkeleton, Skeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { useToast } from "../context/ToastContext";
import { useAsync } from "../hooks/useAsync";
import { api, parseError } from "../services/api";
import { CODE_LABELS, formatDateTime, timeAgo } from "../utils/format";

const TABS = [
  { id: "awaiting", label: "Awaiting approval", match: (s) => s.status === "ready_for_approval" },
  { id: "decided", label: "Approved", match: (s) => ["approved", "exported"].includes(s.status) },
  { id: "rejected", label: "Rejected", match: (s) => s.status === "rejected" },
];

function Stat({ label, value, tone }) {
  return <div className="rounded-lg bg-slate-50 px-4 py-3"><p className="eyebrow">{label}</p><p className={`mt-1 text-xl font-semibold ${tone || "text-slate-900"}`}>{value}</p></div>;
}

function DetailPanel({ ref_, onDecided }) {
  const toast = useToast();
  const { data: d, loading, error, reload } = useAsync(() => api.getShipment(ref_), [ref_]);
  const [dialog, setDialog] = useState(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDialog(null); setComment(""); }, [ref_]);
  if (loading) return <div className="space-y-4"><CardSkeleton lines={4} /><CardSkeleton lines={6} /></div>;
  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;

  const discrepancies = d.issues.filter((i) => i.reviewable);
  const resolved = discrepancies.filter((i) => i.status === "resolved").length;
  const verified = d.fields.filter((f) => f.verified).length;
  const corrected = d.fields.filter((f) => f.corrected).length;
  const lowUnverified = d.fields.filter((f) => f.low_confidence && !f.verified).length;
  const awaiting = d.status === "ready_for_approval";
  const isDemo = d.fields.some((f) => f.extraction_mode === "demo_fallback");

  const decide = async () => {
    setBusy(true);
    try {
      if (dialog === "approve") { await api.approve(d.ref, comment.trim()); toast.success("Shipment approved", `${d.ref} can now be exported.`); }
      else { await api.reject(d.ref, comment.trim()); toast.success("Shipment rejected", "The executive will see your comment."); }
      setDialog(null); setComment(""); onDecided();
    } catch (err) {
      const p = parseError(err);
      toast.error(dialog === "approve" ? "Could not approve" : "Could not reject", p.blockers.length ? `${p.message} (${p.blockers.length} unresolved)` : p.message);
      reload(true);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <section className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3"><h2 className="text-xl font-semibold">{d.ref}</h2><StatusBadge status={d.status} /></div>
            <p className="mt-1 text-sm text-slate-500">{d.importer_name} - {d.origin_country}{d.exporter_name ? ` - supplier ${d.exporter_name}` : ""}</p>
            <p className="mt-0.5 text-xs text-slate-500">Assigned to {d.assigned_to?.name} - updated {timeAgo(d.updated_at)}</p>
          </div>
          <Link to={`/shipments/${d.ref}/review`} className="btn-secondary"><ScanSearch className="h-4 w-4" /> Inspect documents</Link>
        </div>
        {isDemo && <div className="mt-4"><DemoBanner status={{ is_demo: true }} compact /></div>}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Documents" value={`${d.document_count} / 3`} tone={d.document_count < 3 ? "text-rose-600" : undefined} />
          <Stat label="Open issues" value={d.open_issue_count} tone={d.open_issue_count ? "text-rose-600" : "text-emerald-600"} />
          <Stat label="Fields verified" value={`${verified} / ${d.fields.length}`} />
          <Stat label="Corrected by executive" value={corrected} />
        </div>
        {lowUnverified > 0 && <p className="mt-3 text-xs text-amber-700">{lowUnverified} low-confidence field(s) have not been verified.</p>}
      </section>

      <section className="card card-pad">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">Discrepancy resolution</h3><span className="text-xs text-slate-500">{resolved} of {discrepancies.length} resolved</span></div>
        {discrepancies.length === 0 ? <p className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> No cross-document discrepancies were found.</p> : (
          <ul className="space-y-3">{discrepancies.map((i) => (
            <li key={i.id} className={`rounded-lg border p-3 ${i.status === "resolved" ? "border-blue-200 bg-blue-50/40" : "border-rose-200 bg-rose-50/40"}`}>
              <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-slate-900">{CODE_LABELS[i.code]}</p><Pill tone={i.status === "resolved" ? "blue" : "rose"}>{i.status === "resolved" ? "Resolved by executive" : "Unresolved"}</Pill></div>
              <p className="mt-1 text-sm text-slate-700">{i.message}</p>
              {i.status === "resolved" && <p className="mt-2 rounded bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-blue-100"><span className="font-medium">Executive's note:</span> {i.resolution_note}<span className="mt-0.5 block text-xs text-slate-500">{i.resolved_by} - {formatDateTime(i.resolved_at)}</span></p>}
            </li>
          ))}</ul>
        )}
        {d.corrections.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-900">Executive corrections ({d.corrections.length})</h4>
            <div className="overflow-x-auto"><table className="w-full min-w-[480px]"><thead><tr><th className="th">Field</th><th className="th">Before</th><th className="th">After</th><th className="th">By</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{d.corrections.map((c, i) => <tr key={i}><td className="td">{c.doc_type.replace("_", " ")} / {c.key}</td><td className="td font-mono text-xs">{c.old_value ?? "(empty)"}</td><td className="td font-mono text-xs">{c.new_value ?? "(empty)"}</td><td className="td">{c.user}</td></tr>)}</tbody></table></div>
          </div>
        )}
      </section>

      <section className="card card-pad"><h3 className="mb-4 text-sm font-semibold text-slate-900">Audit history</h3><TransitionTimeline transitions={d.transitions} /></section>

      {awaiting ? (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-pop">
          <p className="text-sm text-slate-600">{d.open_issue_count ? <span className="font-medium text-rose-600">Cannot approve: unresolved issues remain.</span> : "All blocking issues are cleared. Approving unlocks export."}</p>
          <div className="flex gap-2">
            <button className="btn-secondary text-rose-700" onClick={() => { setComment(""); setDialog("reject"); }}><XCircle className="h-4 w-4" /> Reject</button>
            <button className="btn-primary" disabled={d.open_issue_count > 0} onClick={() => { setComment(""); setDialog("approve"); }}><CheckCircle2 className="h-4 w-4" /> Approve</button>
          </div>
        </div>
      ) : <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">This shipment is <strong>{d.status.replace("_", " ")}</strong>; no decision is pending.</div>}

      <ConfirmDialog open={Boolean(dialog)} loading={busy} tone={dialog === "reject" ? "danger" : "primary"} title={dialog === "reject" ? `Reject ${d.ref}?` : `Approve ${d.ref}?`}
        confirmLabel={dialog === "reject" ? "Reject shipment" : "Approve shipment"} confirmDisabled={dialog === "reject" && comment.trim().length < 3} onCancel={() => setDialog(null)} onConfirm={decide}
        message={dialog === "reject" ? "The shipment goes back to the executive with your comment." : "Approval unlocks export for this shipment. It is recorded in the audit history under your name."}>
        <label className="label" htmlFor="decision-comment">{dialog === "reject" ? "Reason for rejection (required)" : "Comment (optional)"}</label>
        <textarea id="decision-comment" rows={3} className="input" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </ConfirmDialog>
    </div>
  );
}

export default function Approvals() {
  const { data, loading, error, reload } = useAsync(() => api.listShipments(), []);
  const [tab, setTab] = useState("awaiting");
  const [selected, setSelected] = useState(null);
  const current = TABS.find((t) => t.id === tab);
  const rows = useMemo(() => (data || []).filter(current.match), [data, current]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.id, (data || []).filter(t.match).length])), [data]);

  useEffect(() => { if (!rows.find((r) => r.ref === selected)) setSelected(rows[0]?.ref || null); }, [rows, selected]);

  return (
    <>
      <PageHeader title="Approvals" subtitle="Review executive work, check discrepancy resolutions, then approve or reject." breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Approvals" }]} />
      <Tabs tabs={TABS.map((t) => ({ id: t.id, label: t.label, badge: counts[t.id] }))} active={tab} onChange={setTab} />
      <div className="mt-6">
        {loading ? <div className="grid gap-6 lg:grid-cols-[320px_1fr]"><Skeleton className="h-64" /><Skeleton className="h-96" /></div> : error ? <div className="card"><ErrorState message={error} onRetry={reload} /></div> : rows.length === 0 ? (
          <div className="card"><EmptyState icon={ClipboardCheck} title={tab === "awaiting" ? "No shipments awaiting approval" : "Nothing here yet"} message={tab === "awaiting" ? "When an executive submits a shipment for approval, it appears in this queue." : "Shipments will be listed here after a decision."} /></div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <ul className="card divide-y divide-slate-100 overflow-hidden" aria-label="Shipment queue">
              {rows.map((s) => (
                <li key={s.ref}>
                  <button onClick={() => setSelected(s.ref)} className={`w-full px-4 py-3.5 text-left transition-colors ${selected === s.ref ? "bg-brand-50" : "hover:bg-slate-50"}`} aria-current={selected === s.ref}>
                    <div className="flex items-center justify-between"><span className="font-semibold text-slate-900">{s.ref}</span><span className="text-xs text-slate-500">{timeAgo(s.updated_at)}</span></div>
                    <p className="mt-0.5 text-sm text-slate-600">{s.importer_name} - {s.origin_country}</p>
                    <div className="mt-2 flex items-center gap-2"><ValidationBadge status={s.validation_status} count={s.open_issue_count} /><ModeBadge mode={s.extraction_mode} /></div>
                  </button>
                </li>
              ))}
            </ul>
            {selected && <DetailPanel key={selected} ref_={selected} onDecided={() => reload(true)} />}
          </div>
        )}
      </div>
    </>
  );
}
