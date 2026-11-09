import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GitCompareArrows, Info } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { StatusBadge } from "../components/Badge";
import ShipmentActions from "../components/ShipmentActions";
import DemoBanner from "../components/DemoBanner";
import DocumentPane from "../components/review/DocumentPane";
import FieldsPane from "../components/review/FieldsPane";
import { Skeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { api, parseError } from "../services/api";
import { DOC_TYPES, EDITABLE_STATUSES } from "../utils/format";

export default function Review() {
  const { ref } = useParams();
  const { isExecutive } = useAuth();
  const { data: detail, loading, error, reload, setData } = useAsync(() => api.getShipment(ref), [ref]);
  const [docType, setDocType] = useState("invoice");

  useEffect(() => { document.title = `Review ${ref} - CargoLens AI`; }, [ref]);

  // open on the first document that actually exists
  useEffect(() => {
    if (detail && !detail.documents.some((d) => d.doc_type === docType)) {
      const first = DOC_TYPES.find((dt) => detail.documents.some((d) => d.doc_type === dt));
      if (first) setDocType(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.ref]);

  if (loading && !detail)
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><div className="grid gap-4 xl:grid-cols-2"><Skeleton className="h-[60vh]" /><Skeleton className="h-[60vh]" /></div></div>;
  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;

  const readOnly = !isExecutive || !EDITABLE_STATUSES.includes(detail.status);
  const extracted = detail.fields.length > 0;
  const isDemo = detail.fields.some((f) => f.extraction_mode === "demo_fallback");

  const apply = (res) =>
    setData((d) => ({
      ...d,
      status: res.status,
      fields: d.fields.map((f) => (f.id === res.field.id ? res.field : f)),
      issues: res.issues,
      blockers: res.blockers,
      open_issue_count: res.blockers.length,
      validation_status: res.blockers.length ? "needs_review" : "passed",
    }));

  const patch = async (id, body) => {
    try {
      apply(await api.updateField(id, body));
      return { ok: true };
    } catch (err) {
      return { ok: false, message: parseError(err).message };
    }
  };
  const onSave = (id, value) => patch(id, { value });
  const onVerify = (id, verified) => patch(id, { verified });

  return (
    <>
      <PageHeader
        title={`Review ${detail.ref}`} badge={<StatusBadge status={detail.status} />}
        subtitle={`${detail.importer_name || "Importer not set"} - ${detail.origin_country || "origin not set"}`}
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Shipments", to: "/shipments" }, { label: detail.ref, to: `/shipments/${detail.ref}` }, { label: "Review" }]}
        actions={<>
          <Link to={`/shipments/${detail.ref}?tab=validation`} className="btn-secondary">
            <GitCompareArrows className="h-4 w-4" /> Cross-document validation
            {detail.open_issue_count > 0 && <span className="rounded-full bg-rose-100 px-1.5 text-[11px] font-semibold text-rose-700">{detail.open_issue_count}</span>}
          </Link>
          <ShipmentActions detail={detail} onUpdate={setData} onReload={() => reload(true)} />
        </>}
      />

      <div className="mb-4 space-y-2">
        {isDemo && <DemoBanner status={{ is_demo: true, message: detail.extraction_provider?.message }} compact />}
        {!isExecutive && <p className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600"><Info className="h-4 w-4" /> Read-only view. Only the assigned executive can edit or verify fields.</p>}
        {isExecutive && detail.status === "ready_for_approval" && <p className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800"><Info className="h-4 w-4" /> This shipment is waiting for approval. Editing any field returns it to review.</p>}
        {isExecutive && ["approved", "exported"].includes(detail.status) && <p className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600"><Info className="h-4 w-4" /> Approved shipments are locked.</p>}
      </div>

      {!extracted ? (
        <div className="card"><EmptyState title="No extracted data yet"
          message={!isExecutive ? "The assigned executive has not run extraction for this shipment yet." : detail.document_count ? "Run extraction to read the uploaded documents into reviewable fields." : "Upload the shipment documents first."}
          action={isExecutive ? <div className="flex gap-2"><Link className="btn-secondary" to={`/shipments/${detail.ref}?tab=documents`}>Documents</Link><ShipmentActions detail={detail} onUpdate={setData} onReload={() => reload(true)} /></div> : <Link className="btn-secondary" to={`/shipments/${detail.ref}`}>Back to shipment</Link>} /></div>
      ) : (
        <div className="grid gap-4 xl:h-[calc(100vh-17rem)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="h-[70vh] xl:h-full"><DocumentPane detail={detail} docType={docType} onDocType={setDocType} /></div>
          <div className="h-[75vh] xl:h-full"><FieldsPane detail={detail} docType={docType} readOnly={readOnly} onSave={onSave} onVerify={onVerify} /></div>
        </div>
      )}
    </>
  );
}
