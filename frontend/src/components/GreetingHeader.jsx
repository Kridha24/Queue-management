import React from "react";
import { Clock, Users, CheckCircle2, Command } from "lucide-react";
import { getTimeOfDayGreeting } from "../utils/api";

function MiniSparkline({ color = "#10B981", points = "0,14 8,10 16,12 24,6 32,9 40,3" }) {
  return (
    <svg className="w-9 h-4 shrink-0" viewBox="0 0 42 18" fill="none">
      <polyline
        points={points}
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function GreetingHeader({ session, settings, queues, theme, onOpenCommandPalette }) {
  const managerName = (settings.greetingName || "").trim() || session?.manager?.name || "Manager";
  const greeting = getTimeOfDayGreeting();

  let totalWaiting = 0;
  let totalServed = 0;
  const waits = [];
  const nowMs = Date.now();

  for (const q of queues) {
    const waiting = q.waiting_tokens || [];
    totalWaiting += waiting.length;
    if (q.in_service_token?.wait_duration_mins != null) {
      waits.push(Number(q.in_service_token.wait_duration_mins));
    }
    for (const t of waiting) {
      if (t.created_at) {
        waits.push(Math.max(0, (nowMs - new Date(t.created_at).getTime()) / 60000));
      }
    }
    for (const t of q.history_tokens || []) {
      if (t.status === "SERVED") totalServed += 1;
      if (t.wait_duration_mins != null) waits.push(Number(t.wait_duration_mins));
    }
  }

  const avgWait = waits.length ? (waits.reduce((a, b) => a + b, 0) / waits.length).toFixed(1) : "0.0";

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-4 transition-colors duration-200">
      <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {greeting}, {managerName}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${theme.primarySoftBg} ${theme.primaryText} ${theme.primaryBorder}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {settings.shiftBadge || "Live Shift"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {settings.greetingSubtitle || "Desk is live & ready for service"} &bull; {queues.length} active queue
            {queues.length === 1 ? "" : "s"}
          </p>
        </div>

        {/* 3 Compact KPI Pills with Mini Sparklines + Cmd+K Trigger */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Users className="w-4 h-4 text-amber-500" />
            <div className="text-xs">
              <span className="text-slate-500 dark:text-slate-400 mr-1">Waiting</span>
              <span className="font-mono-code tabular-nums font-bold text-slate-900 dark:text-white">
                {totalWaiting}
              </span>
            </div>
            <MiniSparkline color="#F59E0B" points="0,12 8,14 16,8 24,10 32,5 40,7" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <div className="text-xs">
              <span className="text-slate-500 dark:text-slate-400 mr-1">Served</span>
              <span className="font-mono-code tabular-nums font-bold text-slate-900 dark:text-white">
                {totalServed}
              </span>
            </div>
            <MiniSparkline color="#10B981" points="0,15 8,12 16,10 24,7 32,5 40,2" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Clock className="w-4 h-4 text-indigo-500" />
            <div className="text-xs">
              <span className="text-slate-500 dark:text-slate-400 mr-1">Avg Wait</span>
              <span className="font-mono-code tabular-nums font-bold text-slate-900 dark:text-white">
                {avgWait}m
              </span>
            </div>
            <MiniSparkline color="#6366F1" points="0,10 8,7 16,11 24,6 32,8 40,5" />
          </div>

          <button
            type="button"
            onClick={onOpenCommandPalette}
            title="Open Command Palette (Cmd+K / Ctrl+K)"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition cursor-pointer"
          >
            <Command className="w-3.5 h-3.5" />
            <span className="font-mono-code">Cmd+K</span>
          </button>
        </div>
      </div>
    </header>
  );
}

