import { Info } from "lucide-react";
import PageHeader from "../components/PageHeader";
import DemoBanner from "../components/DemoBanner";
import { ModeBadge } from "../components/Badge";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { API_BASE_URL, api } from "../services/api";

function Row({ label, children }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 py-3"><dt className="text-sm text-slate-500">{label}</dt><dd className="text-sm font-medium text-slate-900">{children}</dd></div>;
}

export default function Settings() {
  const { user } = useAuth();
  const provider = useAsync(() => api.extractionStatus(), []);
  // Thresholds are exposed by the validation endpoint of any shipment the user can see.
  const thresholds = useAsync(async () => {
    const list = await api.listShipments();
    return list.length ? (await api.validation(list[0].ref)).settings : null;
  }, []);

  return (
    <>
      <PageHeader title="Settings" subtitle="Read-only view of your account and the system configuration." breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Settings" }]} />
      <div className="mb-6 flex items-start gap-2 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600"><Info className="mt-0.5 h-4 w-4 shrink-0" />The backend has no settings-management endpoint, so nothing here can be edited. Thresholds and extraction mode are configured through the backend <code className="rounded bg-white px-1">.env</code> file.</div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card card-pad"><h2 className="text-sm font-semibold text-slate-900">Your account</h2>
          <dl className="mt-2 divide-y divide-slate-100"><Row label="Name">{user.full_name}</Row><Row label="Username">{user.username}</Row><Row label="Role"><span className="capitalize">{user.role}</span></Row></dl></section>
        <section className="card card-pad"><h2 className="text-sm font-semibold text-slate-900">Connection</h2>
          <dl className="mt-2 divide-y divide-slate-100"><Row label="API base URL"><code className="text-xs">{API_BASE_URL}</code></Row><Row label="Variable"><code className="text-xs">VITE_API_BASE_URL</code></Row></dl></section>
        <section className="card card-pad"><h2 className="text-sm font-semibold text-slate-900">AI extraction</h2>
          <div className="mt-3">{provider.loading ? <p className="text-sm text-slate-400">Loading...</p> : provider.error ? <p className="text-sm text-rose-600">{provider.error}</p> : (
            <><dl className="divide-y divide-slate-100"><Row label="Mode"><ModeBadge mode={provider.data.mode} /></Row>{provider.data.model && <Row label="Model">{provider.data.model}</Row>}</dl>
              <div className="mt-3"><DemoBanner status={provider.data} /></div>{!provider.data.is_demo && <p className="mt-3 text-sm text-slate-600">{provider.data.message}</p>}</>
          )}</div></section>
        <section className="card card-pad"><h2 className="text-sm font-semibold text-slate-900">Validation thresholds</h2>
          <div className="mt-3">{thresholds.loading ? <p className="text-sm text-slate-400">Loading...</p> : !thresholds.data ? <p className="text-sm text-slate-500">Unavailable: no shipment exists to read them from.</p> : (
            <><dl className="divide-y divide-slate-100"><Row label="Gross-weight tolerance">{thresholds.data.weight_tolerance_pct}%</Row><Row label="Amount tolerance">{thresholds.data.amount_tolerance}</Row><Row label="Low-confidence threshold">{Math.round(thresholds.data.low_confidence_threshold * 100)}%</Row></dl>
              <p className="mt-3 text-xs text-slate-500">{thresholds.data.note}</p></>
          )}</div></section>
      </div>
    </>
  );
}
