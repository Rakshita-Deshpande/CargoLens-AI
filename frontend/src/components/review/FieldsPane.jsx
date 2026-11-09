import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCheck, Filter, ListChecks } from "lucide-react";
import FieldRow from "./FieldRow";
import { ModeBadge } from "../Badge";
import { EmptyState } from "../States";
import { CODE_LABELS, DOC_LABELS } from "../../utils/format";

const jump = (id) => {
  const el = document.getElementById(`field-${id}`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.querySelector("input")?.focus({ preventScroll: true });
};

export default function FieldsPane({ detail, docType, readOnly, onSave, onVerify }) {
  const [onlyAttention, setOnlyAttention] = useState(false);
  const fields = useMemo(() => detail.fields.filter((f) => f.doc_type === docType), [detail.fields, docType]);
  const isDemo = fields.some((f) => f.extraction_mode === "demo_fallback");
  const mode = fields[0]?.extraction_mode;

  const issuesFor = (id) => detail.issues.filter((i) => i.field_ids.includes(id) && i.code !== "LOW_CONFIDENCE" && i.code !== "MISSING_FIELD");
  const attention = (f) => (f.missing && f.required) || (f.low_confidence && !f.verified);
  const verified = fields.filter((f) => f.verified).length;
  const needs = fields.filter(attention).length;

  const header = fields.filter((f) => f.item_index == null);
  const itemGroups = [...new Set(fields.filter((f) => f.item_index != null).map((f) => f.item_index))].sort((a, b) => a - b);
  const show = (f) => !onlyAttention || attention(f);
  const docIssues = detail.issues.filter((i) => i.status === "open" && i.doc_types.includes(docType));

  if (!fields.length)
    return (
      <section className="card h-full">
        <EmptyState icon={ListChecks} title={detail.documents.some((d) => d.doc_type === docType) ? "Not extracted yet" : "No document uploaded"}
          message={detail.documents.some((d) => d.doc_type === docType) ? "Run extraction to read this document into reviewable fields." : "Upload this document first, then run extraction."}
          action={<Link className="btn-secondary" to={`/shipments/${detail.ref}?tab=${detail.documents.some((d) => d.doc_type === docType) ? "overview" : "documents"}`}>Go to shipment</Link>} />
      </section>
    );

  const Section = ({ title, list }) => {
    const visible = list.filter(show);
    if (!visible.length) return null;
    return (
      <div>
        <h4 className="mb-2 mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
        <div className="space-y-2.5">
          {visible.map((f) => <FieldRow key={f.id} field={f} issues={issuesFor(f.id)} readOnly={readOnly} isDemo={isDemo} onSave={onSave} onVerify={onVerify} />)}
        </div>
      </div>
    );
  };

  return (
    <section className="card flex h-full min-h-[420px] flex-col overflow-hidden" aria-label="Extracted fields">
      <div className="space-y-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{DOC_LABELS[docType]}: extracted fields</h2>
            <ModeBadge mode={mode} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
            <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600" checked={onlyAttention} onChange={(e) => setOnlyAttention(e.target.checked)} />
            <Filter className="h-3.5 w-3.5" aria-hidden /> Needs attention only
          </label>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
          <span className="flex items-center gap-1"><CheckCheck className="h-3.5 w-3.5 text-emerald-600" />{verified} of {fields.length} verified</span>
          <span className={needs ? "font-semibold text-amber-700" : ""}>{needs} need attention</span>
        </div>
        {docIssues.length > 0 && (
          <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900">
            {docIssues.slice(0, 4).map((i) => (
              <li key={i.id} className="flex gap-1.5">
                <span className="font-semibold">{CODE_LABELS[i.code] || i.code}:</span>
                <span className="min-w-0 flex-1">{i.message}</span>
                {i.field_ids.length > 0 && <button className="shrink-0 font-medium underline" onClick={() => jump(i.field_ids[0])}>Jump</button>}
              </li>
            ))}
            {docIssues.length > 4 && <li><Link className="font-medium underline" to={`/shipments/${detail.ref}?tab=validation`}>+{docIssues.length - 4} more in Validation</Link></li>}
          </ul>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <Section title="Document fields" list={header} />
        {itemGroups.map((idx) => <Section key={idx} title={`Line item ${idx + 1}`} list={fields.filter((f) => f.item_index === idx)} />)}
        {onlyAttention && !fields.some(attention) && <EmptyState icon={CheckCheck} title="Nothing needs attention" message="Every required field has a value and every low-confidence value is verified." />}
      </div>
    </section>
  );
}
