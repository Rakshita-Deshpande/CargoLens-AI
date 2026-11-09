import { Check, XCircle } from "lucide-react";
import { STATUS_META, WORKFLOW } from "../utils/format";

export default function WorkflowStepper({ status }) {
  const rejected = status === "rejected";
  // A rejected shipment sits at the "Ready for approval" step and goes back to review.
  const idx = rejected ? WORKFLOW.indexOf("ready_for_approval") : WORKFLOW.indexOf(status);
  return (
    <ol className="flex items-start overflow-x-auto pb-1" aria-label="Workflow progress">
      {WORKFLOW.map((s, i) => {
        const done = i < idx || (i === idx && ["approved", "exported"].includes(status));
        const current = i === idx;
        const bad = rejected && current;
        return (
          <li key={s} className="flex min-w-[96px] flex-1 flex-col items-center text-center" aria-current={current ? "step" : undefined}>
            <div className="flex w-full items-center">
              <div className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : i <= idx ? "bg-brand-500" : "bg-slate-200"}`} />
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  bad ? "bg-rose-500 text-white" : done ? "bg-brand-600 text-white" : current ? "bg-white text-brand-700 ring-2 ring-brand-600" : "bg-slate-100 text-slate-400"
                }`}
              >
                {bad ? <XCircle className="h-4 w-4" /> : done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <div className={`h-0.5 flex-1 ${i === WORKFLOW.length - 1 ? "bg-transparent" : i < idx ? "bg-brand-500" : "bg-slate-200"}`} />
            </div>
            <p className={`mt-2 px-1 text-[11px] font-medium leading-tight ${bad ? "text-rose-600" : current ? "text-slate-900" : "text-slate-500"}`}>{bad ? "Rejected" : STATUS_META[s].label}</p>
          </li>
        );
      })}
    </ol>
  );
}
