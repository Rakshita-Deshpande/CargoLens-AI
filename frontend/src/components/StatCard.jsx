import { Skeleton } from "./Skeleton";

const ACCENTS = {
  blue: "bg-brand-50 text-brand-600",
  slate: "bg-slate-100 text-slate-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  rose: "bg-rose-50 text-rose-600",
};

export default function StatCard({ label, value, icon: Icon, accent = "blue", hint, loading, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`card card-pad text-left ${onClick ? "transition hover:border-brand-200 hover:shadow-pop" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">{label}</p>
          {loading ? <Skeleton className="mt-3 h-8 w-16" /> : <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value ?? "-"}</p>}
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${ACCENTS[accent]}`}>
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        )}
      </div>
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </Tag>
  );
}
