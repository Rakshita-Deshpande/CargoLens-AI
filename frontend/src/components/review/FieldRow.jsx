import { useEffect, useState } from "react";
import { BadgeCheck, Check, Pencil, RotateCcw, X } from "lucide-react";
import ConfidenceMeter from "../ConfidenceMeter";
import Spinner from "../Spinner";
import { Pill } from "../Badge";

/** One extracted field: editable value, confidence, verification and validation messages. */
export default function FieldRow({ field, issues = [], readOnly, isDemo, onSave, onVerify }) {
  const [draft, setDraft] = useState(field.value ?? "");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(field.value ?? "");
    setError("");
  }, [field.value, field.id]);

  const dirty = draft.trim() !== (field.value ?? "");
  const needsAttention = (field.missing && field.required) || (field.low_confidence && !field.verified);
  const tone = field.missing && field.required ? "border-rose-300 bg-rose-50/60" : field.low_confidence && !field.verified ? "border-amber-300 bg-amber-50/60" : field.verified ? "border-emerald-200 bg-white" : "border-slate-200 bg-white";

  const run = async (kind, fn) => {
    setBusy(kind);
    setError("");
    const res = await fn();
    setBusy(null);
    if (!res.ok) setError(res.message);
  };
  const save = () => dirty && run("save", () => onSave(field.id, draft.trim()));
  const onKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") { setDraft(field.value ?? ""); setError(""); }
  };

  return (
    <div id={`field-${field.id}`} className={`rounded-lg border p-3 transition-colors ${tone}`} data-attention={needsAttention || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`in-${field.id}`} className="text-sm font-medium text-slate-800">
          {field.label}{field.required && <span className="ml-0.5 text-rose-500" title="Required">*</span>}
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {field.missing && <Pill tone="rose">Missing</Pill>}
          {field.low_confidence && !field.verified && <Pill tone="amber">Low confidence</Pill>}
          {field.corrected && <Pill tone="blue"><Pencil className="h-3 w-3" />Edited</Pill>}
          {field.verified && <Pill tone="emerald"><BadgeCheck className="h-3 w-3" />Verified</Pill>}
          <ConfidenceMeter value={field.confidence} low={field.low_confidence} missing={field.missing} />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          id={`in-${field.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} disabled={readOnly || busy !== null}
          className={`input ${dirty ? "border-brand-500 ring-1 ring-brand-500/30" : ""} ${field.kind === "number" || field.kind === "int" ? "tabular-nums" : ""}`}
          placeholder={field.missing ? "Not found - enter from the document" : ""} inputMode={field.kind === "number" || field.kind === "int" ? "decimal" : undefined}
          aria-invalid={Boolean(error)} aria-describedby={error ? `err-${field.id}` : undefined}
        />
        {dirty && !readOnly ? (
          <>
            <button className="btn-primary btn-sm shrink-0" onClick={save} disabled={busy !== null} aria-label={`Save ${field.label}`}>{busy === "save" ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />} Save</button>
            <button className="btn-ghost btn-sm shrink-0" onClick={() => { setDraft(field.value ?? ""); setError(""); }} aria-label="Discard change"><X className="h-3.5 w-3.5" /></button>
          </>
        ) : (
          !readOnly && (
            <button
              className={`btn-sm shrink-0 ${field.verified ? "btn-secondary text-emerald-700" : "btn-secondary"}`}
              disabled={busy !== null || field.missing} onClick={() => run("verify", () => onVerify(field.id, !field.verified))}
              title={field.missing ? "Enter a value before verifying" : field.verified ? "Remove verification" : "Confirm this value matches the document"} aria-pressed={field.verified}
            >
              {busy === "verify" ? <Spinner className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />} {field.verified ? "Verified" : "Verify"}
            </button>
          )
        )}
      </div>

      {error && <p id={`err-${field.id}`} role="alert" className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}

      {(field.source_text && field.source_text !== field.value) || field.corrected ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {field.source_text && field.source_text !== field.value && <span>As printed: <span className="font-mono text-slate-700">{field.source_text}</span></span>}
          {field.corrected && (
            <span className="flex items-center gap-1.5">
              {isDemo ? "Demo value" : "AI value"}: <span className="font-mono text-slate-700">{field.ai_value ?? "(none)"}</span>
              {!readOnly && <button className="inline-flex items-center gap-0.5 font-medium text-brand-700 hover:underline disabled:opacity-50" disabled={busy !== null} onClick={() => run("revert", () => onSave(field.id, field.ai_value ?? ""))}><RotateCcw className="h-3 w-3" />Restore</button>}
            </span>
          )}
        </div>
      ) : null}

      {issues.map((i) => (
        <p key={i.id} className={`mt-1.5 rounded px-2 py-1 text-xs ${i.status === "resolved" ? "bg-blue-50 text-blue-800" : "bg-rose-50 text-rose-800"}`}>
          {i.status === "resolved" ? "Discrepancy resolved by reviewer: " : ""}{i.message}
        </p>
      ))}
    </div>
  );
}
