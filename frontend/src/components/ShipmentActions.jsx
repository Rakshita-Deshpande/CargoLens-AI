import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, FileSpreadsheet, Play, Send } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import Spinner from "./Spinner";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api, parseBlobError, parseError } from "../services/api";
import { downloadBlob, EXTRACT_STATUSES } from "../utils/format";

/** Contextual workflow buttons for a shipment (extract / submit / export). Backend rules are re-checked server-side. */
export default function ShipmentActions({ detail, onUpdate, onReload, size = "md" }) {
  const { isExecutive, isManager } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const btn = size === "sm" ? "btn-sm" : "";

  const hasReviewWork = detail.fields.some((f) => f.verified || f.corrected);
  const canExtract = isExecutive && EXTRACT_STATUSES.includes(detail.status) && detail.status !== "ai_processing" && detail.document_count > 0;
  const canSubmit = isExecutive && ["needs_review", "rejected"].includes(detail.status);
  const canExport = ["approved", "exported"].includes(detail.status);
  const blockers = detail.blockers || [];

  const runExtraction = async () => {
    setConfirm(null);
    setBusy("extract");
    try {
      const res = await api.extract(detail.ref, hasReviewWork);
      onUpdate(res.shipment);
      if (res.extraction.is_demo) toast.info("Demo extraction complete", "Values are synthetic sample data, not AI output.");
      else toast.success("Extraction complete", "Review the extracted values before submitting.");
    } catch (err) {
      toast.error("Extraction failed", parseError(err).message);
      onReload?.();
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    setConfirm(null);
    setBusy("submit");
    try {
      onUpdate(await api.submitShipment(detail.ref));
      toast.success("Submitted for approval", `${detail.ref} is now waiting for a manager.`);
    } catch (err) {
      const p = parseError(err);
      toast.error("Cannot submit yet", p.blockers.length ? `${p.message} (${p.blockers.length} unresolved)` : p.message);
      onReload?.();
    } finally {
      setBusy(null);
    }
  };

  const doExport = async (format) => {
    setBusy(format);
    try {
      const { blob, filename } = await api.exportShipment(detail.ref, format);
      downloadBlob(blob, filename);
      toast.success("Export downloaded", filename);
      onReload?.();
    } catch (err) {
      toast.error("Export blocked", (await parseBlobError(err)).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {canExtract && (
        <button className={`btn-secondary ${btn}`} disabled={busy !== null} onClick={() => (hasReviewWork ? setConfirm("extract") : runExtraction())}>
          {busy === "extract" ? <Spinner /> : <Play className="h-4 w-4" />} {detail.fields.length ? "Re-run extraction" : "Run extraction"}
        </button>
      )}
      {canSubmit && (
        <button className={`btn-primary ${btn}`} disabled={busy !== null || blockers.length > 0} onClick={() => setConfirm("submit")}
          title={blockers.length ? `${blockers.length} unresolved issue(s) must be cleared first` : "Send to a manager for approval"}>
          {busy === "submit" ? <Spinner /> : <Send className="h-4 w-4" />} Submit for approval
        </button>
      )}
      {isManager && detail.status === "ready_for_approval" && (
        <Link to="/approvals" className={`btn-primary ${btn}`}>Review in approvals</Link>
      )}
      {(canExport || isExecutive || isManager) && (
        <>
          <button className={`btn-secondary ${btn}`} disabled={!canExport || busy !== null} onClick={() => doExport("csv")}
            title={canExport ? "Download CSV (provisional layout)" : "Export is available only after manager approval"}>
            {busy === "csv" ? <Spinner /> : <Download className="h-4 w-4" />} CSV
          </button>
          <button className={`btn-secondary ${btn}`} disabled={!canExport || busy !== null} onClick={() => doExport("xlsx")}
            title={canExport ? "Download Excel (provisional layout)" : "Export is available only after manager approval"}>
            {busy === "xlsx" ? <Spinner /> : <FileSpreadsheet className="h-4 w-4" />} Excel
          </button>
        </>
      )}

      <ConfirmDialog open={confirm === "extract"} title="Re-run extraction?" confirmLabel="Overwrite and re-run" tone="danger" onConfirm={runExtraction} onCancel={() => setConfirm(null)}
        message="Re-running extraction replaces every extracted value, including your corrections and verifications, with fresh results. Correction history stays in the audit log." />
      <ConfirmDialog open={confirm === "submit"} title="Submit for manager approval?" confirmLabel="Submit" onConfirm={submit} onCancel={() => setConfirm(null)}
        message="The shipment will be locked for a manager to approve or reject. Editing any field afterwards returns it to review." />
    </>
  );
}
