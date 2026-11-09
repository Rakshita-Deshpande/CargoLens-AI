import { useState } from "react";
import { History } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { TableSkeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { useAsync, useDebounced } from "../hooks/useAsync";
import { api } from "../services/api";
import { ACTION_LABELS, actionLabel, formatDateTime } from "../utils/format";
import { Link } from "react-router-dom";

export default function Activity() {
  const { isManager } = useAuth();
  const [shipment, setShipment] = useState("");
  const [action, setAction] = useState("");
  const ref = useDebounced(shipment.trim(), 300);
  const { data, loading, error, reload } = useAsync(() => api.activity({ limit: 200, ...(ref && { shipment: ref }), ...(action && { action }) }), [ref, action]);

  return (
    <>
      <PageHeader title="Activity history" subtitle={isManager ? "Every recorded action across all shipments." : "Recorded actions on your shipments."} breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Activity history" }]} />
      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <input className="input max-w-[220px]" placeholder="Shipment ID, e.g. SHP-24811" value={shipment} onChange={(e) => setShipment(e.target.value)} aria-label="Filter by shipment" />
          <select className="input w-auto min-w-[200px]" value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filter by action">
            <option value="">All actions</option>
            {Object.keys(ACTION_LABELS).map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
          </select>
        </div>
        {loading ? <TableSkeleton cols={5} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.length === 0 ? <EmptyState icon={History} title="No activity found" message="Try different filters." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px]">
            <thead className="border-b border-slate-200 bg-slate-50/70"><tr><th className="th">When</th><th className="th">User</th><th className="th">Action</th><th className="th">Shipment</th><th className="th">Detail</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{data.map((a) => (
              <tr key={a.id}><td className="td whitespace-nowrap text-slate-500">{formatDateTime(a.at)}</td><td className="td">{(a.user || "System").replace(/\(.*\)/, "").trim()}</td><td className="td capitalize">{actionLabel(a.action)}</td>
                <td className="td">{a.shipment_ref ? <Link className="font-medium text-brand-700 hover:underline" to={`/shipments/${a.shipment_ref}`}>{a.shipment_ref}</Link> : "-"}</td><td className="td max-w-[360px] truncate text-slate-500" title={a.detail}>{a.detail || "-"}</td></tr>
            ))}</tbody></table></div>
        )}
      </div>
    </>
  );
}
