import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Download, FileDown, FlaskConical } from "lucide-react";
import PageHeader from "../components/PageHeader";
import Tabs from "../components/Tabs";
import StatCard from "../components/StatCard";
import { Pill } from "../components/Badge";
import { Skeleton, TableSkeleton } from "../components/Skeleton";
import { EmptyState, ErrorState } from "../components/States";
import { useToast } from "../context/ToastContext";
import { useAsync } from "../hooks/useAsync";
import { api } from "../services/api";
import { CODE_LABELS, DOC_LABELS, downloadBlob, formatDateTime, rowsToCsv } from "../utils/format";
import { CheckCircle2, Clock, Package, Send } from "lucide-react";

const AXIS = { fontSize: 11, fill: "#64748B" };
const TIP = { contentStyle: { borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12 } };

function CsvButton({ name, columns, rows, disabled }) {
  const toast = useToast();
  return (
    <button className="btn-secondary btn-sm" disabled={disabled || !rows?.length}
      onClick={() => { downloadBlob(new Blob([rowsToCsv(columns, rows)], { type: "text/csv;charset=utf-8" }), `${name}-${new Date().toISOString().slice(0, 10)}.csv`); toast.success("CSV downloaded", name); }}>
      <FileDown className="h-3.5 w-3.5" /> Download CSV
    </button>
  );
}

function Panel({ title, subtitle, action, children }) {
  return <section className="card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="text-sm font-semibold text-slate-900">{title}</h3>{subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}</div>{action}</div>{children}</section>;
}

function Overview() {
  const { data, loading, error, reload } = useAsync(() => api.reportSummary(), []);
  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  const statusData = data ? Object.values(data.by_status).map((s) => ({ name: s.label, count: s.count })) : [];
  const codes = data ? Object.entries(data.issues_by_code).map(([c, n]) => ({ name: CODE_LABELS[c] || c, count: n })).sort((a, b) => b.count - a.count) : [];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total shipments" value={data?.total_shipments} icon={Package} loading={loading} />
        <StatCard label="Approved" value={data?.approved_count} icon={CheckCircle2} accent="emerald" loading={loading} />
        <StatCard label="Exports" value={data?.exports_total} icon={Send} accent="violet" loading={loading} />
        <StatCard label="Avg. creation to approval" value={data?.avg_hours_created_to_approval != null ? `${data.avg_hours_created_to_approval} h` : "-"} icon={Clock} accent="amber" loading={loading} hint="Elapsed time, not staff effort" />
      </div>
      {data?.note && <p className="rounded-lg bg-slate-100 px-4 py-3 text-xs text-slate-600">{data.note}</p>}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Shipments by status">
          <div className="h-72 px-2 py-4">{loading ? <Skeleton className="mx-4 h-full" /> : (
            <ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} margin={{ left: 0, right: 16 }}><CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={56} /><YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={28} /><Tooltip {...TIP} cursor={{ fill: "#F1F5F9" }} /><Bar isAnimationActive={false} dataKey="count" name="Shipments" fill="#2458E6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          )}</div>
        </Panel>
        <Panel title="Discrepancies and issues by type" subtitle="Distribution across current issues. A trend over time is not available: the backend does not expose issue timestamps.">
          <div className="h-72 px-2 py-4">{loading ? <Skeleton className="mx-4 h-full" /> : codes.length === 0 ? <EmptyState title="No issues recorded" message="Run extraction on a shipment to generate validation results." /> : (
            <ResponsiveContainer width="100%" height="100%"><BarChart data={codes} layout="vertical" margin={{ left: 8, right: 16 }}><CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" width={150} tick={{ ...AXIS, fill: "#475569" }} tickLine={false} axisLine={false} /><Tooltip {...TIP} cursor={{ fill: "#F1F5F9" }} /><Bar isAnimationActive={false} dataKey="count" name="Issues" fill="#E11D48" radius={[0, 4, 4, 0]} barSize={14} /></BarChart></ResponsiveContainer>
          )}</div>
        </Panel>
      </div>
    </div>
  );
}

