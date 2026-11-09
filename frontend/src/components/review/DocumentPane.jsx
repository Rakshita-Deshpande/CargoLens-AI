import { useEffect, useRef, useState } from "react";
import { ExternalLink, FileX, ZoomIn, ZoomOut } from "lucide-react";
import { Skeleton } from "../Skeleton";
import { ErrorState } from "../States";
import { api, parseError } from "../../services/api";
import { DOC_LABELS, DOC_TYPES, formatBytes } from "../../utils/format";

export default function DocumentPane({ detail, docType, onDocType }) {
  const doc = detail.documents.find((d) => d.doc_type === docType);
  const cache = useRef(new Map());
  const [state, setState] = useState({ url: null, loading: false, error: null });
  const [zoom, setZoom] = useState(100);

  useEffect(() => () => cache.current.forEach((u) => URL.revokeObjectURL(u)), []);

  useEffect(() => {
    if (!doc) return setState({ url: null, loading: false, error: null });
    const cached = cache.current.get(doc.id);
    if (cached) return setState({ url: cached, loading: false, error: null });
    let alive = true;
    setState({ url: null, loading: true, error: null });
    api
      .documentBlob(doc.id)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        cache.current.set(doc.id, url);
        if (alive) setState({ url, loading: false, error: null });
      })
      .catch((err) => alive && setState({ url: null, loading: false, error: parseError(err).message }));
    return () => {
      alive = false;
    };
  }, [doc?.id]);

  const isPdf = doc?.content_type === "application/pdf";
  return (
    <section className="card flex h-full min-h-[420px] flex-col overflow-hidden" aria-label="Document preview">
      <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50/70 px-2 pt-2" role="tablist">
        {DOC_TYPES.map((dt) => {
          const has = detail.documents.some((d) => d.doc_type === dt);
          return (
            <button key={dt} role="tab" aria-selected={dt === docType} onClick={() => onDocType(dt)}
              className={`rounded-t-lg border border-b-0 px-3.5 py-2 text-sm font-medium transition-colors ${dt === docType ? "border-slate-200 bg-white text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
              {DOC_LABELS[dt]} {!has && <span className="ml-1 text-xs font-normal text-rose-500">missing</span>}
            </button>
          );
        })}
      </div>
      {doc && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
          <span className="truncate" title={doc.filename}>{doc.filename} - {formatBytes(doc.size_bytes)}</span>
          <div className="flex shrink-0 items-center gap-1">
            {!isPdf && state.url && (
              <>
                <button className="btn-ghost btn-sm" onClick={() => setZoom((z) => Math.max(50, z - 25))} aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
                <span className="w-10 text-center tabular-nums">{zoom}%</span>
                <button className="btn-ghost btn-sm" onClick={() => setZoom((z) => Math.min(300, z + 25))} aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
              </>
            )}
            {state.url && <a className="btn-ghost btn-sm" href={state.url} target="_blank" rel="noreferrer" title="If the preview is blank, your browser's built-in PDF viewer may be disabled. Open the file in a new tab."><ExternalLink className="h-3.5 w-3.5" /> Open in new tab</a>}
          </div>
        </div>
      )}
      <div className="relative min-h-0 flex-1 bg-slate-100">
        {!doc ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <FileX className="h-10 w-10 text-slate-300" aria-hidden />
            <p className="mt-3 text-sm font-medium text-slate-700">{DOC_LABELS[docType]} has not been uploaded</p>
            <p className="mt-1 text-xs text-slate-500">Upload it from the shipment's Documents tab. Missing documents block approval.</p>
          </div>
        ) : state.loading ? (
          <div className="space-y-3 p-6"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-[320px] w-full" /></div>
        ) : state.error ? (
          <ErrorState message={state.error} />
        ) : isPdf ? (
          <iframe title={`${DOC_LABELS[docType]} preview`} src={state.url} className="h-full w-full border-0 bg-white" />
        ) : (
          <div className="h-full overflow-auto p-4"><img src={state.url} alt={`${DOC_LABELS[docType]} scan`} style={{ width: `${zoom}%`, maxWidth: "none" }} className="rounded bg-white shadow" /></div>
        )}
      </div>
    </section>
  );
}
