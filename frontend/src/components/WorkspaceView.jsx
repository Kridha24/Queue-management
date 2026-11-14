import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Search,
  X,
  ArrowUp,
  ArrowDown,
  PlayCircle,
  CheckCircle2,
  Trash2,
  UserPlus,
  Clock,
  Inbox,
  History,
  GripVertical,
  Ticket,
} from "lucide-react";
import { formatTime, formatMinsAgo } from "../utils/api";

function PriorityBadge({ priority }) {
  if (priority === "Priority") {
    return (
      <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold">
        Priority
      </span>
    );
  }
  if (priority === "Follow-up") {
    return (
      <span className="px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 text-[11px] font-semibold">
        Follow-up
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-medium">
      Standard
    </span>
  );
}

function ShimmerSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-72 rounded-xl bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 h-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="h-6 w-48 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-16 w-full rounded-xl bg-slate-100 dark:bg-slate-800/70" />
          <div className="h-16 w-full rounded-xl bg-slate-100 dark:bg-slate-800/70" />
          <div className="h-16 w-full rounded-xl bg-slate-100 dark:bg-slate-800/70" />
        </div>
        <div className="xl:col-span-4 space-y-6">
          <div className="h-48 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800" />
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceView({
  queues,
  activeQueue,
  isLoading,
  personNameInputRef,
  onSelectQueue,
  onOpenNewQueue,
  onOpenEditQueue,
  onIssueToken,
  onMoveToken,
  onReorderToken,
  onAssignTop,
  onCompleteService,
  onOpenCancelModal,
  onOpenTokenSlip,
  theme,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [density, setDensity] = useState("comfortable"); // 'comfortable' | 'compact'
  const [draggedTokenId, setDraggedTokenId] = useState(null);
  const [dragOverTokenId, setDragOverTokenId] = useState(null);
  const [personName, setPersonName] = useState("");
  const [phone, setPhone] = useState("");
  const [priority, setPriority] = useState("Standard");
  const [notes, setNotes] = useState("");

  if (isLoading) {
    return <ShimmerSkeleton />;
  }

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!activeQueue || !personName.trim()) return;
    await onIssueToken(activeQueue.id, {
      person_name: personName.trim(),
      phone: phone.trim(),
      priority,
      notes: notes.trim(),
    });
    setPersonName("");
    setPhone("");
    setPriority("Standard");
    setNotes("");
  };

  const focusNewTokenInput = () => {
    personNameInputRef?.current?.focus();
  };

  const waiting = activeQueue?.waiting_tokens || [];
  const activeToken = activeQueue?.in_service_token || null;
  const history = activeQueue?.history_tokens || [];
  const estClearance = activeQueue ? waiting.length * activeQueue.sla_minutes : 0;

  const term = searchQuery.trim().toLowerCase();
  const filteredWaiting = term
    ? waiting.filter(
        (t) =>
          t.token_code.toLowerCase().includes(term) ||
          t.person_name.toLowerCase().includes(term) ||
          (t.phone || "").toLowerCase().includes(term) ||
          t.priority.toLowerCase().includes(term)
      )
    : waiting;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Horizontal Queue Switcher Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {queues.length === 0 ? (
            <span className="text-xs font-medium text-slate-400 px-1">
              No queues created yet — click + New Queue to start
            </span>
          ) : (
            queues.map((q) => {
              const isActive = activeQueue && q.id === activeQueue.id;
              const waitingCount = (q.waiting_tokens || []).length;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onSelectQueue(q.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ease-out transform-gpu active:scale-[0.98] cursor-pointer shrink-0 ${
                    isActive
                      ? `${theme.primaryBg} text-white shadow-sm`
                      : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <span
                    className={`font-mono-code text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isActive
                        ? "bg-black/20 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {q.prefix}
                  </span>
                  <span className="truncate max-w-[150px]">{q.name}</span>
                  <span
                    className={`font-mono-code tabular-nums text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {waitingCount}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeQueue && (
            <button
              type="button"
              onClick={() => onOpenEditQueue(activeQueue)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Queue
            </button>
          )}
          <button
            type="button"
            onClick={onOpenNewQueue}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold shadow-sm transition-all duration-200 active:scale-[0.98] cursor-pointer ${theme.primaryBg}`}
          >
            <Plus className="w-4 h-4" />
            New Queue
          </button>
        </div>
      </div>

      {/* Empty State when no queues exist */}
      {!activeQueue ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center shadow-xs">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Service Queues Yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Create your first named queue (e.g., OPD Consultation, Pharmacy Desk, or Diagnostics Lab) to start issuing
            sequential tokens.
          </p>
          <button
            type="button"
            onClick={onOpenNewQueue}
            className={`mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-sm transition-all duration-200 active:scale-[0.98] cursor-pointer ${theme.primaryBg}`}
          >
            <Plus className="w-4 h-4" />
            Create First Queue
          </button>
        </div>
      ) : (
        /* 2-Column Bento Grid: Waiting Board (Left 8 cols) + Docked Action Column (Right 4 cols) */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Center-Left: Waiting Queue Board + History */}
          <div className="xl:col-span-8 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              {/* Queue Header Bar */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">{activeQueue.name}</h2>
                    <span className="font-mono-code text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {activeQueue.prefix}
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      &bull; {activeQueue.counter_label} &bull; SLA {activeQueue.sla_minutes}m
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Waiting: <strong className="tabular-nums text-slate-800 dark:text-slate-200">{waiting.length}</strong>{" "}
                    &bull; Est. clearance:{" "}
                    <strong className="font-mono-code tabular-nums text-slate-800 dark:text-slate-200">
                      {estClearance}m
                    </strong>
                  </p>
                </div>

                {/* Search Input + Density Toggle */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700/80 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setDensity("comfortable")}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        density === "comfortable"
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      Comfortable
                    </button>
                    <button
                      type="button"
                      onClick={() => setDensity("compact")}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        density === "compact"
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      Compact
                    </button>
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search token or name..."
                      className={`w-full pl-9 pr-8 py-2 rounded-xl border border-[#E2E8F0] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none transition ${theme.ringFocus}`}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Waiting List with Framer Motion Reorder + SLA Progress Bar */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {waiting.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <svg
                      className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-700"
                      viewBox="0 0 64 64"
                      fill="none"
                    >
                      <rect x="10" y="14" width="44" height="36" rx="8" stroke="currentColor" strokeWidth="2.5" />
                      <path d="M20 28h24M20 36h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      <circle cx="48" cy="18" r="7" fill={theme.primaryHex} />
                    </svg>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      No tokens waiting in {activeQueue.name}
                    </p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Click below to focus the token form (or press <kbd className="font-mono-code">N</kbd>) to issue the
                      first token.
                    </p>
                    <button
                      type="button"
                      onClick={focusNewTokenInput}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-xs transition active:scale-[0.98] cursor-pointer ${theme.primaryBg}`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Issue First Token
                    </button>
                  </div>
                ) : filteredWaiting.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No waiting tokens match &ldquo;<strong>{searchQuery}</strong>&rdquo;.
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {filteredWaiting.map((t) => {
                      const isFirst = t.position === 1;
                      const isLast = t.position === waiting.length;
                      const waitMins = formatMinsAgo(t.created_at);
                      const slaRatio = Math.min(100, Math.round((waitMins / Math.max(1, activeQueue.sla_minutes)) * 100));
                      const slaBarColor =
                        slaRatio >= 100
                          ? "bg-rose-500"
                          : slaRatio >= 60
                          ? "bg-amber-500"
                          : "bg-teal-500";
                      const estServiceMins =
                        (t.position - 1) * activeQueue.sla_minutes +
                        (activeToken ? Math.ceil(activeQueue.sla_minutes / 2) : 0);

                      const isCompact = density === "compact";
                      const isDragOver = dragOverTokenId === t.id && draggedTokenId !== t.id;

                      return (
                        <motion.div
                          key={t.id}
                          layout
                          draggable={!term}
                          onDragStart={() => setDraggedTokenId(t.id)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (draggedTokenId && draggedTokenId !== t.id) setDragOverTokenId(t.id);
                          }}
                          onDragLeave={() => {
                            if (dragOverTokenId === t.id) setDragOverTokenId(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedTokenId && draggedTokenId !== t.id && onReorderToken) {
                              onReorderToken(activeQueue.id, draggedTokenId, t.position);
                            }
                            setDraggedTokenId(null);
                            setDragOverTokenId(null);
                          }}
                          onDragEnd={() => {
                            setDraggedTokenId(null);
                            setDragOverTokenId(null);
                          }}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ type: "spring", stiffness: 500, damping: 38 }}
                          className={`${isCompact ? "px-4 py-2.5 gap-1.5" : "p-4 gap-2.5"} flex flex-col transition-colors duration-150 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                            isFirst ? "bg-teal-50/60 dark:bg-teal-950/30" : ""
                          } ${isDragOver ? "ring-2 ring-inset ring-teal-500/60 bg-teal-50/40 dark:bg-teal-950/40" : ""}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 sm:gap-3">
                              <span
                                title={term ? "Clear search to drag-reorder" : "Drag to reorder"}
                                className={`text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 shrink-0 ${
                                  term ? "opacity-30 cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
                                }`}
                              >
                                <GripVertical className="w-4 h-4" />
                              </span>

                              <div
                                className={`font-mono-code tabular-nums ${
                                  isCompact ? "w-7 h-7 text-[11px]" : "w-9 h-9 text-xs"
                                } rounded-xl flex items-center justify-center font-bold shrink-0 ${
                                  isFirst
                                    ? "bg-[#0D9488] text-white shadow-xs"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-[#E2E8F0] dark:border-slate-700"
                                }`}
                              >
                                #{t.position}
                              </div>

                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono-code text-xs font-bold px-2 py-0.5 rounded-md bg-slate-900 dark:bg-slate-950 text-white">
                                    {t.token_code}
                                  </span>
                                  <span className={`${isCompact ? "text-xs" : "text-sm"} font-bold text-slate-900 dark:text-white`}>
                                    {t.person_name}
                                  </span>
                                  <PriorityBadge priority={t.priority} />
                                </div>
                                {!isCompact && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      Wait:{" "}
                                      <strong className="font-mono-code tabular-nums text-slate-700 dark:text-slate-200">
                                        {waitMins.toFixed(1)}m
                                      </strong>
                                    </span>
                                    <span>&bull;</span>
                                    <span>
                                      Est. call:{" "}
                                      <strong className="font-mono-code tabular-nums text-slate-700 dark:text-slate-200">
                                        ~{estServiceMins}m
                                      </strong>
                                    </span>
                                    {t.phone && <span>&bull; {t.phone}</span>}
                                    {t.notes && (
                                      <span>
                                        &bull; <em>&ldquo;{t.notes}&rdquo;</em>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isFirst && (
                                <button
                                  type="button"
                                  onClick={() => onAssignTop(activeQueue.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0D9488] hover:bg-teal-700 text-white text-xs font-semibold transition-all duration-200 active:scale-[0.97] cursor-pointer mr-0.5"
                                >
                                  <PlayCircle className="w-3.5 h-3.5" />
                                  Assign
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onOpenTokenSlip && onOpenTokenSlip(t, activeQueue)}
                                title="View / Print Token Slip"
                                className="p-2 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all duration-150 active:scale-[0.95] cursor-pointer"
                              >
                                <Ticket className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                disabled={isFirst}
                                onClick={() => onMoveToken(activeQueue.id, t.id, "up")}
                                title="Move Up"
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 transition-all duration-150 active:scale-[0.95] cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                disabled={isLast}
                                onClick={() => onMoveToken(activeQueue.id, t.id, "down")}
                                title="Move Down"
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-35 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 transition-all duration-150 active:scale-[0.95] cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onOpenCancelModal(activeQueue.id, t.id, t.token_code, t.person_name)}
                                title="Cancel Token"
                                className="p-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-all duration-150 active:scale-[0.95] cursor-pointer ml-0.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Subtle Live SLA Progress Bar */}
                          <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${slaBarColor}`}
                              style={{ width: `${Math.max(6, slaRatio)}%` }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* Recent Service & Cancellation History */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Service &amp; Audit Feed</h3>
                </div>
                <span className="text-xs font-medium text-slate-400">
                  {history.length} record{history.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                {history.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No completed or cancelled tokens yet.
                  </div>
                ) : (
                  history.map((t) => {
                    const isServed = t.status === "SERVED";
                    const eventTime = isServed ? formatTime(t.completed_at) : formatTime(t.cancelled_at);
                    return (
                      <div
                        key={t.id}
                        className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isServed
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                            }`}
                          >
                            {t.status}
                          </span>
                          <span className="font-mono-code font-bold text-slate-800 dark:text-slate-200">
                            {t.token_code}
                          </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{t.person_name}</span>
                          {t.cancel_reason && (
                            <span className="text-slate-400 italic">({t.cancel_reason})</span>
                          )}
                        </div>
                        <span className="text-slate-400 font-mono-code tabular-nums">{eventTime}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Docked Action Column (4 cols) */}
          <div className="xl:col-span-4 space-y-6">
            {/* 1. Glassmorphic Now Serving Spotlight Card */}
            <div
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${theme.spotlightGradient} text-white p-5 shadow-lg transition-all duration-200`}
            >
              <div className="pointer-events-none -top-16 -right-16 absolute w-44 h-44 rounded-full bg-white/15 blur-2xl" />
              <div className="relative z-10 flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/85 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  Now Serving &bull; {activeQueue.counter_label}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/15 text-[11px] font-semibold">
                  {activeToken ? "Active" : "Idle"}
                </span>
              </div>

              {activeToken ? (
                <div className="relative z-10 rounded-xl bg-white/15 border border-white/25 p-4 backdrop-blur-md space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-code text-sm font-bold px-2.5 py-1 rounded-lg bg-white text-slate-900 shadow-xs">
                      {activeToken.token_code}
                    </span>
                    <span className="text-xs font-semibold text-white/90">{activeToken.priority}</span>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-white">{activeToken.person_name}</p>
                    <p className="text-[11px] text-white/85 mt-0.5 tabular-nums">
                      Called at {formatTime(activeToken.assigned_at)} &bull; Waited{" "}
                      {activeToken.wait_duration_mins != null
                        ? Number(activeToken.wait_duration_mins).toFixed(1)
                        : "0.0"}
                      m
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCompleteService(activeQueue.id)}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-black/25 hover:bg-black/35 border border-white/20 text-white text-xs font-semibold transition-all duration-200 active:scale-[0.98] cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Service Complete
                  </button>
                </div>
              ) : (
                <div className="relative z-10 rounded-xl bg-white/10 border border-white/20 p-4 backdrop-blur-xs">
                  <p className="text-sm font-bold text-white">Counter is currently idle</p>
                  <p className="text-xs text-white/80 mt-1">
                    Click <strong>Assign Top Token (#1)</strong> or press <kbd className="font-mono-code">Space</kbd>.
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={waiting.length === 0}
                onClick={() => onAssignTop(activeQueue.id)}
                className="relative z-10 mt-4 w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold shadow-md transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" />
                Assign Top Token (#1)
              </button>
            </div>

            {/* 2. Quick Add Person & Issue Token Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${theme.primarySoftBg} ${theme.primaryText}`}
                  >
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Person &amp; Issue Token</h3>
                    <p className="text-[11px] text-slate-400">{activeQueue.name}</p>
                  </div>
                </div>
                <span className="font-mono-code tabular-nums text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  Next: {activeQueue.prefix}-{activeQueue.next_sequence || 101}
                </span>
              </div>

              <form onSubmit={handleIssueSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Person Name
                  </label>
                  <input
                    ref={personNameInputRef}
                    type="text"
                    required
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    placeholder="e.g., Aarav Sharma"
                    className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none transition ${theme.ringFocus}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phone / ID
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98..."
                      className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none transition ${theme.ringFocus}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white outline-none transition ${theme.ringFocus}`}
                    >
                      <option value="Standard">Standard</option>
                      <option value="Priority">Priority</option>
                      <option value="Follow-up">Follow-up</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Service Note (optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Lab report review"
                    className={`w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none transition ${theme.ringFocus}`}
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white text-xs font-bold shadow-sm transition-all duration-200 active:scale-[0.98] cursor-pointer ${theme.primaryBg}`}
                >
                  <UserPlus className="w-4 h-4" />
                  Issue Next Token
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
