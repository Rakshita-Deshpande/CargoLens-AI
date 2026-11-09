import { useRef, useState } from "react";
import { CheckCircle2, FileText, Image as ImageIcon, Replace, UploadCloud } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "../context/ToastContext";
import { api, parseError } from "../services/api";
import { DOC_LABELS, DOC_TYPES, formatBytes, formatDateTime } from "../utils/format";

const MAX_MB = 10;
const ALLOWED = [".pdf", ".jpg", ".jpeg", ".png"];

function clientCheck(file) {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED.includes(ext)) return "Unsupported file type. Upload a PDF, JPG or PNG.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_MB * 1024 * 1024) return `File is too large (${formatBytes(file.size)}). Maximum is ${MAX_MB} MB.`;
  return null;
}

function Slot({ docType, doc, disabled, hasExtraction, onUploaded }) {
  const toast = useToast();
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null);

  const upload = async (file) => {
    setError("");
    setPending(null);
    const problem = clientCheck(file);
    if (problem) return setError(problem);
    setProgress(0);
    try {
      const detail = await api.uploadDocument(onUploaded.ref, docType, file, setProgress);
      toast.success(`${DOC_LABELS[docType]} uploaded`, file.name);
      onUploaded.update(detail);
    } catch (err) {
      setError(parseError(err).message);
    } finally {
      setProgress(null);
    }
  };

  const choose = (file) => {
    if (!file) return;
    if (doc && hasExtraction) setPending(file);
    else upload(file);
  };

  const uploading = progress !== null;
  const Icon = doc?.content_type === "application/pdf" ? FileText : ImageIcon;

  return (
    <div className="card flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{DOC_LABELS[docType]}</h3>
        {doc ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Uploaded</span> : <span className="text-xs font-medium text-slate-400">Required</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {doc && (
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 ring-1 ring-slate-200"><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900" title={doc.filename}>{doc.filename}</p>
              <p className="text-xs text-slate-500">{formatBytes(doc.size_bytes)} - {formatDateTime(doc.uploaded_at)}</p>
            </div>
          </div>
        )}
        <div
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled && !uploading) choose(e.dataTransfer.files[0]); }}
          className={`flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
            disabled ? "border-slate-200 bg-slate-50 opacity-60" : drag ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-500 hover:bg-brand-50/40"
          }`}
        >
          {uploading ? (
            <div className="w-full" role="status" aria-label={`Uploading ${progress}%`}>
              <p className="mb-2 text-sm font-medium text-slate-700">Uploading... {progress}%</p>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
          ) : (
            <>
              {doc ? <Replace className="h-6 w-6 text-slate-400" aria-hidden /> : <UploadCloud className="h-6 w-6 text-slate-400" aria-hidden />}
              <p className="mt-2 text-sm text-slate-600">{doc ? "Drop a new file to replace" : "Drag and drop, or"}</p>
              <button type="button" className="btn-secondary btn-sm mt-2" disabled={disabled} onClick={() => input.current?.click()}>
                {doc ? "Replace file" : "Choose file"}
              </button>
              <p className="mt-2 text-[11px] text-slate-400">PDF, JPG or PNG, up to {MAX_MB} MB</p>
            </>
          )}
          <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" tabIndex={-1} aria-label={`Upload ${DOC_LABELS[docType]}`}
            onChange={(e) => { choose(e.target.files[0]); e.target.value = ""; }} />
        </div>
        {error && <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      </div>
      <ConfirmDialog open={Boolean(pending)} title="Replace this document?" confirmLabel="Replace" tone="danger" onCancel={() => setPending(null)} onConfirm={() => upload(pending)}
        message={`Replacing the ${DOC_LABELS[docType]} discards the values extracted from it, including corrections. You will need to run extraction again.`} />
    </div>
  );
}

export default function DocumentUploader({ detail, onUpdate, disabled, disabledReason }) {
  const byType = Object.fromEntries(detail.documents.map((d) => [d.doc_type, d]));
  const ctx = { ref: detail.ref, update: onUpdate };
  return (
    <div>
      {disabled && disabledReason && <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{disabledReason}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        {DOC_TYPES.map((dt) => (
          <Slot key={dt} docType={dt} doc={byType[dt]} disabled={disabled} hasExtraction={detail.fields.some((f) => f.doc_type === dt)} onUploaded={ctx} />
        ))}
      </div>
    </div>
  );
}
