export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} aria-hidden />;
}

export function TableSkeleton({ rows = 6, cols = 6 }) {
  return (
    <div className="divide-y divide-slate-100" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-4 ${c === 0 ? "w-24" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="card card-pad space-y-3" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}
