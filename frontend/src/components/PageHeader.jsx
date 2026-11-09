import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export function Breadcrumbs({ items }) {
  if (!items?.length) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300" aria-hidden />}
            {it.to && i < items.length - 1 ? (
              <Link to={it.to} className="rounded hover:text-brand-600 hover:underline">
                {it.label}
              </Link>
            ) : (
              <span className={i === items.length - 1 ? "font-medium text-slate-700" : ""} aria-current={i === items.length - 1 ? "page" : undefined}>
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function PageHeader({ title, subtitle, actions, breadcrumbs, badge }) {
  return (
    <div className="mb-6">
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
