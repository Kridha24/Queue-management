import React from "react";
import {
  Sun,
  Moon,
  Palette,
  Sliders,
  User,
  Info,
  Volume2,
  VolumeX,
  LogOut,
  Check,
  ShieldCheck,
} from "lucide-react";
import { THEME_PRESETS } from "../utils/theme";

export default function SettingsView({
  settings,
  onUpdateSettings,
  session,
  onLogout,
  theme,
  onShowToast,
}) {
  const manager = session?.manager || {
    name: "Queue Manager",
    email: "manager@queueflow.io",
    role: "Senior Queue Manager",
  };

  const initials = (manager.name || "QM")
    .replace(/^Dr\.\s*/i, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "QM";

  const handleFieldChange = (key, value) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Command Center Settings</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Customize appearance, greeting preferences, counter defaults, and review your active session.
        </p>
      </div>

      {/* 4 Clean Bento Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Appearance & Theme Switcher */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${theme.primarySoftBg} ${theme.primaryText}`}>
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Appearance &amp; Theme Switcher</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Saved automatically to localStorage</p>
            </div>
          </div>

          {/* Light / Dark Mode Switch */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Interface Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  handleFieldChange("colorMode", "light");
                  onShowToast("Switched to Light Mode", "info");
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-semibold transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                  settings.colorMode === "light"
                    ? `${theme.primarySoftBg} ${theme.primaryText} ${theme.primaryBorder} ring-1 ring-current`
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <Sun className="w-4 h-4" />
                Light Mode
              </button>

              <button
                type="button"
                onClick={() => {
                  handleFieldChange("colorMode", "dark");
                  onShowToast("Switched to Dark Mode", "info");
                }}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-semibold transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                  settings.colorMode === "dark"
                    ? `${theme.primarySoftBg} ${theme.primaryText} ${theme.primaryBorder} ring-1 ring-current`
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <Moon className="w-4 h-4" />
                Dark Mode
              </button>
            </div>
          </div>

          {/* Accent Theme Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Accent Theme Preset
            </label>
            <div className="space-y-2.5">
              {Object.values(THEME_PRESETS).map((preset) => {
                const selected = settings.accentTheme === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      handleFieldChange("accentTheme", preset.id);
                      onShowToast(`Theme preset set to ${preset.name}`, "info");
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200 active:scale-[0.99] cursor-pointer ${
                      selected
                        ? `${preset.primarySoftBg} ${preset.primaryBorder} ring-1 ring-current`
                        : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center -space-x-1.5">
                        <span className={`w-4 h-4 rounded-full ${preset.swatchA} ring-2 ring-white dark:ring-slate-900`} />
                        <span className={`w-4 h-4 rounded-full ${preset.swatchB} ring-2 ring-white dark:ring-slate-900`} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{preset.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{preset.description}</p>
                      </div>
                    </div>
                    {selected && <Check className={`w-4 h-4 ${preset.primaryText}`} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 2: Greeting & Counter Preferences */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${theme.primarySoftBg} ${theme.primaryText}`}>
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Greeting &amp; Counter Preferences</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Updates top greeting header live</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Greeting Name
            </label>
            <input
              type="text"
              value={settings.greetingName}
              onChange={(e) => handleFieldChange("greetingName", e.target.value)}
              placeholder={manager.name || "e.g., Mayur"}
              className={`w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none ${theme.ringFocus}`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Custom Greeting Subtitle
            </label>
            <input
              type="text"
              value={settings.greetingSubtitle}
              onChange={(e) => handleFieldChange("greetingSubtitle", e.target.value)}
              placeholder="Desk is live & ready for service"
              className={`w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none ${theme.ringFocus}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Shift Status Badge
              </label>
              <input
                type="text"
                value={settings.shiftBadge}
                onChange={(e) => handleFieldChange("shiftBadge", e.target.value)}
                placeholder="Morning Shift • Counter 1"
                className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none ${theme.ringFocus}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Queue SLA (mins)
              </label>
              <input
                type="number"
                min={1}
                max={180}
                value={settings.defaultSla}
                onChange={(e) => handleFieldChange("defaultSla", Math.max(1, Number(e.target.value) || 10))}
                className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none ${theme.ringFocus}`}
              />
            </div>
          </div>

          {/* Sound Chime Toggle */}
          <div className="pt-2 flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              {settings.soundEnabled ? (
                <Volume2 className={`w-4 h-4 ${theme.primaryText}`} />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Service Call Sound Chime</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Play subtle Web Audio chime on Assign Top Token
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleFieldChange("soundEnabled", !settings.soundEnabled)}
              className={`w-11 h-6 rounded-full transition-colors duration-200 p-0.5 cursor-pointer ${
                settings.soundEnabled ? theme.primaryBg.split(" ")[0] : "bg-slate-300 dark:bg-slate-600"
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                  settings.soundEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Card 3: User / Manager Profile Info Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${theme.primarySoftBg} ${theme.primaryText}`}>
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">User / Manager Profile</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Authenticated command center session</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
              {manager.avatar_url ? (
                <img
                  src={manager.avatar_url}
                  alt={manager.name}
                  className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shadow-sm shrink-0"
                  style={{ backgroundColor: theme.primaryHex }}
                >
                  {initials}
                </div>
              )}

              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{manager.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{manager.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    {manager.role || "Senior Queue Manager"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active Session
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all duration-200 active:scale-[0.98] cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Logout of Session
          </button>
        </div>

        {/* Card 4: About QueueFlow Pro Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${theme.primarySoftBg} ${theme.primaryText}`}>
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">About QueueFlow Pro</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Production Queue Management System</p>
              </div>
            </div>
            <span className="font-mono-code text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              v2.4
            </span>
          </div>

          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            QueueFlow Pro is a full-stack queue command center designed for high-throughput service desks, clinics,
            and counters. It supports sequential token issuance, live priority reordering, one-click service dispatch,
            AES-256-GCM field encryption, and real-time SLA analytics.
          </p>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Tech Stack</p>
            <div className="flex flex-wrap gap-2">
              {["React 18", "Tailwind CSS", "Lucide Icons", "Recharts", "FastAPI", "SQLite / PostgreSQL"].map(
                (tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <ShieldCheck className="w-3 h-3 text-teal-500" />
                    {tech}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
