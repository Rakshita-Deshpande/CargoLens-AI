import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({ open, onClose, title, description, children, footer, size = "md" }) {
  const panel = useRef(null);
  const lastFocus = useRef(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => panel.current?.querySelector("input,textarea,select")?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
      lastFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-navy-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className={`relative w-full ${width} animate-fade-in rounded-2xl bg-white shadow-pop`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close dialog">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/60 px-6 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