function Accuracy() {
  const { data, loading, error, reload } = useAsync(() => api.reportAccuracy(), []);
  const [mode, setMode] = useState(null);
  if (loading) return <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-72" /></div>;
  if (error) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  const modes = Object.keys(data.modes);
  const active = mode && data.modes[mode] ? mode : modes[0];
  const m = data.modes[active];
  const isDemo = active === "demo_fallback";
  const chart = m?.by_field.filter((f) => f.accuracy_pct != null).map((f) => ({ name: `${f.label}`, acc: f.accuracy_pct }));
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="note"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><p>{data.disclaimer}</p></div>
      {modes.length === 0 ? <div className="card"><EmptyState title="No extraction data yet" message="Run extraction and review some fields to populate this report." /></div> : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {modes.map((k) => <button key={k} onClick={() => setMode(k)} className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${k === active ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"}`}>{k === "demo_fallback" ? "Demo fallback (synthetic)" : "Real AI extraction"}</button>)}
          </div>
          <div className={`rounded-lg px-4 py-2.5 text-sm font-medium ${isDemo ? "bg-amber-100 text-amber-900" : "bg-violet-50 text-violet-800"}`}>{isDemo && <FlaskConical className="mr-2 inline h-4 w-4" />}{m.label}</div>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Fields extracted" value={m.overall.fields_total} />
            <StatCard label="Fields reviewed" value={m.overall.fields_reviewed} hint="Verified or corrected by a person" />
            <StatCard label="Corrected" value={m.overall.fields_corrected} accent="amber" />
            <StatCard label={isDemo ? "Demo accuracy (not real)" : "Measured accuracy"} value={m.overall.accuracy_pct != null ? `${m.overall.accuracy_pct}%` : "-"} accent={isDemo ? "slate" : "emerald"} hint={`Target ${data.target_pct}% on 200 historical shipments`} />
          </div>
          <Panel title="Accuracy by field" subtitle="Reviewed fields not corrected, as a share of reviewed fields">
            {chart.length === 0 ? <EmptyState title="No reviewed fields yet" message="Verify or correct fields in the Review screen to measure accuracy." /> : (
              <div className="h-80 px-2 py-4"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{ left: 0, right: 16 }}><CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={70} /><YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} width={32} unit="%" /><Tooltip {...TIP} cursor={{ fill: "#F1F5F9" }} formatter={(v) => `${v}%`} /><Bar isAnimationActive={false} dataKey="acc" name="Accuracy" radius={[4, 4, 0, 0]}>{chart.map((c, i) => <Cell key={i} fill={isDemo ? "#94A3B8" : c.acc >= data.target_pct ? "#059669" : "#2458E6"} />)}</Bar></BarChart></ResponsiveContainer></div>
            )}
          </Panel>
          <Panel title="Supplier-level performance" action={<CsvButton name="supplier-accuracy" columns={[{ key: "supplier", label: "Supplier" }, { key: "fields_total", label: "Fields" }, { key: "fields_reviewed", label: "Reviewed" }, { key: "fields_corrected", label: "Corrected" }, { key: "accuracy_pct", label: "Accuracy %" }]} rows={m.by_supplier} />}>
            <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead className="border-b border-slate-200 bg-slate-50/70"><tr><th className="th">Supplier</th><th className="th">Fields</th><th className="th">Reviewed</th><th className="th">Corrected</th><th className="th">Accuracy</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{m.by_supplier.map((s) => <tr key={s.supplier}><td className="td font-medium text-slate-900">{s.supplier}</td><td className="td">{s.fields_total}</td><td className="td">{s.fields_reviewed}</td><td className="td">{s.fields_corrected}</td><td className="td">{s.accuracy_pct != null ? `${s.accuracy_pct}%` : <span className="text-slate-400">no reviews yet</span>}</td></tr>)}</tbody></table></div>
          </Panel>
        </>
      )}
    </div>
  );
}

function Discrepancies() {
  const [status, setStatus] = useState("");
  const { data, loading, error, reload } = useAsync(() => api.reportDiscrepancies(status), [status]);
  return (
    <Panel title="Discrepancy report" subtitle="Cross-document mismatches and how reviewers resolved them"
      action={<div className="flex items-center gap-2"><select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status"><option value="">All</option><option value="open">Open</option><option value="resolved">Resolved</option></select>
        <CsvButton name="discrepancies" columns={[{ key: "shipment_ref", label: "Shipment" }, { key: "code", label: "Type" }, { key: "message", label: "Description" }, { key: "status", label: "Status" }, { key: "resolution_note", label: "Resolution note" }, { key: "resolved_by", label: "Resolved by" }, { key: "resolved_at", label: "Resolved at" }]} rows={data} /></div>}>
      {loading ? <TableSkeleton cols={4} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.length === 0 ? <EmptyState icon={CheckCircle2} title="No discrepancies" message="Nothing matches this filter." /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead className="border-b border-slate-200 bg-slate-50/70"><tr><th className="th">Shipment</th><th className="th">Type</th><th className="th">Description</th><th className="th">Status</th><th className="th">Resolution</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.map((d) => <tr key={d.id}><td className="td font-semibold text-brand-700">{d.shipment_ref}</td><td className="td whitespace-nowrap">{CODE_LABELS[d.code] || d.code}</td><td className="td max-w-[360px]">{d.message}</td>
            <td className="td"><Pill tone={d.status === "resolved" ? "blue" : "rose"}>{d.status === "resolved" ? "Resolved" : "Open"}</Pill></td><td className="td max-w-[260px] text-slate-600">{d.resolution_note ? <>{d.resolution_note}<span className="block text-xs text-slate-400">{d.resolved_by}</span></> : "-"}</td></tr>)}</tbody></table></div>
      )}
    </Panel>
  );
}

