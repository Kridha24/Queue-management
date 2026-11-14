import React, { useEffect, useState } from "react";
import { X, AlertTriangle, CheckCircle2, Info } from "lucide-react";

export function QueueModal({ isOpen, queueToEdit, defaultPrefix, defaultSla, onClose, onSave, theme }) {
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("OPD");
  const [counterLabel, setCounterLabel] = useState("Counter 1");
  const [slaMinutes, setSlaMinutes] = useState(10);

  useEffect(() => {
    if (isOpen) {
      setName(queueToEdit ? queueToEdit.name : "");
      setPrefix(queueToEdit ? queueToEdit.prefix : defaultPrefix || "OPD");
      setCounterLabel(queueToEdit ? queueToEdit.counter_label : "Counter 1");
      setSlaMinutes(queueToEdit ? queueToEdit.sla_minutes : defaultSla || 10);
    }
  }, [isOpen, queueToEdit, defaultPrefix, defaultSla]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(
      {
        name: name.trim(),
        prefix: prefix.trim().toUpperCase(),
        counter_label: counterLabel.trim(),
        sla_minutes: Number(slaMinutes) || 10,
      },
      queueToEdit ? queueToEdit.id : null
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-fade-in">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {queueToEdit ? "Edit Queue Settings" : "Create New Service Queue"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Queue Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., OPD Consultation"
              className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none ${theme.ringFocus}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Token Prefix
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                placeholder="OPD"
                className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono-code uppercase text-slate-900 dark:text-white outline-none ${theme.ringFocus}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target SLA (mins)
              </label>
              <input
                type="number"
                required
                min={1}
                max={180}
                value={slaMinutes}
                onChange={(e) => setSlaMinutes(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none ${theme.ringFocus}`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Service Counter / Desk
            </label>
            <input
              type="text"
              required
              value={counterLabel}
              onChange={(e) => setCounterLabel(e.target.value)}
              placeholder="e.g., Desk 1"
              className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none ${theme.ringFocus}`}
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 rounded-xl text-white text-xs font-semibold transition-all duration-200 active:scale-[0.98] cursor-pointer ${theme.primaryBg}`}
            >
              {queueToEdit ? "Save Changes" : "Create Queue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CancelTokenModal({ target, onClose, onConfirm }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (target) setReason("");
  }, [target]);

  if (!target) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(target.queueId, target.tokenId, reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-fade-in">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Cancel Waiting Token</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Remove <span className="font-mono-code font-bold text-slate-900 dark:text-white">{target.tokenCode}</span>{" "}
            ({target.personName}) from the active waiting queue?
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cancellation Reason (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., No show, left early, rescheduled"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Keep Token
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
              Confirm Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ResetDataModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-fade-in">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Reset Workspace Data</h3>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This will clear all queues, waiting tokens, and service history in the database so you can start fresh.
          </p>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
              Yes, Reset All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const icon =
          t.type === "error" ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : t.type === "info" ? (
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          );
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-800 animate-fade-in"
          >
            {icon}
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
