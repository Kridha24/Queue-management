import React, { useEffect, useState } from "react";
import { Search, LayoutGrid, BarChart3, Tv, Settings, Sun, Moon, PlayCircle, X } from "lucide-react";

export default function CommandPalette({
  isOpen,
  onClose,
  queues,
  onSelectQueue,
  onSelectTab,
  onToggleThemeMode,
  colorMode,
  onAssignTop,
  activeQueue,
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (isOpen) setQuery("");
  }, [isOpen]);

  if (!isOpen) return null;

  const actions = [
    {
      id: "tab-ops",
      label: "Go to Workspace",
      shortcut: "Tab",
      icon: LayoutGrid,
      run: () => onSelectTab("operations"),
    },
    {
      id: "tab-ana",
      label: "Go to Analytics Dashboard",
      shortcut: "Tab",
      icon: BarChart3,
      run: () => onSelectTab("analytics"),
    },
    {
      id: "tab-tv",
      label: "Open Public TV Waiting-Room Display",
      shortcut: "TV",
      icon: Tv,
      run: () => onSelectTab("tv"),
    },
    {
      id: "tab-set",
      label: "Go to Settings & Theme Switcher",
      shortcut: "Tab",
      icon: Settings,
      run: () => onSelectTab("settings"),
    },
    {
      id: "toggle-mode",
      label: colorMode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
      shortcut: "Theme",
      icon: colorMode === "dark" ? Sun : Moon,
      run: onToggleThemeMode,
    },
  ];

  if (activeQueue && (activeQueue.waiting_tokens || []).length > 0) {
    actions.unshift({
      id: "assign-top",
      label: `Assign Top Token (#1) in ${activeQueue.name}`,
      shortcut: "Space",
      icon: PlayCircle,
      run: () => onAssignTop(activeQueue.id),
    });
  }

  queues.forEach((q) => {
    actions.push({
      id: `q-${q.id}`,
      label: `Switch Queue: ${q.name} (${q.prefix})`,
      shortcut: `${(q.waiting_tokens || []).length} waiting`,
      icon: LayoutGrid,
      run: () => {
        onSelectQueue(q.id);
        onSelectTab("operations");
      },
    });
  });

  const qLower = query.trim().toLowerCase();
  const filtered = qLower
    ? actions.filter((a) => a.label.toLowerCase().includes(qLower))
    : actions;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or queue name..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No matching commands.</div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    item.run();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70 transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-teal-500" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {item.label}
                    </span>
                  </div>
                  <span className="font-mono-code text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {item.shortcut}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

