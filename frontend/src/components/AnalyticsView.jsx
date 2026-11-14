import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Clock, Users, CheckCircle2, XCircle, Filter } from "lucide-react";
import { apiRequest } from "../utils/api";

export default function AnalyticsView({ queues, token, onUnauthorized, theme }) {
  const [scope, setScope] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const url = scope === "all" ? "/api/analytics" : `/api/analytics?queue_id=${encodeURIComponent(scope)}`;
    apiRequest(url, {}, token, onUnauthorized)
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [scope, queues, token, onUnauthorized]);

  const kpis = data?.kpis || {
    mean_wait_mins: 0,
    peak_wait_mins: 0,
    active_queue_depth: 0,
    est_clearance_mins: 0,
    served_count: 0,
    completion_rate_pct: 0,
    cancelled_count: 0,
    cancellation_rate_pct: 0,
  };

  const hourlyTrend = data?.hourly_trend || [];
  const slaComparison = data?.sla_comparison || [];
  const lifecycle = data?.lifecycle_breakdown || { waiting: 0, in_service: 0, served: 0, cancelled: 0 };
  const breakdown = data?.per_queue_breakdown || [];

  const pieData = [
    { name: "Waiting", value: lifecycle.waiting || 0, color: theme.amberHex },
    { name: "In Service", value: lifecycle.in_service || 0, color: theme.secondaryHex },
    { name: "Served", value: lifecycle.served || 0, color: theme.primaryHex },
    { name: "Cancelled", value: lifecycle.cancelled || 0, color: theme.roseHex },
  ];
  const totalLifecycle = pieData.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Scope Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 px-5 py-4 shadow-xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            Wait Times &amp; Queue Length Trends
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time Recharts telemetry across all active service queues
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className={`px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-white outline-none ${theme.ringFocus}`}
          >
            <option value="all">All Queues Combined</option>
            {queues.map((q) => (
              <option key={q.id} value={String(q.id)}>
                {q.name} ({q.prefix})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Mean Wait Time</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono-code text-slate-900 dark:text-white mt-2">
            {Number(kpis.mean_wait_mins || 0).toFixed(1)}m
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Peak wait: {Number(kpis.peak_wait_mins || 0).toFixed(1)} mins
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Active Queue Depth</span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono-code text-slate-900 dark:text-white mt-2">
            {kpis.active_queue_depth || 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Est. clearance: {kpis.est_clearance_mins || 0} mins</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Service Throughput</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono-code text-slate-900 dark:text-white mt-2">
            {kpis.served_count || 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Completion rate: {Number(kpis.completion_rate_pct || 0).toFixed(1)}%
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>Cancellation Rate</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono-code text-slate-900 dark:text-white mt-2">
            {Number(kpis.cancellation_rate_pct || 0).toFixed(1)}%
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {kpis.cancelled_count || 0} cancelled token{kpis.cancelled_count === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* 3 Recharts Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Hourly Queue Length & Throughput Trend (AreaChart) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Hourly Queue Length &amp; Throughput Trend
          </h3>
          <div className="h-72 w-full">
            {loading && hourlyTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyTrend}>
                  <defs>
                    <linearGradient id="gradWait" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.secondaryHex} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={theme.secondaryHex} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradServed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.primaryHex} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={theme.primaryHex} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="hour_label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#1e293b",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Area
                    type="monotone"
                    dataKey="waiting_length"
                    name="Waiting Queue Length"
                    stroke={theme.secondaryHex}
                    strokeWidth={2.5}
                    fill="url(#gradWait)"
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative_served"
                    name="Cumulative Served"
                    stroke={theme.primaryHex}
                    strokeWidth={2.5}
                    fill="url(#gradServed)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Token Lifecycle Doughnut (PieChart) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Token Lifecycle Breakdown</h3>
          <div className="h-72 w-full">
            {totalLifecycle === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Issue tokens in Workspace to see lifecycle distribution.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="46%"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#1e293b",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Average Wait Time vs Target SLA (BarChart) */}
        <div className="lg:col-span-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
            Average Wait Time vs. Target SLA by Queue
          </h3>
          <div className="h-72 w-full">
            {slaComparison.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Create queues to compare wait time against target SLA.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={slaComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="queue_name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      borderColor: "#1e293b",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar
                    dataKey="avg_wait_mins"
                    name="Observed Avg Wait (mins)"
                    fill={theme.primaryHex}
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="sla_minutes"
                    name="Target SLA (mins)"
                    fill="#94a3b8"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Per-Queue Comparison Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Per-Queue Performance Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Queue</th>
                <th className="py-3 px-4 font-semibold text-right">Waiting</th>
                <th className="py-3 px-4 font-semibold text-right">Served</th>
                <th className="py-3 px-4 font-semibold text-right">Cancelled</th>
                <th className="py-3 px-4 font-semibold text-right">Avg Wait</th>
                <th className="py-3 px-4 font-semibold text-right">SLA Target</th>
                <th className="py-3 px-4 font-semibold text-right">Completion %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {breakdown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No queue metrics available yet.
                  </td>
                </tr>
              ) : (
                breakdown.map((row) => (
                  <tr key={row.queue_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {row.queue_name}{" "}
                      <span className="font-mono-code text-[10px] text-slate-400 ml-1">({row.prefix})</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-code text-slate-700 dark:text-slate-300">
                      {row.waiting_count}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-code text-emerald-600 dark:text-emerald-400 font-semibold">
                      {row.served_count}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-code text-rose-600 dark:text-rose-400">
                      {row.cancelled_count}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-code text-slate-700 dark:text-slate-300">
                      {Number(row.avg_wait_mins || 0).toFixed(1)}m
                    </td>
                    <td className="py-3 px-4 text-right font-mono-code text-slate-500">{row.sla_minutes}m</td>
                    <td className="py-3 px-4 text-right font-mono-code font-bold text-slate-900 dark:text-white">
                      {Number(row.completion_rate_pct || 0).toFixed(1)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
