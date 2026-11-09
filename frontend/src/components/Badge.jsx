import { FlaskConical, Sparkles } from "lucide-react";
import { STATUS_META, TONES } from "../utils/format";

export function Pill({ tone = "slate", children, className = "", title }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, tone: "slate" };
  return (
    <Pill tone={meta.tone}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${status === "ai_processing" ? "animate-pulse" : ""}`} aria-hidden />
      {meta.label}
    </Pill>
  );
}

export function ValidationBadge({ status, count }) {
  if (status === "not_run") return <Pill tone="slate">Not validated</Pill>;
  if (status === "passed") return <Pill tone="emerald">Passed</Pill>;
  return <Pill tone="rose">{count} open {count === 1 ? "issue" : "issues"}</Pill>;
}

export function ModeBadge({ mode }) {
  if (mode === "demo_fallback")
    return (
      <Pill tone="amber" title="Synthetic sample data - not produced by an AI model">
        <FlaskConical className="h-3 w-3" aria-hidden /> Demo data (not AI)
      </Pill>
    );
  if (mode === "gemini")
    return (
      <Pill tone="violet">
        <Sparkles className="h-3 w-3" aria-hidden /> AI extracted
      </Pill>
    );
  return <Pill tone="slate">Not extracted</Pill>;
}

export function SeverityBadge({ issue }) {
  if (issue.status === "resolved") return <Pill tone="blue">Resolved by reviewer</Pill>;
  if (!issue.blocking) return <Pill tone="amber">Warning</Pill>;
  return <Pill tone="rose">Blocking</Pill>;
}
