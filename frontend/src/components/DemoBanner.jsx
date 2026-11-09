import { FlaskConical } from "lucide-react";

/** Always-visible honesty notice when extraction is the synthetic demo fallback. */
export default function DemoBanner({ status, compact = false }) {
  if (!status?.is_demo) return null;
  return (
    <div className={`flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 ${compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"}`} role="note">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <p>
        <strong className="font-semibold">Demo / fallback extraction.</strong> Extracted values come from synthetic sample data and are <strong className="font-semibold">not</strong> produced by an AI model.
        {!compact && status.message ? <span className="mt-0.5 block text-amber-800/80">{status.message.replace("DEMO/FALLBACK MODE: results are synthetic sample data, NOT AI-generated. ", "")}</span> : null}
      </p>
    </div>
  );
}
