import React, { useCallback, useEffect, useRef, useState } from "react";
import { THEME_PRESETS, DEFAULT_SETTINGS } from "./utils/theme";
import { STORAGE_KEYS, apiRequest, playDispatchChime } from "./utils/api";
import LoginView from "./components/LoginView";
import NavigationRail from "./components/NavigationRail";
import GreetingHeader from "./components/GreetingHeader";
import WorkspaceView from "./components/WorkspaceView";
import AnalyticsView from "./components/AnalyticsView";
import SettingsView from "./components/SettingsView";
import TvDisplayView from "./components/TvDisplayView";
import CommandPalette from "./components/CommandPalette";
import {
  QueueModal,
  CancelTokenModal,
  ResetDataModal,
  TokenSlipModal,
  ToastContainer,
} from "./components/Modals";

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.AUTH);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });

  const [queues, setQueues] = useState([]);
  const [activeQueueId, setActiveQueueId] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_QUEUE_ID);
    return saved ? Number(saved) : null;
  });
  const [activeTab, setActiveTab] = useState("operations"); // 'operations' | 'analytics' | 'tv' | 'settings'
  const [isLoadingQueues, setIsLoadingQueues] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const personNameInputRef = useRef(null);
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [queueToEdit, setQueueToEdit] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [slipTarget, setSlipTarget] = useState(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [, setTick] = useState(0);

  const theme = THEME_PRESETS[settings.accentTheme] || THEME_PRESETS.teal_violet;

  // Apply Dark/Light Mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.colorMode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [settings.colorMode]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = "success", options = {}) => {
    const id = Date.now() + Math.random();
    const durationMs = options.durationMs || 3400;
    setToasts((prev) => [
      ...prev,
      {
        id,
        message,
        type,
        durationMs: options.actionLabel ? durationMs : null,
        actionLabel: options.actionLabel || null,
        onAction: options.onAction || null,
      },
    ]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  const updateSettings = useCallback((nextSettings) => {
    setSettings(nextSettings);
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(nextSettings));
  }, []);

  const handleLogout = useCallback(async () => {
    if (session?.token) {
      try {
        await apiRequest("/api/auth/logout", { method: "POST" }, session.token);
      } catch {
        // Ignore network errors during logout
      }
    }
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    setSession(null);
    setQueues([]);
    setActiveTab("operations");
    showToast("Signed out cleanly.", "info");
  }, [session?.token, showToast]);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    setSession(null);
    setQueues([]);
    showToast("Session expired. Please sign in again.", "error");
  }, [showToast]);

  const loadQueues = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await apiRequest("/api/queues", {}, session.token, handleUnauthorized);
      const list = Array.isArray(data) ? data : data.queues || [];
      setQueues(list);
      setActiveQueueId((prev) => {
        if (prev && list.some((q) => q.id === prev)) return prev;
        const firstId = list.length ? list[0].id : null;
        if (firstId) localStorage.setItem(STORAGE_KEYS.ACTIVE_QUEUE_ID, String(firstId));
        return firstId;
      });
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsLoadingQueues(false);
    }
  }, [session?.token, handleUnauthorized, showToast]);

  // Verify saved session on mount & load queues
  useEffect(() => {
    if (!session?.token) return;
    loadQueues();
  }, [session?.token, loadQueues]);

  // 15s wait-time refresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (session && activeTab === "operations") {
        setTick((t) => t + 1);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [session, activeTab]);

  const handleLogin = async (email, password) => {
    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(data));
      setSession(data);
      showToast(`Welcome back, ${data.manager?.name || "Manager"}!`);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleGoogleToken = useCallback(
    async (credential) => {
      try {
        const data = await apiRequest("/api/auth/google", {
          method: "POST",
          body: JSON.stringify({ credential }),
        });
        localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(data));
        setSession(data);
        showToast(`Signed in with Google as ${data.manager?.name || "Manager"}!`);
      } catch (err) {
        showToast(err.message, "error");
      }
    },
    [showToast]
  );

  const handleSaveQueue = async (payload, editId) => {
    try {
      const url = editId ? `/api/queues/${editId}` : "/api/queues";
      const method = editId ? "PATCH" : "POST";
      const res = await apiRequest(
        url,
        { method, body: JSON.stringify(payload) },
        session.token,
        handleUnauthorized
      );
      setQueueModalOpen(false);
      setQueueToEdit(null);
      const savedQueueId = res?.queue?.id || res?.id;
      if (savedQueueId) {
        setActiveQueueId(savedQueueId);
        localStorage.setItem(STORAGE_KEYS.ACTIVE_QUEUE_ID, String(savedQueueId));
      }
      await loadQueues();
      showToast(editId ? "Queue updated." : `Queue "${payload.name}" created!`);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleIssueToken = async (queueId, payload) => {
    try {
      const res = await apiRequest(
        `/api/queues/${queueId}/tokens`,
        { method: "POST", body: JSON.stringify(payload) },
        session.token,
        handleUnauthorized
      );
      await loadQueues();
      const issuedTok = res?.token || res;
      const targetQueue = res?.queue || queues.find((q) => q.id === queueId);
      showToast(`Token ${issuedTok?.token_code || ""} issued for ${payload.person_name}!`, "success", {
        durationMs: 5000,
        actionLabel: "View / Print Slip",
        onAction: () => {
          if (issuedTok) setSlipTarget({ token: issuedTok, queue: targetQueue });
        },
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleMoveToken = async (queueId, tokenId, direction) => {
    try {
      await apiRequest(
        `/api/queues/${queueId}/tokens/${tokenId}/move`,
        { method: "PATCH", body: JSON.stringify({ direction }) },
        session.token,
        handleUnauthorized
      );
      await loadQueues();
      showToast(`Token moved ${direction}.`, "info");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleReorderToken = async (queueId, tokenId, targetPosition) => {
    try {
      await apiRequest(
        `/api/queues/${queueId}/tokens/${tokenId}/reorder`,
        { method: "PATCH", body: JSON.stringify({ target_position: targetPosition }) },
        session.token,
        handleUnauthorized
      );
      await loadQueues();
      showToast(`Token moved to #${targetPosition}.`, "info");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleRestoreToken = async (queueId, tokenId, originalPosition) => {
    try {
      await apiRequest(
        `/api/queues/${queueId}/tokens/${tokenId}/restore`,
        { method: "POST", body: JSON.stringify({ original_position: originalPosition }) },
        session.token,
        handleUnauthorized
      );
      await loadQueues();
      showToast("Token restored to waiting queue!", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleAssignTop = async (queueId) => {
    try {
      const res = await apiRequest(
        `/api/queues/${queueId}/assign-top`,
        { method: "POST" },
        session.token,
        handleUnauthorized
      );
      playDispatchChime(settings.soundEnabled);
      await loadQueues();
      showToast(`${res?.assigned_token?.token_code || "Top token"} assigned to service!`);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleCompleteService = async (queueId) => {
    try {
      await apiRequest(
        `/api/queues/${queueId}/complete-service`,
        { method: "POST" },
        session.token,
        handleUnauthorized
      );
      await loadQueues();
      showToast("Service marked complete!");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleConfirmCancel = async (queueId, tokenId, reason) => {
    const tokenCode = cancelTarget?.tokenCode || "Token";
    try {
      const res = await apiRequest(
        `/api/queues/${queueId}/tokens/${tokenId}/cancel`,
        { method: "POST", body: JSON.stringify({ reason }) },
        session.token,
        handleUnauthorized
      );
      setCancelTarget(null);
      await loadQueues();
      showToast(`${tokenCode} cancelled.`, "info", {
        durationMs: 5000,
        actionLabel: "Undo",
        onAction: () => handleRestoreToken(queueId, tokenId, res?.cancelled_position || null),
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleConfirmReset = async () => {
    try {
      await apiRequest("/api/demo/reset", { method: "POST" }, session.token, handleUnauthorized);
      setResetModalOpen(false);
      setActiveQueueId(null);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_QUEUE_ID);
      await loadQueues();
      showToast("Workspace cleared cleanly.", "info");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  if (!session) {
    return (
      <>
        <LoginView onLogin={handleLogin} onGoogleToken={handleGoogleToken} theme={theme} />
        <TokenSlipModal slip={slipTarget} onClose={() => setSlipTarget(null)} />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const activeQueue = queues.find((q) => q.id === activeQueueId) || queues[0] || null;

  // Keyboard Shortcuts: Cmd+K / Ctrl+K (Command Palette), Space / Ctrl+Enter (Assign Top), N (Focus New Token), Esc
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      if (e.key === "Escape") {
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
          return;
        }
        if (activeTab === "tv") {
          setActiveTab("operations");
          return;
        }
      }

      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select";
      if (isTyping || commandPaletteOpen || queueModalOpen || cancelTarget || resetModalOpen) return;

      if (activeTab === "operations" && activeQueue) {
        if ((e.key === " " || (e.ctrlKey && e.key === "Enter")) && (activeQueue.waiting_tokens || []).length > 0) {
          e.preventDefault();
          handleAssignTop(activeQueue.id);
        } else if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          personNameInputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, activeQueue, commandPaletteOpen, queueModalOpen, cancelTarget, resetModalOpen]);

  if (activeTab === "tv") {
    return (
      <>
        <TvDisplayView
          queues={queues}
          activeQueue={activeQueue}
          onSelectQueue={(id) => {
            setActiveQueueId(id);
            localStorage.setItem(STORAGE_KEYS.ACTIVE_QUEUE_ID, String(id));
          }}
          onExit={() => setActiveTab("operations")}
          theme={theme}
        />
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          queues={queues}
          onSelectQueue={(id) => {
            setActiveQueueId(id);
            localStorage.setItem(STORAGE_KEYS.ACTIVE_QUEUE_ID, String(id));
          }}
          onSelectTab={setActiveTab}
          onToggleThemeMode={() =>
            updateSettings({ ...settings, colorMode: settings.colorMode === "dark" ? "light" : "dark" })
          }
          colorMode={settings.colorMode}
          onAssignTop={handleAssignTop}
          activeQueue={activeQueue}
        />
        <TokenSlipModal slip={slipTarget} onClose={() => setSlipTarget(null)} />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F4F5F7] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Left Vertical Dark-Rail Navigation */}
      <NavigationRail
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenReset={() => setResetModalOpen(true)}
        onLogout={handleLogout}
        theme={theme}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <GreetingHeader
          session={session}
          settings={settings}
          queues={queues}
          theme={theme}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeTab === "operations" && (
            <WorkspaceView
              queues={queues}
              activeQueue={activeQueue}
              isLoading={isLoadingQueues}
              personNameInputRef={personNameInputRef}
              onSelectQueue={(id) => {
                setActiveQueueId(id);
                localStorage.setItem(STORAGE_KEYS.ACTIVE_QUEUE_ID, String(id));
              }}
              onOpenNewQueue={() => {
                setQueueToEdit(null);
                setQueueModalOpen(true);
              }}
              onOpenEditQueue={(q) => {
                setQueueToEdit(q);
                setQueueModalOpen(true);
              }}
              onIssueToken={handleIssueToken}
              onMoveToken={handleMoveToken}
              onReorderToken={handleReorderToken}
              onAssignTop={handleAssignTop}
              onCompleteService={handleCompleteService}
              onOpenCancelModal={(queueId, tokenId, tokenCode, personName) =>
                setCancelTarget({ queueId, tokenId, tokenCode, personName })
              }
              onOpenTokenSlip={(token, queue) => setSlipTarget({ token, queue })}
              theme={theme}
            />
          )}

          {activeTab === "analytics" && (
            <AnalyticsView
              queues={queues}
              token={session.token}
              onUnauthorized={handleUnauthorized}
              theme={theme}
              onShowToast={showToast}
            />
          )}

          {activeTab === "settings" && (
            <SettingsView
              settings={settings}
              onUpdateSettings={updateSettings}
              session={session}
              onLogout={handleLogout}
              theme={theme}
              onShowToast={showToast}
            />
          )}
        </main>
      </div>

      {/* In-Page Modals */}
      <QueueModal
        isOpen={queueModalOpen}
        queueToEdit={queueToEdit}
        defaultPrefix={settings.defaultPrefix}
        defaultSla={settings.defaultSla}
        onClose={() => {
          setQueueModalOpen(false);
          setQueueToEdit(null);
        }}
        onSave={handleSaveQueue}
        theme={theme}
      />

      <CancelTokenModal
        target={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
      />

      <ResetDataModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleConfirmReset}
      />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        queues={queues}
        onSelectQueue={(id) => {
          setActiveQueueId(id);
          localStorage.setItem(STORAGE_KEYS.ACTIVE_QUEUE_ID, String(id));
        }}
        onSelectTab={setActiveTab}
        onToggleThemeMode={() =>
          updateSettings({ ...settings, colorMode: settings.colorMode === "dark" ? "light" : "dark" })
        }
        colorMode={settings.colorMode}
        onAssignTop={handleAssignTop}
        activeQueue={activeQueue}
      />

      <TokenSlipModal slip={slipTarget} onClose={() => setSlipTarget(null)} />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

