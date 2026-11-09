import { useState } from "react";
import Modal from "./Modal";
import Spinner from "./Spinner";
import { api, parseError } from "../services/api";

export default function CreateShipmentModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ importer_name: "", origin_country: "", destination: "", shipment_ref: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.importer_name.trim().length < 2 || form.origin_country.trim().length < 2) {
      setError("Importer and origin country are required.");
      return;
    }
    setLoading(true);
    try {
      const body = { importer_name: form.importer_name.trim(), origin_country: form.origin_country.trim() };
      if (form.destination.trim()) body.destination = form.destination.trim();
      if (form.shipment_ref.trim()) body.shipment_ref = form.shipment_ref.trim();
      const created = await api.createShipment(body);
      setForm({ importer_name: "", origin_country: "", destination: "", shipment_ref: "" });
      onCreated(created);
    } catch (err) {
      setError(parseError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title="Create shipment"
      description="Upload the invoice, packing list and bill of lading on the next screen."
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn-primary" type="submit" form="create-shipment" disabled={loading}>{loading && <Spinner />} Create shipment</button>
        </>
      }
    >
      <form id="create-shipment" onSubmit={submit} className="space-y-4" noValidate>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        <div>
          <label className="label" htmlFor="cs-importer">Importer / company <span className="text-rose-500">*</span></label>
          <input id="cs-importer" className="input" value={form.importer_name} onChange={set("importer_name")} placeholder="e.g. Company B" />
        </div>
        <div>
          <label className="label" htmlFor="cs-origin">Origin country <span className="text-rose-500">*</span></label>
          <input id="cs-origin" className="input" value={form.origin_country} onChange={set("origin_country")} placeholder="e.g. China" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cs-dest">Destination</label>
            <input id="cs-dest" className="input" value={form.destination} onChange={set("destination")} placeholder="Nhava Sheva (JNPT), India" />
          </div>
          <div>
            <label className="label" htmlFor="cs-ref">Shipment ID</label>
            <input id="cs-ref" className="input" value={form.shipment_ref} onChange={set("shipment_ref")} placeholder="Auto-generated" />
          </div>
        </div>
      </form>
    </Modal>
  );
}
