import React, { useEffect, useState } from "react";
import { Tv, ArrowLeft, Clock, Users, Sparkles } from "lucide-react";

export default function TvDisplayView({ queues, activeQueue, onSelectQueue, onExit, theme }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentQueue = activeQueue || queues[0] || null;
  const activeToken = currentQueue?.in_service_token || null;
  const nextThree = (currentQueue?.waiting_tokens || []).slice(0, 3);

  return (
    <div className="min-h-screen bg-[#0B1120] text-white flex flex-col justify-between p-6 sm:p-10 relative overflow-hidden">
      {/* Subtle Radial Teal Glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[780px] h-[480px] rounded-full opacity-20 blur-3xl"
        style={{ background: `radial-gradient(circle, ${theme.primaryHex} 0%, transparent 70%)` }}
      />

      {/* Top Bar */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: theme.primaryHex }}
          >
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight">QueueFlow Pro</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Waiting Room Display
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentQueue ? `${currentQueue.name} • ${currentQueue.counter_label}` : "No active queue selected"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Live Digital Clock */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/90 border border-slate-800">
            <Clock className="w-4 h-4 text-teal-400" />
            <span className="font-mono-code tabular-nums text-lg font-bold tracking-wider text-white">
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>

          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit TV Mode
          </button>
        </div>
      </header>

      {/* Main Split Board */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 items-center max-w-6xl w-full mx-auto">
        {/* Now Serving Hero Card */}
        <div className="lg:col-span-7 rounded-3xl bg-slate-900/80 border border-slate-800 p-8 sm:p-10 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-teal-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Now Serving
            </span>
            {currentQueue && (
              <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700">
                {currentQueue.counter_label}
              </span>
            )}
          </div>

          {activeToken ? (
            <div className="space-y-4">
              <div
                className="inline-block font-mono-code text-5xl sm:text-7xl font-extrabold tracking-tight px-6 py-4 rounded-2xl text-white shadow-xl"
                style={{ backgroundColor: theme.primaryHex }}
              >
                {activeToken.token_code}
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-white pt-2">{activeToken.person_name}</p>
              <p className="text-sm text-slate-400">
                Please proceed to <strong className="text-white">{currentQueue.counter_label}</strong>
              </p>
            </div>
          ) : (
            <div className="py-10">
              <p className="text-3xl font-bold text-slate-300">Counter Ready</p>
              <p className="text-sm text-slate-500 mt-2">
                Next token will appear here as soon as it is called for service.
              </p>
            </div>
          )}
        </div>

        {/* Next 3 Upcoming Tokens */}
        <div className="lg:col-span-5 rounded-3xl bg-slate-900/60 border border-slate-800/90 p-7 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Up Next
            </h2>
            <span className="font-mono-code text-xs text-slate-400">
              {currentQueue ? `${(currentQueue.waiting_tokens || []).length} waiting` : "0 waiting"}
            </span>
          </div>

          {nextThree.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No upcoming tokens in queue.</div>
          ) : (
            <div className="space-y-3">
              {nextThree.map((t, idx) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between p-4 rounded-2xl border ${
                    idx === 0
                      ? "bg-slate-800/90 border-teal-500/40"
                      : "bg-slate-900/80 border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="font-mono-code text-xs font-bold px-2 py-1 rounded-lg bg-slate-800 text-slate-300">
                      #{t.position}
                    </span>
                    <div>
                      <p className="font-mono-code text-lg font-extrabold text-white">{t.token_code}</p>
                      <p className="text-xs text-slate-400">{t.person_name}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                    {t.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer Queue Switcher */}
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-4 text-xs text-slate-400">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-500 mr-1">Switch Display Queue:</span>
          {queues.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelectQueue(q.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                currentQueue && q.id === currentQueue.id
                  ? "bg-teal-600 text-white"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {q.name} ({q.prefix})
            </button>
          ))}
        </div>
        <span>Press Esc or click Exit TV Mode to return</span>
      </footer>
    </div>
  );
}

