import React, { useEffect, useState } from "react";
import { X, AlertTriangle, CheckCircle2, Info, Printer, QrCode, RotateCcw, Ticket } from "lucide-react";

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
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Reset Demo Data</h3>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This will replace current queues and tokens with the fresh 4-queue demo dataset (OPD, Pharmacy, Lab, and
            Express Helpdesk).
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
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
              Reset Demo Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeterministicQrSvg({ value }) {
  const size = 21;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isFinder = (r, c) =>
    (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);

  const cells = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      let filled = false;
      if (isFinder(r, c)) {
        const lr = r >= size - 7 ? r - (size - 7) : r;
        const lc = c >= size - 7 ? c - (size - 7) : c;
        filled =
          lr === 0 ||
          lr === 6 ||
          lc === 0 ||
          lc === 6 ||
          (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
      } else {
        const seed = (hash ^ (r * 31 + c * 17) ^ ((r + 1) * (c + 3) * 13)) >>> 0;
        filled = seed % 2 === 0;
      }
      if (filled) {
        cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="currentColor" />);
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-28 h-28 text-slate-900 dark:text-white"
      shapeRendering="crispEdges"
      aria-label="Token QR Code"
    >
      {cells}
    </svg>
  );
}

export function TokenSlipModal({ slip, onClose }) {
  if (!slip) return null;
  const { token, queue } = slip;
  const estWait =
    token.position && queue
      ? (token.position - 1) * (queue.sla_minutes || 10)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#0F172A] px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Digital Token Slip</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 text-center space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {queue?.name || "Service Queue"}
            </p>
            <p className="font-mono-code text-4xl font-extrabold text-teal-600 dark:text-teal-400 mt-1">
              {token.token_code}
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">{token.person_name}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-left bg-slate-50 dark:bg-slate-800/70 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-400">Counter</p>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {queue?.counter_label || "Counter 1"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-400">Est. Wait</p>
              <p className="font-mono-code tabular-nums text-xs font-bold text-slate-800 dark:text-slate-100">
                ~{estWait} mins
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-400">Position</p>
              <p className="font-mono-code tabular-nums text-xs font-bold text-slate-800 dark:text-slate-100">
                #{token.position || 1}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-400">Priority</p>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{token.priority}</p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-2">
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xs">
              <DeterministicQrSvg value={`${token.token_code}|${token.person_name}|${queue?.name || ""}`} />
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 mt-2">
              <QrCode className="w-3 h-3" />
              Scan at counter check-in
            </span>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#0D9488] hover:bg-teal-700 text-white text-xs font-bold transition active:scale-[0.98] cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Slip
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
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
            className="pointer-events-auto rounded-xl bg-[#0F172A] text-white text-xs font-semibold shadow-xl border border-slate-700/80 overflow-hidden animate-fade-in"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2.5">
                {icon}
                <span>{t.message}</span>
              </div>
              {t.actionLabel && t.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    t.onAction();
                    if (onDismiss) onDismiss(t.id);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 text-[11px] font-bold transition cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3 h-3" />
                  {t.actionLabel}
                </button>
              )}
            </div>
            {t.durationMs && (
              <div className="h-0.5 w-full bg-slate-800">
                <div
                  className="h-full bg-teal-400 transition-all ease-linear"
                  style={{
                    width: "100%",
                    animation: `shrinkBar ${t.durationMs}ms linear forwards`,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
      <style>{`@keyframes shrinkBar { from { width: 100%; } to { width: 0%; } }`}</style>
    </div>
  );
}

