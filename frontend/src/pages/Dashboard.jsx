import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, CheckCircle2, ClipboardCheck, Cog, FileClock, Package, ScanSearch } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import ShipmentTable from "../components/ShipmentTable";
import { ActivityList } from "../components/HistoryTimeline";
import { Skeleton, TableSkeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import { CODE_LABELS, STATUS_META } from "../utils/format";

function activityPerDay(logs, days = 14) {
  const buckets = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  logs.forEach((l) => {
    const k = new Date(l.at).toISOString().slice(0, 10);
    if (buckets.has(k)) buckets.set(k, buckets.get(k) + 1);
  });
  return [...buckets].map(([k, n]) => ({ day: new Date(k).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }), events: n }));
}

export default function Dashboard() {
  const { user, isManager } = useAuth();
  const navigate = useNavigate();
  const stats = useAsync(() => api.stats(), []);
  const list = useAsync(() => api.listShipments(), []);
  const activity = useAsync(() => api.activity({ limit: 500 }), []);
  const summary = useAsync(() => (isManager ? api.reportSummary() : Promise.resolve(null)), [isManager]);

  const perDay = useMemo(() => activityPerDay(activity.data || []), [activity.data]);
  const statusData = useMemo(() => (stats.data ? Object.entries(stats.data.by_status).map(([k, v]) => ({ name: STATUS_META[k].label, count: v })) : []), [stats.data]);
  const withIssues = (list.data || []).filter((s) => s.open_issue_count > 0);
  const s = stats.data;
  const go = (status) => navigate(status ? `/shipments?status=${status}` : "/shipments");
  const first = user.full_name.replace(/\(.*\)/, "").trim().split(" ")[0];

  return (
    <>
      <PageHeader title={`Welcome back, ${first}`} subtitle={isManager ? "Approvals, discrepancies and processing across all shipments." : "Your shipments and what needs your attention today."} />

      {stats.error ? <div className="card mb-6"><ErrorState message={stats.error} onRetry={stats.reload} /></div> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total shipments" value={s?.total} icon={Package} accent="blue" loading={stats.loading} onClick={() => go()} />
          <StatCard label="Pending documents" value={s?.pending_uploads} icon={FileClock} accent="slate" loading={stats.loading} hint="Draft or awaiting extraction" onClick={() => go("documents_uploaded")} />
          <StatCard label="Processing" value={s?.processing} icon={Cog} accent="violet" loading={stats.loading} onClick={() => go("ai_processing")} />
          <StatCard label="Needs review" value={s?.needs_review} icon={ScanSearch} accent="amber" loading={stats.loading} hint={s ? `${s.awaiting_approval} awaiting approval` : undefined} onClick={() => go("needs_review")} />
          <StatCard label="Approved" value={s?.approved} icon={CheckCircle2} accent="emerald" loading={stats.loading} hint={s ? `${s.rejected} rejected` : undefined} onClick={() => go("approved")} />
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div><h2 className="text-sm font-semibold text-slate-900">Shipment activity</h2><p className="text-xs text-slate-500">Audit events per day, last 14 days{isManager ? "" : " (your shipments)"}</p></div>
          </div>
          <div className="h-64 px-2 py-4">
            {activity.loading ? <Skeleton className="mx-4 h-full" /> : activity.error ? <ErrorState message={activity.error} onRetry={activity.reload} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={perDay} margin={{ left: 0, right: 16, top: 8 }}>
                  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2458E6" stopOpacity={0.25} /><stop offset="100%" stopColor="#2458E6" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} width={32} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} />
                  <Area isAnimationActive={false} type="monotone" dataKey="events" name="Events" stroke="#2458E6" strokeWidth={2} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="card">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Shipments by status</h2></div>
          <div className="h-64 px-2 py-4">
            {stats.loading ? <Skeleton className="mx-4 h-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 }} />
                  <Bar isAnimationActive={false} dataKey="count" name="Shipments" fill="#2458E6" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent shipments</h2>
            <Link to="/shipments" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>
          </div>
          {list.loading ? <TableSkeleton rows={4} cols={5} /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.data.length === 0 ? <EmptyState icon={Package} title="No shipments yet" message="Shipments will appear here once created." /> : <ShipmentTable shipments={list.data.slice(0, 5)} compact />}
        </section>

        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4"><AlertOctagon className="h-4 w-4 text-rose-500" aria-hidden /><h2 className="text-sm font-semibold text-slate-900">Discrepancy summary</h2></div>
            <div className="p-5">
              {list.loading ? <Skeleton className="h-16" /> : withIssues.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-slate-600"><ClipboardCheck className="h-4 w-4 text-emerald-600" /> No open validation issues.</p>
              ) : (
                <>
                  <p className="text-sm text-slate-600"><span className="text-2xl font-semibold text-slate-900">{withIssues.reduce((n, x) => n + x.open_issue_count, 0)}</span> open issues across {withIssues.length} {withIssues.length === 1 ? "shipment" : "shipments"}</p>
                  <ul className="mt-3 divide-y divide-slate-100">
                    {withIssues.slice(0, 4).map((x) => (
                      <li key={x.ref}><Link to={`/shipments/${x.ref}?tab=validation`} className="flex items-center justify-between py-2 text-sm hover:text-brand-700"><span className="font-medium">{x.ref}</span><span className="text-rose-600">{x.open_issue_count} open</span></Link></li>
                    ))}
                  </ul>
                </>
              )}
              {isManager && summary.data && Object.keys(summary.data.issues_by_code).length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="eyebrow mb-2">By type (all shipments)</p>
                  <div className="flex flex-wrap gap-1.5">{Object.entries(summary.data.issues_by_code).map(([c, n]) => <span key={c} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{CODE_LABELS[c] || c}: <strong>{n}</strong></span>)}</div>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Recent activity</h2></div>
            <div className="px-5">
              {stats.loading ? <div className="space-y-3 py-4"><Skeleton className="h-4" /><Skeleton className="h-4" /><Skeleton className="h-4" /></div> : s?.recent_activity?.length ? <ActivityList items={s.recent_activity.slice(0, 6)} showShipment /> : <p className="py-6 text-sm text-slate-500">No activity yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
