import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck, Sparkles, Lock, Mail, ArrowRight } from "lucide-react";

export default function LoginView({ onLogin, onGoogleToken, theme }) {
  const [email, setEmail] = useState("manager@queueflow.io");
  const [password, setPassword] = useState("manager123");
  const [loading, setLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState(null);
  const googleBtnRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/google/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg) => {
        if (!active || !cfg?.enabled || !cfg?.client_id) return;
        setGoogleClientId(cfg.client_id);
        const renderGoogle = () => {
          if (window.google?.accounts?.id && googleBtnRef.current) {
            window.google.accounts.id.initialize({
              client_id: cfg.client_id,
              callback: (response) => {
                if (response?.credential) onGoogleToken(response.credential);
              },
            });
            window.google.accounts.id.renderButton(googleBtnRef.current, {
              theme: "outline",
              size: "large",
              width: 340,
              text: "continue_with",
              shape: "pill",
            });
          }
        };
        if (window.google?.accounts?.id) renderGoogle();
        else setTimeout(renderGoogle, 800);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [onGoogleToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(email, password);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail("manager@queueflow.io");
    setPassword("manager123");
    setLoading(true);
    try {
      await onLogin("manager@queueflow.io", "manager123");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7] dark:bg-slate-950 px-4 py-10 transition-colors duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-fade-in">
        {/* Top Brand Banner */}
        <div className="bg-[#0F172A] px-7 py-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">QueueFlow Pro</h1>
              <p className="text-xs text-slate-400 font-medium">Command Center &bull; v2.4</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AES-256
          </span>
        </div>

        <div className="p-7 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Queue Manager Sign In</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Manage live queues, issue sequential tokens, and monitor service SLAs.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Manager Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@queueflow.io"
                  className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none transition ${theme.ringFocus}`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none transition ${theme.ringFocus}`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-white text-sm font-semibold shadow-sm transition-all duration-200 ease-out transform-gpu active:scale-[0.98] cursor-pointer disabled:opacity-60 ${theme.primaryBg}`}
            >
              <span>{loading ? "Signing In..." : "Sign In to Workspace"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            <span className="flex-shrink mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Quick Access
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          </div>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold transition-all duration-200 active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Instant Demo Login</span>
          </button>

          {googleClientId && (
            <div className="pt-1 flex justify-center">
              <div ref={googleBtnRef} />
            </div>
          )}

          <p className="text-[11px] text-center text-slate-400">
            Demo: <span className="font-mono-code text-slate-600 dark:text-slate-300">manager@queueflow.io</span> /{" "}
            <span className="font-mono-code text-slate-600 dark:text-slate-300">manager123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
