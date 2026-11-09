import { ScanSearch } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ShipmentTable from "../components/ShipmentTable";
import { TableSkeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";

export default function ReviewQueue() {
  const { data, loading, error, reload } = useAsync(() => api.listShipments(), []);
  const queue = (data || []).filter((s) => ["documents_uploaded", "needs_review", "rejected"].includes(s.status) && s.document_count > 0);
  const priority = { rejected: 0, needs_review: 1, documents_uploaded: 2 };
  queue.sort((a, b) => priority[a.status] - priority[b.status]);
  return (
    <>
      <PageHeader title="Document review" subtitle="Shipments with documents waiting for extraction or human review. Open one to compare the document with its extracted fields." breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Document review" }]} />
      <div className="card">
        {loading ? <TableSkeleton rows={4} /> : error ? <ErrorState message={error} onRetry={reload} /> : queue.length === 0 ? (
          <EmptyState icon={ScanSearch} title="Nothing to review" message="Shipments appear here once documents are uploaded and until they are submitted for approval." />
        ) : <ShipmentTable shipments={queue} />}
      </div>
    </>
  );
}
