export default function Logo({ size = 32, withText = true, dark = true }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#2458E6" />
        <circle cx="15" cy="15" r="6" fill="none" stroke="#fff" strokeWidth="2.4" />
        <path d="M19.5 19.5 25 25" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      {withText && (
        <span className={`text-lg font-semibold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>
          CargoLens <span className="font-medium text-brand-200">AI</span>
        </span>
      )}
    </div>
  );
}
