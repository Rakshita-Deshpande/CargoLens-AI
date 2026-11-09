import Modal from "./Modal";
import Spinner from "./Spinner";

/** Confirmation for important actions. Children can hold extra inputs (e.g. a comment box). */
export default function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", tone = "primary", loading = false, confirmDisabled = false, onConfirm, onCancel, children }) {
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className={tone === "danger" ? "btn-danger" : "btn-primary"} onClick={onConfirm} disabled={loading || confirmDisabled}>
            {loading && <Spinner />} {confirmLabel}
          </button>
        </>
      }
    >
      {message && <p className="text-sm text-slate-600">{message}</p>}
      {children && <div className={message ? "mt-4" : ""}>{children}</div>}
    </Modal>
  );
}
