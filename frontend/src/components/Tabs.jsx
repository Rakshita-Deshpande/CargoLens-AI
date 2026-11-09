export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="border-b border-slate-200" role="tablist">
      <div className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active === t.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            {t.label}
            {t.badge != null && t.badge !== 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${t.badgeTone === "rose" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
