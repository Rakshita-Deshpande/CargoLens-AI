import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { StatusBadge, ValidationBadge } from "./Badge";
import { DOC_LABELS, DOC_TYPES, timeAgo } from "../utils/format";

const DOC_ABBR = { invoice: "INV", packing_list: "PL", bill_of_lading: "B/L" };

export function DocChips({ present = [] }) {
  return (
    <div className="flex gap-1" aria-label={`${present.length} of 3 documents uploaded`}>
      {DOC_TYPES.map((dt) => {
        const has = present.includes(dt);
        return (
          <span key={dt} title={`${DOC_LABELS[dt]}: ${has ? "uploaded" : "missing"}`} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${has ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20" : "bg-slate-100 text-slate-400 line-through"}`}>
            {DOC_ABBR[dt]}
          </span>
        );
      })}
    </div>
  );
}

/** compact=true is used on the dashboard (fewer columns). */
export default function ShipmentTable({ shipments, compact = false, showAssignee = true }) {
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px]">
        <thead className="border-b border-slate-200 bg-slate-50/70">
          <tr>
            <th className="th">Shipment</th>
            <th className="th">Importer / Origin</th>
            {!compact && <th className="th">Documents</th>}
            <th className="th">Status</th>
            <th className="th">Validation</th>
            {!compact && showAssignee && <th className="th">Assigned to</th>}
            <th className="th">Updated</th>
            <th className="th"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {shipments.map((s) => (
            <tr key={s.ref} className="cursor-pointer transition-colors hover:bg-slate-50" onClick={() => navigate(`/shipments/${s.ref}`)}>
              <td className="td">
                <Link to={`/shipments/${s.ref}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-brand-700 hover:underline">{s.ref}</Link>
              </td>
              <td className="td">
                <p className="font-medium text-slate-900">{s.importer_name || "-"}</p>
                <p className="text-xs text-slate-500">{s.origin_country || "-"}</p>
              </td>
              {!compact && <td className="td"><DocChips present={s.documents_present} /></td>}
              <td className="td"><StatusBadge status={s.status} /></td>
              <td className="td"><ValidationBadge status={s.validation_status} count={s.open_issue_count} /></td>
              {!compact && showAssignee && <td className="td text-slate-600">{s.assigned_to?.name?.replace(/\(.*\)/, "").trim() || "-"}</td>}
              <td className="td whitespace-nowrap text-slate-500">{timeAgo(s.updated_at)}</td>
              <td className="td text-right">
                <ArrowUpRight className="inline h-4 w-4 text-slate-400" aria-hidden />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
