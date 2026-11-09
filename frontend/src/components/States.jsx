import { AlertCircle, Inbox, RefreshCw } from "lucide-react";

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center" role="alert">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
        <AlertCircle className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">Something went wrong</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      {onRetry && (
        <button onClick={() => onRetry()} className="btn-secondary mt-4">
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}
