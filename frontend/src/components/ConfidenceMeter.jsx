import { pct } from "../utils/format";

/** Confidence as a number AND a bar (never colour alone). */
export default function ConfidenceMeter({ value, low, missing }) {
  if (missing) return <span className="text-xs font-medium text-slate-400">no value</span>;
  const color = low ? "bg-amber-500" : value >= 0.95 ? "bg-emerald-500" : "bg-brand-500";
  return (
    <div className="flex items-center gap-2" title={`Model confidence ${pct(value)}`}>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200" aria-hidden>
        <div className={`h-full rounded-full ${color}`} style={{ width: pct(value) }} />
      </div>
      <span className={`w-9 text-right text-xs font-semibold tabular-nums ${low ? "text-amber-700" : "text-slate-600"}`}>{pct(value)}</span>
    </div>
  );
}
