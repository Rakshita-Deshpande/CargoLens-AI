import { AlertTriangle, CheckCircle2, CircleSlash, Scale } from "lucide-react";
import { DOC_SHORT, DOC_TYPES } from "../utils/format";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const num = (v) => {
  const m = /-?\d[\d,]*\.?\d*/.exec(v ?? "");
  return m ? Number(m[0].replace(/,/g, "")) : null;
};
const fmt = (n) => (n == null ? "-" : n.toLocaleString("en-IN", { maximumFractionDigits: 3 }));

/**
 * Builds the side-by-side comparison from the extracted fields. This is DISPLAY only: whether something
 * counts as a mismatch is decided by the backend's validation issues, never by this component.
 */
export function buildComparisonRows(detail) {
  const header = (dt, key) => detail.fields.find((f) => f.doc_type === dt && f.item_index == null && f.key === key);
  const items = (dt) => {
    const map = new Map();
    detail.fields.filter((f) => f.doc_type === dt && f.item_index != null).forEach((f) => {
      if (!map.has(f.item_index)) map.set(f.item_index, {});
      map.get(f.item_index)[f.key] = f;
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  };
  const byCode = (codes, textIncludes) => detail.issues.filter((i) => codes.includes(i.code) && (!textIncludes || i.message.includes(textIncludes)));
  const rows = [];

  for (const [key, label, code, unit] of [["gross_weight", "Gross weight", "GROSS_WEIGHT_MISMATCH", "kg"], ["package_count", "Package count", "PACKAGE_COUNT_MISMATCH", ""]]) {
    const cells = Object.fromEntries(DOC_TYPES.map((dt) => [dt, header(dt, key)?.value ?? null]));
    const issues = byCode([code]);
    const note = issues[0]?.details?.difference_kg != null ? `Difference ${fmt(issues[0].details.difference_kg)} kg (${issues[0].details.difference_pct}% vs ${issues[0].details.tolerance_pct}% tolerance)` : null;
    rows.push({ id: key, label, unit, cells, issues, comparable: Object.values(cells).filter((v) => num(v) != null).length >= 2, note });
  }

  const inv = items("invoice");
  const grand = header("invoice", "grand_total")?.value ?? null;
  const sum = inv.every((i) => num(i.line_total?.value) != null) && inv.length ? inv.reduce((s, i) => s + num(i.line_total.value), 0) : null;
  rows.push({
    id: "total", label: "Invoice total vs line items", unit: header("invoice", "invoice_currency")?.value || "",
    cells: { invoice: grand, packing_list: null, bill_of_lading: null }, issues: byCode(["TOTAL_MISMATCH", "LINE_TOTAL_MISMATCH"]),
    comparable: num(grand) != null && sum != null, note: sum != null ? `Sum of line items (calculated for display): ${fmt(sum)}` : null,
  });

  const pl = items("packing_list");
  inv.forEach((item, idx) => {
    const desc = item.description?.value;
    const match = pl.find((p) => norm(p.description?.value) === norm(desc));
    rows.push({
      id: `qty-${idx}`, label: `Quantity: ${desc || `item ${idx + 1}`}`, unit: "",
      cells: { invoice: item.quantity?.value ?? null, packing_list: match?.quantity?.value ?? null, bill_of_lading: null },
      issues: desc ? byCode(["QUANTITY_MISMATCH", "ITEM_NOT_IN_PACKING_LIST"], `'${desc}'`) : [],
      comparable: Boolean(match), note: null,
    });
  });
  return rows;
}

function rowState(r) {
  if (r.issues.some((i) => i.status === "open")) return "mismatch";
  if (r.issues.some((i) => i.status === "resolved")) return "resolved";
  return r.comparable ? "match" : "na";
}

const RESULT = {
  mismatch: { icon: AlertTriangle, text: "Mismatch", cls: "text-rose-700" },
  resolved: { icon: Scale, text: "Resolved by reviewer", cls: "text-blue-700" },
  match: { icon: CheckCircle2, text: "Match", cls: "text-emerald-700" },
  na: { icon: CircleSlash, text: "Not comparable", cls: "text-slate-400" },
};
const CELL = { mismatch: "bg-rose-50 font-semibold text-rose-800", resolved: "bg-blue-50 font-semibold text-blue-800", match: "", na: "" };

export default function ComparisonTable({ detail }) {
  const rows = buildComparisonRows(detail);
  const present = new Set(detail.documents_present);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px]">
        <thead className="border-b border-slate-200 bg-slate-50/70">
          <tr>
            <th className="th">Check</th>
            {DOC_TYPES.map((dt) => (
              <th key={dt} className="th">{DOC_SHORT[dt]}{!present.has(dt) && <span className="ml-1 normal-case text-rose-500">(missing)</span>}</th>
            ))}
            <th className="th">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const state = rowState(r);
            const R = RESULT[state];
            return (
              <tr key={r.id}>
                <td className="td font-medium text-slate-900">{r.label}</td>
                {DOC_TYPES.map((dt) => {
                  const v = r.cells[dt];
                  const applicable = !(r.id === "total" && dt !== "invoice") && !(r.id.startsWith("qty-") && dt === "bill_of_lading");
                  return (
                    <td key={dt} className={`td tabular-nums ${v != null ? CELL[state] : "text-slate-300"}`}>
                      {!applicable ? <span className="text-slate-300">n/a</span> : v != null ? <>{fmt(num(v))} <span className="text-xs font-normal text-slate-500">{r.unit}</span></> : "-"}
                    </td>
                  );
                })}
                <td className="td">
                  <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${R.cls}`}><R.icon className="h-4 w-4" aria-hidden />{R.text}</span>
                  {r.note && <p className="mt-0.5 text-xs text-slate-500">{r.note}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
