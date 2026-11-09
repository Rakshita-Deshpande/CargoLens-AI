import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Package, Plus, Search, X } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ShipmentTable from "../components/ShipmentTable";
import CreateShipmentModal from "../components/CreateShipmentModal";
import { TableSkeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useAsync, useDebounced } from "../hooks/useAsync";
import { api } from "../services/api";
import { STATUS_META } from "../utils/format";

export default function Shipments() {
  const { isExecutive } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [creating, setCreating] = useState(false);
  const status = params.get("status") || "";
  const q = useDebounced(search.trim(), 250);

  const { data, loading, error, reload } = useAsync(() => api.listShipments({ ...(status && { status }), ...(q && { search: q }) }), [status, q]);

  // the top-bar search deep-links here with ?search=...
  const urlSearch = params.get("search") || "";
  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);

  const setStatus = (s) => {
    const next = new URLSearchParams(params);
    s ? next.set("status", s) : next.delete("status");
    setParams(next, { replace: true });
  };
  const filtered = Boolean(status || q);

  return (
    <>
      <PageHeader
        title="Shipments" subtitle="All import shipments and their document status."
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Shipments" }]}
        actions={isExecutive && <button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Create shipment</button>}
      />
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input id="shipment-search" className="input pl-9" placeholder="Search by shipment ID, importer, supplier or origin" value={search} aria-label="Search shipments"
              onChange={(e) => { setSearch(e.target.value); const n = new URLSearchParams(params); e.target.value ? n.set("search", e.target.value) : n.delete("search"); setParams(n, { replace: true }); }} />
          </div>
          <select className="input w-auto min-w-[190px]" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {filtered && <button className="btn-ghost" onClick={() => { setSearch(""); setParams({}, { replace: true }); }}><X className="h-4 w-4" /> Clear filters</button>}
        </div>
        {loading ? <TableSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : data.length === 0 ? (
          <EmptyState icon={Package} title={filtered ? "No shipments match your filters" : "No shipments yet"}
            message={filtered ? "Try a different search or clear the filters." : isExecutive ? "Create your first shipment to start uploading documents." : "Shipments created by executives will appear here."}
            action={!filtered && isExecutive && <button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Create shipment</button>} />
        ) : (
          <>
            <ShipmentTable shipments={data} showAssignee />
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">{data.length} {data.length === 1 ? "shipment" : "shipments"}</p>
          </>
        )}
      </div>
      <CreateShipmentModal open={creating} onClose={() => setCreating(false)} onCreated={(s) => { setCreating(false); toast.success("Shipment created", `${s.ref} is ready for documents.`); navigate(`/shipments/${s.ref}?tab=documents`); }} />
    </>
  );
}
