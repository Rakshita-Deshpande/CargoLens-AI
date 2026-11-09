import { actionLabel, formatDateTime } from "../utils/format";
import { StatusBadge } from "./Badge";

export function TransitionTimeline({ transitions = [] }) {
  if (!transitions.length) return <p className="text-sm text-slate-500">No status changes yet.</p>;
  return (
    <ol className="relative space-y-5 border-l border-slate-200 pl-6">
      {[...transitions].reverse().map((t, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" aria-hidden />
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={t.to_status} />
            <span className="text-xs text-slate-500">{formatDateTime(t.at)}</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {t.user || "System"}
            {t.comment ? <span className="text-slate-500"> - {t.comment}</span> : null}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function ActivityList({ items = [], showShipment = false }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 py-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-700">
              <span className="font-medium text-slate-900">{(a.user || "System").replace(/\(.*\)/, "").trim()}</span> {actionLabel(a.action)}
              {showShipment && a.shipment_ref ? <span className="font-medium text-brand-700"> {a.shipment_ref}</span> : null}
            </p>
            {a.detail && <p className="mt-0.5 truncate text-xs text-slate-500" title={a.detail}>{a.detail}</p>}
            <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(a.at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
