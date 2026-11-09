import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const STYLES = {
  success: { icon: CheckCircle2, bar: "bg-emerald-500", text: "text-emerald-600" },
  error: { icon: XCircle, bar: "bg-rose-500", text: "text-rose-600" },
  warning: { icon: AlertTriangle, bar: "bg-amber-500", text: "text-amber-600" },
  info: { icon: Info, bar: "bg-brand-500", text: "text-brand-600" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (type, title, message) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, type, title, message }]);
      setTimeout(() => dismiss(id), type === "error" ? 8000 : 4500);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (title, message) => push("success", title, message),
      error: (title, message) => push("error", title, message),
      warning: (title, message) => push("warning", title, message),
      info: (title, message) => push("info", title, message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => {
          const s = STYLES[t.type];
          const Icon = s.icon;
          return (
            <div key={t.id} className="pointer-events-auto flex animate-toast-in overflow-hidden rounded-lg border border-slate-200 bg-white shadow-pop">
              <div className={`w-1 ${s.bar}`} />
              <div className="flex flex-1 gap-3 p-3.5">
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.text}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                  {t.message && <p className="mt-0.5 break-words text-sm text-slate-600">{t.message}</p>}
                </div>
                <button onClick={() => dismiss(t.id)} className="h-6 w-6 shrink-0 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Dismiss notification">
                  <X className="mx-auto h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