function Exports() {
  const { data, loading, error, reload } = useAsync(() => api.exportHistory(), []);
  return (
    <Panel title="Export history" subtitle="Every CSV/Excel export is recorded. Layout is provisional until the client's filing-software template is supplied."
      action={<CsvButton name="export-history" columns={[{ key: "shipment_ref", label: "Shipment" }, { key: "filename", label: "File" }, { key: "format", label: "Format" }, { key: "row_count", label: "Rows" }, { key: "user", label: "Exported by" }, { key: "at", label: "When" }]} rows={data} />}>
      {loading ? <TableSkeleton cols={5} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.length === 0 ? <EmptyState icon={Download} title="No exports yet" message="Approved shipments can be exported from their detail page." /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[640px]"><thead className="border-b border-slate-200 bg-slate-50/70"><tr><th className="th">Shipment</th><th className="th">File</th><th className="th">Format</th><th className="th">Rows</th><th className="th">Exported by</th><th className="th">When</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.map((e) => <tr key={e.id}><td className="td font-semibold text-brand-700">{e.shipment_ref}</td><td className="td font-mono text-xs">{e.filename}</td><td className="td uppercase">{e.format}</td><td className="td">{e.row_count}</td><td className="td">{e.user}</td><td className="td whitespace-nowrap text-slate-500">{formatDateTime(e.at)}</td></tr>)}</tbody></table></div>
      )}
    </Panel>
  );
}

function Corrections() {
  const { data, loading, error, reload } = useAsync(() => api.reportCorrections(), []);
  return (
    <Panel title="Correction history" subtitle="Every value a reviewer changed, with the original extracted value"
      action={<CsvButton name="corrections" columns={[{ key: "shipment_ref", label: "Shipment" }, { key: "doc_type", label: "Document" }, { key: "key", label: "Field" }, { key: "old_value", label: "Before" }, { key: "new_value", label: "After" }, { key: "user", label: "By" }, { key: "at", label: "When" }]} rows={data} />}>
      {loading ? <TableSkeleton cols={5} /> : error ? <ErrorState message={error} onRetry={reload} /> : data.length === 0 ? <EmptyState title="No corrections yet" message="Corrections made in the Review screen are listed here." /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[680px]"><thead className="border-b border-slate-200 bg-slate-50/70"><tr><th className="th">Shipment</th><th className="th">Field</th><th className="th">Before</th><th className="th">After</th><th className="th">By</th><th className="th">When</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.map((c) => <tr key={c.id}><td className="td font-semibold text-brand-700">{c.shipment_ref}</td><td className="td">{DOC_LABELS[c.doc_type]} / {c.key}{c.item_index != null ? ` (item ${c.item_index + 1})` : ""}</td><td className="td font-mono text-xs">{c.old_value ?? "(empty)"}</td><td className="td font-mono text-xs">{c.new_value ?? "(empty)"}</td><td className="td">{c.user}</td><td className="td whitespace-nowrap text-slate-500">{formatDateTime(c.at)}</td></tr>)}</tbody></table></div>
      )}
    </Panel>
  );
}

const TABS = [{ id: "overview", label: "Overview" }, { id: "accuracy", label: "Extraction accuracy" }, { id: "discrepancies", label: "Discrepancies" }, { id: "exports", label: "Export history" }, { id: "corrections", label: "Corrections" }];

export default function Reports() {
  const [tab, setTab] = useState("overview");
  return (
    <>
      <PageHeader title="Reports" subtitle="Processing statistics, extraction accuracy, discrepancies and exports." breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Reports" }]} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <div className="pt-6">
        {tab === "overview" && <Overview />}
        {tab === "accuracy" && <Accuracy />}
        {tab === "discrepancies" && <Discrepancies />}
        {tab === "exports" && <Exports />}
        {tab === "corrections" && <Corrections />}
      </div>
    </>
  );
}
