import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ScanSearch } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Tabs from "../components/Tabs";
import { StatusBadge, ValidationBadge, ModeBadge } from "../components/Badge";
import WorkflowStepper from "../components/WorkflowStepper";
import ShipmentActions from "../components/ShipmentActions";
import DocumentUploader from "../components/DocumentUploader";
import ValidationPanel from "../components/ValidationPanel";
import DemoBanner from "../components/DemoBanner";
import { ActivityList, TransitionTimeline } from "../components/HistoryTimeline";
import { CardSkeleton } from "../components/Skeleton";
import { ErrorState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import { UPLOAD_STATUSES, formatDateTime, STATUS_META } from "../utils/format";

function Field({ label, value }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value || <span className="text-slate-400">Not set</span>}</dd>
    </div>
  );
}

function Overview({ detail }) {
  const rejection = detail.status === "rejected" ? [...detail.transitions].reverse().find((t) => t.to_status === "rejected") : null;
  return (
    <div className="space-y-6">
      {rejection && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4" role="alert">
          <p className="text-sm font-semibold text-rose-900">Rejected by {rejection.user}</p>
          <p className="mt-1 text-sm text-rose-800">{rejection.comment}</p>
          <p className="mt-1 text-xs text-rose-700/80">Correct the data in Review, then submit for approval again.</p>
        </div>
      )}
      <section className="card card-pad">
        <h3 className="mb-5 text-sm font-semibold text-slate-900">Workflow</h3>
        <WorkflowStepper status={detail.status} />
      </section>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card card-pad lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Shipment details</h3>
          <dl className="grid gap-5 sm:grid-cols-2">
            <Field label="Importer" value={detail.importer_name} />
            <Field label="Exporter / supplier" value={detail.exporter_name} />
            <Field label="Origin country" value={detail.origin_country} />
            <Field label="Destination" value={detail.destination} />
            <Field label="Assigned to" value={detail.assigned_to?.name} />
            <Field label="Last updated" value={formatDateTime(detail.updated_at)} />
            {detail.approved_by && <Field label="Approved by" value={`${detail.approved_by} - ${formatDateTime(detail.approved_at)}`} />}
          </dl>
        </section>
        <section className="card card-pad">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Status summary</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-slate-500">Documents</span><span className="font-medium">{detail.document_count} of 3</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Validation</span><ValidationBadge status={detail.validation_status} count={detail.open_issue_count} /></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Extraction</span><ModeBadge mode={detail.extraction_mode} /></div>
          </div>
        </section>
      </div>
      {detail.blockers.length > 0 && (
        <section className="card card-pad border-rose-200">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">What is blocking this shipment ({detail.blockers.length})</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{detail.blockers.slice(0, 6).map((b, i) => <li key={i}>{b}</li>)}</ul>
          {detail.blockers.length > 6 && <p className="mt-2 text-xs text-slate-500">+{detail.blockers.length - 6} more in the Validation tab</p>}
        </section>
      )}
    </div>
  );
}

function History({ detail }) {
  const { data: activity } = useAsync(() => api.activity({ shipment: detail.ref, limit: 100 }), [detail.ref]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card card-pad"><h3 className="mb-4 text-sm font-semibold text-slate-900">Status history</h3><TransitionTimeline transitions={detail.transitions} /></section>
      <section className="card card-pad"><h3 className="mb-2 text-sm font-semibold text-slate-900">Audit trail</h3>{activity ? (activity.length ? <ActivityList items={activity} /> : <p className="text-sm text-slate-500">No activity recorded.</p>) : <p className="text-sm text-slate-400">Loading...</p>}</section>
      <section className="card card-pad lg:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Field corrections ({detail.corrections.length})</h3>
        {detail.corrections.length === 0 ? <p className="text-sm text-slate-500">No fields have been corrected.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead className="border-b border-slate-200"><tr><th className="th">Field</th><th className="th">Before</th><th className="th">After</th><th className="th">By</th><th className="th">When</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{detail.corrections.map((c, i) => <tr key={i}><td className="td">{c.doc_type.replace("_", " ")} / {c.key}{c.item_index != null ? ` (item ${c.item_index + 1})` : ""}</td><td className="td font-mono text-xs">{c.old_value ?? "(empty)"}</td><td className="td font-mono text-xs">{c.new_value ?? "(empty)"}</td><td className="td">{c.user}</td><td className="td text-slate-500">{formatDateTime(c.at)}</td></tr>)}</tbody></table></div>
        )}
      </section>
      {detail.exports.length > 0 && (
        <section className="card card-pad lg:col-span-2"><h3 className="mb-3 text-sm font-semibold text-slate-900">Export history</h3>
          <ul className="divide-y divide-slate-100 text-sm">{detail.exports.map((e) => <li key={e.id} className="flex justify-between py-2"><span className="font-medium">{e.filename} <span className="text-slate-500">({e.row_count} rows)</span></span><span className="text-slate-500">{e.user} - {formatDateTime(e.at)}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}

export default function ShipmentDetail() {
  const { ref } = useParams();
  const { isExecutive } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "overview";
  const { data: detail, loading, error, reload, setData } = useAsync(() => api.getShipment(ref), [ref]);

  useEffect(() => { document.title = `${ref} - CargoLens AI`; }, [ref]);

  if (loading && !detail) return <div className="space-y-4"><CardSkeleton lines={1} /><CardSkeleton lines={5} /></div>;
  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;

  const canUpload = isExecutive && UPLOAD_STATUSES.includes(detail.status);
  const reload2 = () => reload(true);
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents", badge: `${detail.document_count}/3` },
    { id: "validation", label: "Validation", badge: detail.open_issue_count, badgeTone: "rose" },
    { id: "history", label: "History" },
  ];
  const isDemo = detail.fields.some((f) => f.extraction_mode === "demo_fallback");

  return (
    <>
      <PageHeader
        title={detail.ref} badge={<StatusBadge status={detail.status} />}
        subtitle={`${detail.importer_name || "Importer not set"} - ${detail.origin_country || "origin not set"}`}
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Shipments", to: "/shipments" }, { label: detail.ref }]}
        actions={<>
          {detail.fields.length > 0 && <Link to={`/shipments/${detail.ref}/review`} className="btn-primary"><ScanSearch className="h-4 w-4" /> {isExecutive ? "Review extraction" : "View extraction"}</Link>}
          <ShipmentActions detail={detail} onUpdate={setData} onReload={reload2} />
        </>}
      />
      {isDemo && <div className="mb-5"><DemoBanner status={{ is_demo: true, message: detail.extraction_provider?.message }} compact /></div>}
      <Tabs tabs={tabs} active={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} />
      <div className="pt-6">
        {tab === "overview" && <Overview detail={detail} />}
        {tab === "documents" && <DocumentUploader detail={detail} onUpdate={setData} disabled={!canUpload}
          disabledReason={!isExecutive ? "Only executives can upload documents. You have read-only access." : "Documents are locked while the shipment is awaiting approval, approved or exported."} />}
        {tab === "validation" && <ValidationPanel detail={detail} onReload={reload2} />}
        {tab === "history" && <History detail={detail} />}
      </div>
    </>
  );
}
