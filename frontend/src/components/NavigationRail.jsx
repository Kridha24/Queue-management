import React from "react";
import { LayoutGrid, BarChart3, Tv, Settings, RotateCcw, LogOut, Layers } from "lucide-react";

export default function NavigationRail({
  activeTab,
  onSelectTab,
  onOpenReset,
  onLogout,
  theme,
}) {
  const navItems = [
    { id: "operations", label: "Workspace", icon: LayoutGrid },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "tv", label: "TV Display", icon: Tv },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-full md:w-22 lg:w-24 bg-[#0F172A] text-slate-300 flex md:flex-col items-center justify-between px-3 py-2.5 md:py-5 shrink-0 z-30 border-b md:border-b-0 md:border-r border-slate-800/80">
      {/* Brand Mark */}
      <div className="flex items-center gap-2.5 md:flex-col md:gap-1.5">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md"
          style={{ backgroundColor: theme.primaryHex }}
          title="QueueFlow Pro — Command Center"
        >
          <Layers className="w-5 h-5" />
        </div>
        <div className="md:text-center">
          <span className="text-[11px] font-extrabold tracking-tight text-white block leading-tight">
            QueueFlow
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 hidden lg:block">
            Cmd Center
          </span>
        </div>
      </div>

      {/* 3 Primary Navigation Sections */}
      <nav className="flex md:flex-col items-center gap-1.5 md:gap-2.5 md:w-full md:px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex md:flex-col items-center justify-center gap-1.5 md:gap-1 px-3 py-2 md:py-2.5 md:w-full rounded-xl border text-[11px] font-semibold transition-all duration-200 ease-out transform-gpu active:scale-[0.97] cursor-pointer ${
                isActive
                  ? theme.railActive
                  : "text-slate-400 border-transparent hover:text-white hover:bg-slate-800/80"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Rail Actions: Reset Demo Data & Logout */}
      <div className="flex md:flex-col items-center gap-1.5 md:gap-2 md:w-full md:px-2">
        <button
          type="button"
          onClick={onOpenReset}
          title="Reset Demo Data / Clear Workspace"
          className="flex md:flex-col items-center justify-center gap-1 px-2.5 py-2 md:w-full rounded-xl text-[10px] font-semibold text-amber-300/90 hover:text-amber-200 hover:bg-amber-500/10 transition-all duration-200 active:scale-[0.97] cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          title="Logout"
          className="flex md:flex-col items-center justify-center gap-1 px-2.5 py-2 md:w-full rounded-xl text-[10px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all duration-200 active:scale-[0.97] cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </aside>
  );
}

