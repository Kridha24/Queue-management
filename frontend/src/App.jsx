import React, { useCallback, useEffect, useState } from "react";
import { THEME_PRESETS, DEFAULT_SETTINGS } from "./utils/theme";
import { STORAGE_KEYS, apiRequest, playDispatchChime } from "./utils/api";
import LoginView from "./components/LoginView";
import NavigationRail from "./components/NavigationRail";
import GreetingHeader from "./components/GreetingHeader";
import WorkspaceView from "./components/WorkspaceView";
import AnalyticsView from "./components/AnalyticsView";
import SettingsView from "./components/SettingsView";
import {
  QueueModal,
  CancelTokenModal,
  ResetDataModal,
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
  const [activeTab, setActiveTab] = useState("operations"); // 'operations' | 'analytics' | 'settings'
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [queueToEdit, setQueueToEdit] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
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

  const showToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
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
      const list = data.queues || [];
      setQueues(list);
      setActiveQueueId((prev) => {
        if (prev && list.some((q) => q.id === prev)) return prev;
        const firstId = list.length ? list[0].id : null;
        if (firstId) localStorage.setItem(STORAGE_KEYS.ACTIVE_QUEUE_ID, String(firstId));
        return firstId;
      });
    } catch (err) {
      showToast(err.message, "error");
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
      if (res?.queue?.id) {
        setActiveQueueId(res.queue.id);
        localStorage.setItem(STORAGE_KEYS.ACTIVE_QUEUE_ID, String(res.queue.id));
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
      showToast(`Token ${res?.token?.token_code || ""} issued for ${payload.person_name}!`);
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
    try {
      await apiRequest(
        `/api/queues/${queueId}/tokens/${tokenId}/cancel`,
        { method: "POST", body: JSON.stringify({ reason }) },
        session.token,
        handleUnauthorized
      );
      setCancelTarget(null);
      await loadQueues();
      showToast("Token cancelled.", "info");
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
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  const activeQueue = queues.find((q) => q.id === activeQueueId) || queues[0] || null;

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
        <GreetingHeader session={session} settings={settings} queues={queues} theme={theme} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeTab === "operations" && (
            <WorkspaceView
              queues={queues}
              activeQueue={activeQueue}
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
              onAssignTop={handleAssignTop}
              onCompleteService={handleCompleteService}
              onOpenCancelModal={(queueId, tokenId, tokenCode, personName) =>
                setCancelTarget({ queueId, tokenId, tokenCode, personName })
              }
              theme={theme}
            />
          )}

          {activeTab === "analytics" && (
            <AnalyticsView
              queues={queues}
              token={session.token}
              onUnauthorized={handleUnauthorized}
              theme={theme}
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

      <ToastContainer toasts={toasts} />
    </div>
  );
}
