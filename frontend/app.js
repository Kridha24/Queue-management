/* QueueFlow Pro — Frontend Application Logic (API + LocalStorage Fallback) */

(() => {
  "use strict";

  const STORAGE_KEYS = {
    AUTH: "queueflow_auth_session_v1",
    LOCAL_DB: "queueflow_local_db_v1",
    ACTIVE_QUEUE_ID: "queueflow_active_queue_v1",
  };

  const DEMO_CREDENTIALS = {
    email: "manager@queueflow.io",
    password: "manager123",
  };

  // Application State
  const state = {
    session: null, // { token, manager: { id, name, email, role } }
    offlineMode: window.location.protocol === "file:",
    queues: [],
    activeQueueId: null,
    activeTab: "operations", // 'operations' | 'analytics'
    searchQuery: "",
    analyticsScope: "all",
    cancelTarget: null, // { queueId, tokenId, tokenCode, personName }
    busy: false,
    charts: {
      hourly: null,
      lifecycle: null,
      sla: null,
    },
  };

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatMinsAgo(isoString) {
    if (!isoString) return 0;
    const ms = Date.now() - new Date(isoString).getTime();
    return Math.max(0, Math.floor(ms / 60000));
  }

  function formatTime(isoString) {
    if (!isoString) return "—";
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const colors = {
      success: "bg-emerald-600 text-white border-emerald-700",
      error: "bg-rose-600 text-white border-rose-700",
      info: "bg-slate-900 text-white border-slate-800",
      warning: "bg-amber-500 text-white border-amber-600",
    };
    const toast = document.createElement("div");
    toast.className = `pointer-events-auto px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center justify-between gap-3 fade-in ${colors[type] || colors.info}`;
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.25s ease";
      setTimeout(() => toast.remove(), 260);
    }, 3200);
  }

  function updateSyncBadge() {
    const badge = document.getElementById("sync-badge");
    if (!badge) return;
    if (state.offlineMode) {
      badge.textContent = "Local Storage Mode";
      badge.className =
        "text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200";
    } else {
      badge.textContent = "API Synced";
      badge.className =
        "text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200";
    }
  }

  // ---------------------------------------------------------------------------
  // LocalStorage Fallback Seed & Operations
  // ---------------------------------------------------------------------------

  function buildDemoLocalQueues() {
    const now = Date.now();
    const minsAgo = (m) => new Date(now - m * 60000).toISOString();

    return [
      {
        id: 1,
        name: "General OPD Consultation",
        prefix: "OPD",
        counter_label: "Room 102",
        sla_minutes: 12,
        next_sequence: 110,
        created_at: minsAgo(300),
        in_service_token: {
          id: 106,
          queue_id: 1,
          token_code: "OPD-106",
          person_name: "Ananya Verma",
          phone: "+91 98450 21987",
          priority: "Priority",
          notes: "Pediatric consultation",
          status: "IN_SERVICE",
          position: null,
          created_at: minsAgo(28),
          assigned_at: minsAgo(9),
          completed_at: null,
          cancelled_at: null,
          cancel_reason: "",
          wait_duration_mins: 19.0,
        },
        waiting_tokens: [
          {
            id: 107,
            queue_id: 1,
            token_code: "OPD-107",
            person_name: "Siddharth Joshi",
            phone: "+91 98330 55412",
            priority: "Priority",
            notes: "Post-op suture check",
            status: "WAITING",
            position: 1,
            created_at: minsAgo(22),
            assigned_at: null,
            completed_at: null,
            cancelled_at: null,
            cancel_reason: "",
            wait_duration_mins: null,
          },
          {
            id: 108,
            queue_id: 1,
            token_code: "OPD-108",
            person_name: "Kavita Menon",
            phone: "+91 99876 54321",
            priority: "Standard",
            notes: "Routine blood pressure check",
            status: "WAITING",
            position: 2,
            created_at: minsAgo(15),
            assigned_at: null,
            completed_at: null,
            cancelled_at: null,
            cancel_reason: "",
            wait_duration_mins: null,
          },
          {
            id: 109,
            queue_id: 1,
            token_code: "OPD-109",
            person_name: "Devansh Kapoor",
            phone: "+91 98109 87654",
            priority: "Follow-up",
            notes: "Orthopedic review",
            status: "WAITING",
            position: 3,
            created_at: minsAgo(7),
            assigned_at: null,
            completed_at: null,
            cancelled_at: null,
            cancel_reason: "",
            wait_duration_mins: null,
          },
        ],
        history_tokens: [
          {
            id: 105,
            queue_id: 1,
            token_code: "OPD-105",
            person_name: "Vikram Desai",
            phone: "+91 97654 33210",
            priority: "Standard",
            notes: "Fever & cough",
            status: "SERVED",
            position: null,
            created_at: minsAgo(70),
            assigned_at: minsAgo(56),
            completed_at: minsAgo(44),
            cancelled_at: null,
            cancel_reason: "",
            wait_duration_mins: 14.0,
          },
          {
            id: 104,
            queue_id: 1,
            token_code: "OPD-104",
            person_name: "Meera Iyer",
            phone: "",
            priority: "Standard",
            notes: "Migraine consultation",
            status: "CANCELLED",
            position: null,
            created_at: minsAgo(95),
            assigned_at: null,
            completed_at: null,
            cancelled_at: minsAgo(80),
            cancel_reason: "Patient rescheduled for tomorrow",
            wait_duration_mins: null,
          },
          {
            id: 103,
            queue_id: 1,
            token_code: "OPD-103",
            person_name: "Rohan Kulkarni",
            phone: "+91 99001 12890",
            priority: "Follow-up",
            notes: "Lab report review",
            status: "SERVED",
            position: null,
            created_at: minsAgo(120),
            assigned_at: minsAgo(107),
            completed_at: minsAgo(95),
            cancelled_at: null,
            cancel_reason: "",
            wait_duration_mins: 13.0,
          },
        ],
      },
      {
        id: 2,
        name: "Pharmacy & Billing Desk",
        prefix: "PHM",
        counter_label: "Counter B",
        sla_minutes: 6,
        next_sequence: 108,
        created_at: minsAgo(300),
        in_service_token: {
          id: 204,
          queue_id: 2,
          token_code: "PHM-104",
          person_name: "Karan Patel",
          phone: "+91 98711 22334",
          priority: "Standard",
          notes: "OTC & invoice",
          status: "IN_SERVICE",
          position: null,
          created_at: minsAgo(16),
          assigned_at: minsAgo(5),
          completed_at: null,
          cancelled_at: null,
          cancel_reason: "",
          wait_duration_mins: 11.0,
        },
        waiting_tokens: [
          {
            id: 205,
            queue_id: 2,
            token_code: "PHM-105",
            person_name: "Farah Khan",
            phone: "+91 98198 44556",
            priority: "Standard",
            notes: "Prescription pickup",
            status: "WAITING",
            position: 1,
            created_at: minsAgo(11),
            assigned_at: null,
            completed_at: null,
            cancelled_at: null,
            cancel_reason: "",
            wait_duration_mins: null,
          },
          {
            id: 206,
            queue_id: 2,
            token_code: "PHM-106",
            person_name: "Manish Tiwari",
            phone: "",
            priority: "Follow-up",
            notes: "Receipt correction",
            status: "WAITING",
            position: 2,
            created_at: minsAgo(6),
            assigned_at: null,
            completed_at: null,
            cancelled_at: null,
            cancel_reason: "",
            wait_duration_mins: null,
          },
        ],
        history_tokens: [
          {
            id: 203,
            queue_id: 2,
            token_code: "PHM-103",
            person_name: "Sunita Rao",
            phone: "+91 98490 66778",
            priority: "Priority",
            notes: "Discharge medication",
            status: "SERVED",
            position: null,
            created_at: minsAgo(85),
            assigned_at: minsAgo(81),
            completed_at: minsAgo(75),
            cancelled_at: null,
            cancel_reason: "",
            wait_duration_mins: 4.0,
          },
        ],
      },
      {
        id: 3,
        name: "Diagnostics & Sample Collection",
        prefix: "LAB",
        counter_label: "Bay 04",
        sla_minutes: 10,
        next_sequence: 107,
        created_at: minsAgo(300),
        in_service_token: {
          id: 304,
          queue_id: 3,
          token_code: "LAB-104",
          person_name: "Sneha Chatterjee",
          phone: "+91 98311 22445",
          priority: "Follow-up",
          notes: "Repeat HbA1c",
          status: "IN_SERVICE",
          position: null,
          created_at: minsAgo(19),
          assigned_at: minsAgo(8),
          completed_at: null,
          cancelled_at: null,
          cancel_reason: "",
          wait_duration_mins: 11.0,
        },
        waiting_tokens: [
          {
            id: 305,
            queue_id: 3,
            token_code: "LAB-105",
            person_name: "Tarun Bhatia",
            phone: "+91 98111 33445",
            priority: "Priority",
            notes: "Urgent troponin draw",
            status: "WAITING",
            position: 1,
            created_at: minsAgo(12),
            assigned_at: null,
            completed_at: null,
            cancelled_at: null,
            cancel_reason: "",
            wait_duration_mins: null,
          },
          {
            id: 306,
            queue_id: 3,
            token_code: "LAB-106",
            person_name: "Ishita Roy",
            phone: "+91 98744 55667",
            priority: "Standard",
            notes: "Vitamin D & B12",
            status: "WAITING",
            position: 2,
            created_at: minsAgo(4),
            assigned_at: null,
            completed_at: null,
            cancelled_at: null,
            cancel_reason: "",
            wait_duration_mins: null,
          },
        ],
        history_tokens: [
          {
            id: 303,
            queue_id: 3,
            token_code: "LAB-103",
            person_name: "Nikhil Bansal",
            phone: "",
            priority: "Standard",
            notes: "Urine culture",
            status: "CANCELLED",
            position: null,
            created_at: minsAgo(65),
            assigned_at: null,
            completed_at: null,
            cancelled_at: minsAgo(50),
            cancel_reason: "Did not complete fasting window",
            wait_duration_mins: null,
          },
          {
            id: 302,
            queue_id: 3,
            token_code: "LAB-102",
            person_name: "Divya Krishnan",
            phone: "+91 98400 99881",
            priority: "Standard",
            notes: "CBC & thyroid panel",
            status: "SERVED",
            position: null,
            created_at: minsAgo(110),
            assigned_at: minsAgo(99),
            completed_at: minsAgo(89),
            cancelled_at: null,
            cancel_reason: "",
            wait_duration_mins: 11.0,
          },
        ],
      },
    ];
  }

  function getLocalQueues() {
    const raw = localStorage.getItem(STORAGE_KEYS.LOCAL_DB);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.LOCAL_DB, JSON.stringify([]));
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      localStorage.setItem(STORAGE_KEYS.LOCAL_DB, JSON.stringify([]));
      return [];
    }
  }

  function saveLocalQueues(queues) {
    localStorage.setItem(STORAGE_KEYS.LOCAL_DB, JSON.stringify(queues));
  }

  function computeLocalAnalytics(queues, scope) {
    const selectedId = scope && scope !== "all" ? Number(scope) : null;
    const scopedQueues = selectedId ? queues.filter((q) => q.id === selectedId) : queues;

    const collectTokens = (qs) => {
      const list = [];
      for (const q of qs) {
        if (q.in_service_token) list.push(q.in_service_token);
        list.push(...(q.waiting_tokens || []));
        list.push(...(q.history_tokens || []));
      }
      return list;
    };

    const scopedTokens = collectTokens(scopedQueues);
    const nowMs = Date.now();
    const waits = [];
    for (const t of scopedTokens) {
      if (t.wait_duration_mins !== null && t.wait_duration_mins !== undefined) {
        waits.push(Number(t.wait_duration_mins));
      } else if (t.status === "WAITING" && t.created_at) {
        waits.push(Math.max(0, (nowMs - new Date(t.created_at).getTime()) / 60000));
      }
    }

    const meanWait = waits.length ? Number((waits.reduce((a, b) => a + b, 0) / waits.length).toFixed(1)) : 0.0;
    const peakWait = waits.length ? Number(Math.max(...waits).toFixed(1)) : 0.0;

    const waiting = scopedTokens.filter((t) => t.status === "WAITING");
    const inService = scopedTokens.filter((t) => t.status === "IN_SERVICE");
    const served = scopedTokens.filter((t) => t.status === "SERVED");
    const cancelled = scopedTokens.filter((t) => t.status === "CANCELLED");

    const slaMap = Object.fromEntries(scopedQueues.map((q) => [q.id, q.sla_minutes]));
    const estClearance = waiting.reduce((acc, t) => acc + (slaMap[t.queue_id] || 10), 0);

    const resolved = served.length + cancelled.length;
    const completionRate = resolved > 0 ? Number(((served.length / resolved) * 100).toFixed(1)) : 0.0;
    const cancelRate =
      scopedTokens.length > 0 ? Number(((cancelled.length / scopedTokens.length) * 100).toFixed(1)) : 0.0;

    // Hourly trend (last 6 hours)
    const nowDate = new Date();
    nowDate.setMinutes(0, 0, 0);
    const hourly_trend = [];
    for (let offset = 5; offset >= 0; offset--) {
      const bucketStart = new Date(nowDate.getTime() - offset * 3600000);
      const bucketEnd = bucketStart.getTime() + 3600000;
      const label = `${String(bucketStart.getHours()).padStart(2, "0")}:00`;
      let waitingAtBucket = 0;
      let cumServed = 0;
      for (const t of scopedTokens) {
        const cMs = t.created_at ? new Date(t.created_at).getTime() : 0;
        if (!cMs || cMs > bucketEnd) continue;
        const compMs = t.completed_at ? new Date(t.completed_at).getTime() : null;
        const cancMs = t.cancelled_at ? new Date(t.cancelled_at).getTime() : null;
        const assgMs = t.assigned_at ? new Date(t.assigned_at).getTime() : null;
        if (compMs && compMs <= bucketEnd) {
          cumServed += 1;
        } else if (
          (!assgMs || assgMs > bucketEnd) &&
          (!cancMs || cancMs > bucketEnd) &&
          (!compMs || compMs > bucketEnd)
        ) {
          waitingAtBucket += 1;
        }
      }
      hourly_trend.push({
        hour_label: label,
        waiting_length: waitingAtBucket,
        cumulative_served: cumServed,
      });
    }

    const queue_breakdown = queues.map((q) => {
      const qTokens = collectTokens([q]);
      const qWaiting = q.waiting_tokens || [];
      const qInService = q.in_service_token ? [q.in_service_token] : [];
      const qServed = (q.history_tokens || []).filter((t) => t.status === "SERVED");
      const qCancelled = (q.history_tokens || []).filter((t) => t.status === "CANCELLED");

      const qWaits = [];
      for (const t of qTokens) {
        if (t.wait_duration_mins !== null && t.wait_duration_mins !== undefined) {
          qWaits.push(Number(t.wait_duration_mins));
        } else if (t.status === "WAITING" && t.created_at) {
          qWaits.push(Math.max(0, (nowMs - new Date(t.created_at).getTime()) / 60000));
        }
      }
      const qAvg = qWaits.length ? Number((qWaits.reduce((a, b) => a + b, 0) / qWaits.length).toFixed(1)) : 0.0;
      const qResolved = qServed.length + qCancelled.length;
      const qCompRate = qResolved > 0 ? Number(((qServed.length / qResolved) * 100).toFixed(1)) : 0.0;

      return {
        queue_id: q.id,
        name: q.name,
        prefix: q.prefix,
        counter_label: q.counter_label,
        sla_minutes: q.sla_minutes,
        waiting_count: qWaiting.length,
        in_service_count: qInService.length,
        served_count: qServed.length,
        cancelled_count: qCancelled.length,
        avg_wait_mins: qAvg,
        est_clearance_mins: qWaiting.length * q.sla_minutes,
        completion_rate_pct: qCompRate,
      };
    });

    const sla_comparison = queue_breakdown
      .filter((item) => !selectedId || item.queue_id === selectedId)
      .map((item) => ({
        queue_id: item.queue_id,
        queue_name: item.name,
        prefix: item.prefix,
        avg_wait_mins: item.avg_wait_mins,
        sla_minutes: item.sla_minutes,
      }));

    return {
      kpis: {
        mean_wait_mins: meanWait,
        peak_wait_mins: peakWait,
        active_queue_depth: waiting.length,
        estimated_clearance_mins: estClearance,
        served_count: served.length,
        completion_rate_pct: completionRate,
        cancelled_count: cancelled.length,
        cancellation_rate_pct: cancelRate,
        in_service_count: inService.length,
        total_tokens: scopedTokens.length,
      },
      hourly_trend,
      sla_comparison,
      lifecycle_breakdown: {
        waiting: waiting.length,
        in_service: inService.length,
        served: served.length,
        cancelled: cancelled.length,
      },
      queue_breakdown,
    };
  }

  // ---------------------------------------------------------------------------
  // API Client with Automatic LocalStorage Fallback
  // ---------------------------------------------------------------------------

  async function apiRequest(path, options = {}) {
    if (state.offlineMode) {
      throw new Error("OFFLINE_MODE");
    }
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (state.session && state.session.token) {
      headers.Authorization = `Bearer ${state.session.token}`;
    }

    let response;
    try {
      response = await fetch(path, { ...options, headers });
    } catch {
      state.offlineMode = true;
      updateSyncBadge();
      throw new Error("OFFLINE_MODE");
    }

    if (response.status === 401 && path !== "/api/auth/login") {
      handleForceLogout();
      throw new Error("Session expired. Please sign in again.");
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || `Request failed (${response.status})`);
    }
    return data;
  }

  // ---------------------------------------------------------------------------
  // Auth Flows
  // ---------------------------------------------------------------------------

  async function performLogin(email, password) {
    const loginError = document.getElementById("login-error");
    loginError.classList.add("hidden");

    try {
      let sessionData;
      if (!state.offlineMode) {
        try {
          sessionData = await apiRequest("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });
        } catch (err) {
          if (err.message !== "OFFLINE_MODE") throw err;
        }
      }

      if (!sessionData) {
        // LocalStorage fallback auth check
        if (
          email.trim().toLowerCase() === DEMO_CREDENTIALS.email &&
          password === DEMO_CREDENTIALS.password
        ) {
          sessionData = {
            token: "local-demo-session-token",
            manager: {
              id: 1,
              name: "Dr. Elena Vance",
              email: DEMO_CREDENTIALS.email,
              role: "Lead Queue Operations Manager",
            },
          };
        } else {
          throw new Error("Invalid email or password.");
        }
      }

      state.session = sessionData;
      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(sessionData));
      await enterApp();
      showToast(`Welcome back, ${sessionData.manager.name}`, "success");
    } catch (err) {
      loginError.textContent = err.message || "Unable to sign in.";
      loginError.classList.remove("hidden");
    }
  }

  function handleForceLogout() {
    state.session = null;
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    document.getElementById("app-view").classList.add("hidden");
    document.getElementById("login-view").classList.remove("hidden");
  }

  async function performLogout() {
    if (!state.offlineMode && state.session?.token) {
      try {
        await apiRequest("/api/auth/logout", { method: "POST" });
      } catch {
        // Ignore network errors during logout
      }
    }
    handleForceLogout();
    showToast("Signed out successfully.", "info");
  }

  // ---------------------------------------------------------------------------
  // Data Fetching & Mutations
  // ---------------------------------------------------------------------------

  async function loadQueues() {
    if (!state.offlineMode) {
      try {
        state.queues = await apiRequest("/api/queues");
        saveLocalQueues(state.queues);
      } catch (err) {
        if (err.message === "OFFLINE_MODE") {
          state.queues = getLocalQueues();
        } else {
          throw err;
        }
      }
    } else {
      state.queues = getLocalQueues();
    }

    const savedId = Number(localStorage.getItem(STORAGE_KEYS.ACTIVE_QUEUE_ID));
    if (state.queues.some((q) => q.id === savedId)) {
      state.activeQueueId = savedId;
    } else if (state.queues.length > 0 && !state.queues.some((q) => q.id === state.activeQueueId)) {
      state.activeQueueId = state.queues[0].id;
    }
    renderAll();
  }

  function getActiveQueue() {
    return state.queues.find((q) => q.id === state.activeQueueId) || state.queues[0] || null;
  }

  async function saveQueue(payload, editId = null) {
    if (state.busy) return;
    state.busy = true;
    try {
      if (!state.offlineMode) {
        const saved = editId
          ? await apiRequest(`/api/queues/${editId}`, {
              method: "PATCH",
              body: JSON.stringify(payload),
            })
          : await apiRequest("/api/queues", {
              method: "POST",
              body: JSON.stringify(payload),
            });
        state.activeQueueId = saved.id;
        localStorage.setItem(STORAGE_KEYS.ACTIVE_QUEUE_ID, String(saved.id));
        await loadQueues();
        showToast(editId ? "Queue settings updated." : `Queue "${saved.name}" created.`, "success");
      } else {
        const queues = getLocalQueues();
        if (editId) {
          const target = queues.find((q) => q.id === Number(editId));
          if (target) {
            target.name = payload.name;
            target.prefix = payload.prefix.toUpperCase();
            target.counter_label = payload.counter_label;
            target.sla_minutes = Number(payload.sla_minutes);
          }
        } else {
          const newId = queues.length ? Math.max(...queues.map((q) => q.id)) + 1 : 1;
          queues.push({
            id: newId,
            name: payload.name,
            prefix: payload.prefix.toUpperCase(),
            counter_label: payload.counter_label,
            sla_minutes: Number(payload.sla_minutes),
            next_sequence: 101,
            created_at: new Date().toISOString(),
            waiting_tokens: [],
            in_service_token: null,
            history_tokens: [],
          });
          state.activeQueueId = newId;
          localStorage.setItem(STORAGE_KEYS.ACTIVE_QUEUE_ID, String(newId));
        }
        saveLocalQueues(queues);
        await loadQueues();
        showToast(editId ? "Queue settings updated." : "Queue created.", "success");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      state.busy = false;
    }
  }

  async function issueToken(queueId, payload) {
    if (state.busy) return;
    state.busy = true;
    try {
      let created;
      if (!state.offlineMode) {
        created = await apiRequest(`/api/queues/${queueId}/tokens`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        const queues = getLocalQueues();
        const q = queues.find((item) => item.id === queueId);
        if (!q) throw new Error("Queue not found");
        const code = `${q.prefix}-${q.next_sequence}`;
        q.next_sequence += 1;
        const nextPos = q.waiting_tokens.length + 1;
        created = {
          id: Date.now(),
          queue_id: queueId,
          token_code: code,
          person_name: payload.person_name,
          phone: payload.phone || "",
          priority: payload.priority,
          notes: payload.notes || "",
          status: "WAITING",
          position: nextPos,
          created_at: new Date().toISOString(),
          assigned_at: null,
          completed_at: null,
          cancelled_at: null,
          cancel_reason: "",
          wait_duration_mins: null,
        };
        q.waiting_tokens.push(created);
        saveLocalQueues(queues);
      }
      await loadQueues();
      showToast(`Token ${created.token_code} issued for ${created.person_name}`, "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      state.busy = false;
    }
  }

  async function moveToken(queueId, tokenId, direction) {
    if (state.busy) return;
    state.busy = true;
    try {
      if (!state.offlineMode) {
        await apiRequest(`/api/queues/${queueId}/tokens/${tokenId}/move`, {
          method: "PATCH",
          body: JSON.stringify({ direction }),
        });
      } else {
        const queues = getLocalQueues();
        const q = queues.find((item) => item.id === queueId);
        if (!q) throw new Error("Queue not found");
        const idx = q.waiting_tokens.findIndex((t) => t.id === tokenId);
        if (idx === -1) throw new Error("Token not found");
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= q.waiting_tokens.length) {
          throw new Error("Cannot move token out of bounds");
        }
        [q.waiting_tokens[idx], q.waiting_tokens[swapIdx]] = [
          q.waiting_tokens[swapIdx],
          q.waiting_tokens[idx],
        ];
        q.waiting_tokens.forEach((t, i) => {
          t.position = i + 1;
        });
        saveLocalQueues(queues);
      }
      await loadQueues();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      state.busy = false;
    }
  }

  async function assignTopToken(queueId) {
    if (state.busy) return;
    state.busy = true;
    try {
      if (!state.offlineMode) {
        await apiRequest(`/api/queues/${queueId}/assign-top`, { method: "POST" });
      } else {
        const queues = getLocalQueues();
        const q = queues.find((item) => item.id === queueId);
        if (!q || q.waiting_tokens.length === 0) throw new Error("No waiting tokens in queue");
        const nowIso = new Date().toISOString();
        if (q.in_service_token) {
          q.in_service_token.status = "SERVED";
          q.in_service_token.completed_at = nowIso;
          q.history_tokens.unshift(q.in_service_token);
        }
        const top = q.waiting_tokens.shift();
        const waitMins = Number(
          Math.max(0, (Date.now() - new Date(top.created_at).getTime()) / 60000).toFixed(2)
        );
        top.status = "IN_SERVICE";
        top.position = null;
        top.assigned_at = nowIso;
        top.wait_duration_mins = waitMins;
        q.in_service_token = top;
        q.waiting_tokens.forEach((t, i) => {
          t.position = i + 1;
        });
        saveLocalQueues(queues);
      }
      await loadQueues();
      const activeQ = getActiveQueue();
      const code = activeQ?.in_service_token?.token_code || "Top token";
      showToast(`${code} assigned to service.`, "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      state.busy = false;
    }
  }

  async function completeActiveService(queueId) {
    if (state.busy) return;
    state.busy = true;
    try {
      if (!state.offlineMode) {
        await apiRequest(`/api/queues/${queueId}/complete-service`, { method: "POST" });
      } else {
        const queues = getLocalQueues();
        const q = queues.find((item) => item.id === queueId);
        if (!q || !q.in_service_token) throw new Error("No token currently in service");
        q.in_service_token.status = "SERVED";
        q.in_service_token.completed_at = new Date().toISOString();
        q.history_tokens.unshift(q.in_service_token);
        q.in_service_token = null;
        saveLocalQueues(queues);
      }
      await loadQueues();
      showToast("Service marked complete.", "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      state.busy = false;
    }
  }

  async function cancelWaitingToken(queueId, tokenId, reason) {
    if (state.busy) return;
    state.busy = true;
    try {
      if (!state.offlineMode) {
        await apiRequest(`/api/queues/${queueId}/tokens/${tokenId}`, {
          method: "DELETE",
          body: JSON.stringify({ reason }),
        });
      } else {
        const queues = getLocalQueues();
        const q = queues.find((item) => item.id === queueId);
        if (!q) throw new Error("Queue not found");
        const idx = q.waiting_tokens.findIndex((t) => t.id === tokenId);
        if (idx === -1) throw new Error("Waiting token not found");
        const [removed] = q.waiting_tokens.splice(idx, 1);
        removed.status = "CANCELLED";
        removed.position = null;
        removed.cancelled_at = new Date().toISOString();
        removed.cancel_reason = reason || "";
        q.history_tokens.unshift(removed);
        q.waiting_tokens.forEach((t, i) => {
          t.position = i + 1;
        });
        saveLocalQueues(queues);
      }
      await loadQueues();
      showToast("Token cancelled and logged.", "info");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      state.busy = false;
    }
  }

  async function clearAllData() {
    if (state.busy) return;
    state.busy = true;
    try {
      if (!state.offlineMode) {
        await apiRequest("/api/clear-data", { method: "POST" });
      } else {
        saveLocalQueues([]);
      }
      state.activeQueueId = null;
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_QUEUE_ID);
      await loadQueues();
      showToast("All queue data cleared.", "info");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      state.busy = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering — Queue Operations
  // ---------------------------------------------------------------------------

  function renderAll() {
    renderSidebar();
    renderActiveQueueWorkspace();
    renderAnalyticsScopeDropdown();
    if (state.activeTab === "analytics") {
      renderAnalyticsDashboard();
    }
  }

  function renderSidebar() {
    const container = document.getElementById("queue-sidebar-list");
    if (!state.queues.length) {
      container.innerHTML = `<p class="text-xs text-slate-400 py-4 text-center">No queues yet. Create one above.</p>`;
      return;
    }

    container.innerHTML = state.queues
      .map((q) => {
        const isActive = q.id === state.activeQueueId;
        const waitingCount = (q.waiting_tokens || []).length;
        return `
          <button type="button" data-queue-id="${q.id}"
            class="queue-select-btn w-full text-left p-3 rounded-xl border transition cursor-pointer ${
              isActive
                ? "bg-indigo-50 border-indigo-300 shadow-xs"
                : "bg-white border-slate-200 hover:bg-slate-50"
            }">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-bold ${isActive ? "text-indigo-900" : "text-slate-800"} truncate">${escapeHtml(q.name)}</span>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${
                waitingCount > 0 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
              }">${waitingCount}</span>
            </div>
            <div class="flex items-center justify-between mt-1 text-[11px] text-slate-500">
              <span class="font-mono font-semibold">${escapeHtml(q.prefix)} &bull; ${escapeHtml(q.counter_label)}</span>
              <span>SLA ${q.sla_minutes}m</span>
            </div>
          </button>
        `;
      })
      .join("");

    container.querySelectorAll(".queue-select-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeQueueId = Number(btn.dataset.queueId);
        localStorage.setItem(STORAGE_KEYS.ACTIVE_QUEUE_ID, String(state.activeQueueId));
        renderAll();
      });
    });
  }

  function priorityBadgeHtml(priority) {
    if (priority === "Priority") {
      return `<span class="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">Priority</span>`;
    }
    if (priority === "Follow-up") {
      return `<span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-semibold">Follow-up</span>`;
    }
    return `<span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium">Standard</span>`;
  }

  function renderActiveQueueWorkspace() {
    const q = getActiveQueue();
    const emptyState = document.getElementById("empty-queue-state");
    const activeWorkspace = document.getElementById("active-queue-workspace");
    const issueBtn = document.getElementById("issue-token-submit");

    if (!q) {
      emptyState.classList.remove("hidden");
      activeWorkspace.classList.add("hidden");
      document.getElementById("form-queue-label").textContent = "create a queue first";
      issueBtn.disabled = true;
      issueBtn.classList.add("opacity-50", "cursor-not-allowed");
      return;
    }

    emptyState.classList.add("hidden");
    activeWorkspace.classList.remove("hidden");
    issueBtn.disabled = false;
    issueBtn.classList.remove("opacity-50", "cursor-not-allowed");

    const waiting = q.waiting_tokens || [];
    const estClearance = waiting.length * q.sla_minutes;

    document.getElementById("form-queue-label").textContent = q.name;
    document.getElementById("active-queue-name").textContent = q.name;
    document.getElementById("active-queue-prefix").textContent = q.prefix;
    document.getElementById("active-queue-counter").textContent = q.counter_label;
    document.getElementById("active-queue-sla").textContent = `${q.sla_minutes} mins/token`;
    document.getElementById("active-queue-waiting-count").textContent = String(waiting.length);
    document.getElementById("active-queue-clearance").textContent = `${estClearance} mins`;

    const assignTopHeaderBtn = document.getElementById("assign-top-header-btn");
    assignTopHeaderBtn.disabled = waiting.length === 0;

    // Currently In Service Banner
    const banner = document.getElementById("in-service-banner");
    const activeToken = q.in_service_token;
    if (activeToken) {
      banner.className = "rounded-xl border border-emerald-300 bg-emerald-50/80 p-4 shadow-sm";
      banner.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-start gap-3.5">
            <div class="px-3 py-2 rounded-lg bg-emerald-600 text-white font-mono font-bold text-base shadow-xs">
              ${escapeHtml(activeToken.token_code)}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Currently In Service &bull; ${escapeHtml(q.counter_label)}</span>
                ${priorityBadgeHtml(activeToken.priority)}
              </div>
              <p class="text-base font-bold text-slate-900 mt-0.5">${escapeHtml(activeToken.person_name)}</p>
              <p class="text-xs text-slate-600 mt-0.5">
                Called at ${formatTime(activeToken.assigned_at)}
                &bull; Waited ${activeToken.wait_duration_mins !== null ? Number(activeToken.wait_duration_mins).toFixed(1) : "0.0"} mins
                ${activeToken.notes ? ` &bull; Note: "${escapeHtml(activeToken.notes)}"` : ""}
              </p>
            </div>
          </div>
          <button type="button" id="complete-service-btn"
            class="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer shrink-0">
            ✓ Mark Service Complete
          </button>
        </div>
      `;
      document.getElementById("complete-service-btn").addEventListener("click", () => {
        completeActiveService(q.id);
      });
    } else {
      banner.className = "rounded-xl border border-slate-200 bg-slate-100/70 p-4";
      banner.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Currently In Service &bull; ${escapeHtml(q.counter_label)}</p>
            <p class="text-sm text-slate-600 mt-0.5">Counter is idle. Click <strong>Assign Top Token for Service</strong> to call #1.</p>
          </div>
        </div>
      `;
    }

    // Live Waiting Queue List
    const listContainer = document.getElementById("waiting-list-container");
    const term = state.searchQuery.trim().toLowerCase();
    const filtered = term
      ? waiting.filter(
          (t) =>
            t.token_code.toLowerCase().includes(term) ||
            t.person_name.toLowerCase().includes(term) ||
            (t.phone || "").toLowerCase().includes(term) ||
            t.priority.toLowerCase().includes(term)
        )
      : waiting;

    if (waiting.length === 0) {
      listContainer.innerHTML = `
        <div class="p-8 text-center">
          <p class="text-sm font-semibold text-slate-600">No tokens currently waiting in ${escapeHtml(q.name)}.</p>
          <p class="text-xs text-slate-400 mt-1">Use the "Issue New Token" form on the left to add someone.</p>
        </div>
      `;
    } else if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="p-6 text-center text-sm text-slate-500">
          No waiting tokens match "<strong>${escapeHtml(state.searchQuery)}</strong>".
        </div>
      `;
    } else {
      listContainer.innerHTML = filtered
        .map((t) => {
          const isFirst = t.position === 1;
          const isLast = t.position === waiting.length;
          const waitMins = formatMinsAgo(t.created_at);
          const estServiceMins = (t.position - 1) * q.sla_minutes + (activeToken ? Math.ceil(q.sla_minutes / 2) : 0);

          return `
            <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition ${
              isFirst ? "bg-indigo-50/30" : ""
            }">
              <div class="flex items-start gap-3.5">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                  isFirst
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }">
                  #${t.position}
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">${escapeHtml(t.token_code)}</span>
                    <span class="text-sm font-bold text-slate-900">${escapeHtml(t.person_name)}</span>
                    ${priorityBadgeHtml(t.priority)}
                  </div>
                  <div class="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span>Waiting: <strong class="text-slate-700">${waitMins} min</strong></span>
                    <span>&bull;</span>
                    <span>Est. service: <strong class="text-slate-700">~${estServiceMins} min</strong></span>
                    ${t.phone ? `<span>&bull; ${escapeHtml(t.phone)}</span>` : ""}
                    ${t.notes ? `<span>&bull; <em>"${escapeHtml(t.notes)}"</em></span>` : ""}
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-1.5 shrink-0">
                ${
                  isFirst
                    ? `<button type="button" data-action="assign-top"
                        class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition cursor-pointer mr-1">
                        ▶ Assign
                      </button>`
                    : ""
                }
                <button type="button" data-action="move-up" data-token-id="${t.id}" ${isFirst ? "disabled" : ""}
                  title="Move Up"
                  class="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-700 transition cursor-pointer">
                  ↑ Up
                </button>
                <button type="button" data-action="move-down" data-token-id="${t.id}" ${isLast ? "disabled" : ""}
                  title="Move Down"
                  class="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-slate-700 transition cursor-pointer">
                  ↓ Down
                </button>
                <button type="button" data-action="cancel-token" data-token-id="${t.id}"
                  data-token-code="${escapeHtml(t.token_code)}" data-person-name="${escapeHtml(t.person_name)}"
                  class="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition cursor-pointer ml-1">
                  Cancel
                </button>
              </div>
            </div>
          `;
        })
        .join("");

      listContainer.querySelectorAll("[data-action='assign-top']").forEach((btn) => {
        btn.addEventListener("click", () => assignTopToken(q.id));
      });
      listContainer.querySelectorAll("[data-action='move-up']").forEach((btn) => {
        btn.addEventListener("click", () => moveToken(q.id, Number(btn.dataset.tokenId), "up"));
      });
      listContainer.querySelectorAll("[data-action='move-down']").forEach((btn) => {
        btn.addEventListener("click", () => moveToken(q.id, Number(btn.dataset.tokenId), "down"));
      });
      listContainer.querySelectorAll("[data-action='cancel-token']").forEach((btn) => {
        btn.addEventListener("click", () => {
          openCancelModal(
            q.id,
            Number(btn.dataset.tokenId),
            btn.dataset.tokenCode,
            btn.dataset.personName
          );
        });
      });
    }

    // History Log
    const history = q.history_tokens || [];
    document.getElementById("history-count-badge").textContent = `${history.length} record${history.length === 1 ? "" : "s"}`;
    const historyContainer = document.getElementById("history-list-container");
    if (history.length === 0) {
      historyContainer.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">No completed or cancelled tokens yet.</div>`;
    } else {
      historyContainer.innerHTML = history
        .map((t) => {
          const isServed = t.status === "SERVED";
          const statusBadge = isServed
            ? `<span class="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">SERVED</span>`
            : `<span class="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">CANCELLED</span>`;
          const eventTime = isServed ? formatTime(t.completed_at) : formatTime(t.cancelled_at);
          return `
            <div class="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div class="flex items-center gap-2.5 flex-wrap">
                ${statusBadge}
                <span class="font-mono font-bold text-slate-800">${escapeHtml(t.token_code)}</span>
                <span class="font-semibold text-slate-800">${escapeHtml(t.person_name)}</span>
                ${
                  isServed && t.wait_duration_mins !== null
                    ? `<span class="text-slate-500">&bull; Waited ${Number(t.wait_duration_mins).toFixed(1)} mins</span>`
                    : ""
                }
                ${
                  !isServed && t.cancel_reason
                    ? `<span class="text-rose-600 italic">&bull; Reason: "${escapeHtml(t.cancel_reason)}"</span>`
                    : ""
                }
              </div>
              <span class="text-slate-400 font-mono">${eventTime}</span>
            </div>
          `;
        })
        .join("");
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering — Analytics Dashboard
  // ---------------------------------------------------------------------------

  function renderAnalyticsScopeDropdown() {
    const select = document.getElementById("analytics-scope-select");
    const current = state.analyticsScope;
    select.innerHTML = `<option value="all">All Queues Combined</option>`;
    for (const q of state.queues) {
      const opt = document.createElement("option");
      opt.value = String(q.id);
      opt.textContent = `${q.name} (${q.prefix})`;
      select.appendChild(opt);
    }
    if ([...select.options].some((o) => o.value === current)) {
      select.value = current;
    } else {
      state.analyticsScope = "all";
      select.value = "all";
    }
  }

  async function renderAnalyticsDashboard() {
    let data;
    try {
      if (!state.offlineMode) {
        data = await apiRequest(`/api/analytics?queue_id=${encodeURIComponent(state.analyticsScope)}`);
      } else {
        data = computeLocalAnalytics(state.queues, state.analyticsScope);
      }
    } catch (err) {
      if (err.message === "OFFLINE_MODE") {
        data = computeLocalAnalytics(state.queues, state.analyticsScope);
      } else {
        showToast(err.message, "error");
        return;
      }
    }

    const { kpis, hourly_trend, sla_comparison, lifecycle_breakdown, queue_breakdown } = data;

    // 4 KPI Cards
    document.getElementById("kpi-mean-wait").innerHTML =
      `${Number(kpis.mean_wait_mins).toFixed(1)} <span class="text-sm font-medium text-slate-500">mins</span>`;
    document.getElementById("kpi-peak-wait").textContent =
      `Peak observed: ${Number(kpis.peak_wait_mins).toFixed(1)} mins`;

    document.getElementById("kpi-active-depth").innerHTML =
      `${kpis.active_queue_depth} <span class="text-sm font-medium text-slate-500">waiting</span>`;
    document.getElementById("kpi-clearance-time").textContent =
      `Est. clearance: ${kpis.estimated_clearance_mins} mins`;

    document.getElementById("kpi-served-count").innerHTML =
      `${kpis.served_count} <span class="text-sm font-medium text-slate-500">served</span>`;
    document.getElementById("kpi-completion-rate").textContent =
      `Completion rate: ${Number(kpis.completion_rate_pct).toFixed(1)}%`;

    document.getElementById("kpi-cancel-rate").textContent =
      `${Number(kpis.cancellation_rate_pct).toFixed(1)}%`;
    document.getElementById("kpi-cancel-count").textContent =
      `${kpis.cancelled_count} cancelled token${kpis.cancelled_count === 1 ? "" : "s"}`;

    // Chart 1: Hourly Queue Length & Throughput Trend
    if (state.charts.hourly) state.charts.hourly.destroy();
    const ctxHourly = document.getElementById("chart-hourly-trend").getContext("2d");
    state.charts.hourly = new Chart(ctxHourly, {
      type: "line",
      data: {
        labels: hourly_trend.map((p) => p.hour_label),
        datasets: [
          {
            label: "Waiting Queue Length",
            data: hourly_trend.map((p) => p.waiting_length),
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79, 70, 229, 0.12)",
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
          },
          {
            label: "Cumulative Tokens Served",
            data: hourly_trend.map((p) => p.cumulative_served),
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            fill: false,
            tension: 0.35,
            borderWidth: 2.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });

    // Chart 2: Token Lifecycle Breakdown (Doughnut)
    if (state.charts.lifecycle) state.charts.lifecycle.destroy();
    const ctxLifecycle = document.getElementById("chart-lifecycle").getContext("2d");
    state.charts.lifecycle = new Chart(ctxLifecycle, {
      type: "doughnut",
      data: {
        labels: ["Waiting", "In Service", "Served", "Cancelled"],
        datasets: [
          {
            data: [
              lifecycle_breakdown.waiting,
              lifecycle_breakdown.in_service,
              lifecycle_breakdown.served,
              lifecycle_breakdown.cancelled,
            ],
            backgroundColor: ["#4f46e5", "#0ea5e9", "#10b981", "#f43f5e"],
            borderWidth: 2,
            borderColor: "#ffffff",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: { legend: { position: "bottom" } },
      },
    });

    // Chart 3: Average Wait Time vs Target SLA by Queue (Grouped Bar)
    if (state.charts.sla) state.charts.sla.destroy();
    const ctxSla = document.getElementById("chart-sla-comparison").getContext("2d");
    state.charts.sla = new Chart(ctxSla, {
      type: "bar",
      data: {
        labels: sla_comparison.map((q) => `${q.queue_name} (${q.prefix})`),
        datasets: [
          {
            label: "Observed Avg Wait (mins)",
            data: sla_comparison.map((q) => q.avg_wait_mins),
            backgroundColor: "#6366f1",
            borderRadius: 6,
          },
          {
            label: "Target SLA (mins)",
            data: sla_comparison.map((q) => q.sla_minutes),
            backgroundColor: "#cbd5e1",
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });

    // Per-Queue Breakdown Table
    const tbody = document.getElementById("analytics-breakdown-tbody");
    if (!queue_breakdown.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="py-8 px-4 text-center text-xs text-slate-400">
            No queues created yet. Create a queue and issue tokens to see operational metrics.
          </td>
        </tr>
      `;
      return;
    }
    tbody.innerHTML = queue_breakdown
      .map(
        (row) => `
        <tr class="hover:bg-slate-50">
          <td class="py-3 px-4 font-semibold text-slate-900">
            ${escapeHtml(row.name)}
            <span class="ml-1.5 font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${escapeHtml(row.prefix)}</span>
          </td>
          <td class="py-3 px-4 text-slate-600">${escapeHtml(row.counter_label)}</td>
          <td class="py-3 px-4 text-right text-slate-600">${row.sla_minutes}m</td>
          <td class="py-3 px-4 text-right font-bold text-indigo-600">${row.waiting_count}</td>
          <td class="py-3 px-4 text-right font-semibold text-sky-600">${row.in_service_count}</td>
          <td class="py-3 px-4 text-right font-semibold text-emerald-600">${row.served_count}</td>
          <td class="py-3 px-4 text-right font-semibold text-rose-600">${row.cancelled_count}</td>
          <td class="py-3 px-4 text-right font-medium text-slate-800">${Number(row.avg_wait_mins).toFixed(1)}m</td>
          <td class="py-3 px-4 text-right text-slate-600">${row.est_clearance_mins}m</td>
          <td class="py-3 px-4 text-right font-semibold text-slate-800">${Number(row.completion_rate_pct).toFixed(1)}%</td>
        </tr>
      `
      )
      .join("");
  }

  // ---------------------------------------------------------------------------
  // Modals & Navigation
  // ---------------------------------------------------------------------------

  function switchTab(tab) {
    state.activeTab = tab;
    const opsTab = document.getElementById("operations-tab");
    const anaTab = document.getElementById("analytics-tab");
    const opsBtn = document.getElementById("tab-btn-operations");
    const anaBtn = document.getElementById("tab-btn-analytics");

    if (tab === "operations") {
      opsTab.classList.remove("hidden");
      anaTab.classList.add("hidden");
      opsBtn.className =
        "px-3.5 py-1.5 rounded-md text-sm font-semibold transition cursor-pointer bg-white text-indigo-700 shadow-sm";
      anaBtn.className =
        "px-3.5 py-1.5 rounded-md text-sm font-semibold transition cursor-pointer text-slate-600 hover:text-slate-900";
    } else {
      opsTab.classList.add("hidden");
      anaTab.classList.remove("hidden");
      anaBtn.className =
        "px-3.5 py-1.5 rounded-md text-sm font-semibold transition cursor-pointer bg-white text-indigo-700 shadow-sm";
      opsBtn.className =
        "px-3.5 py-1.5 rounded-md text-sm font-semibold transition cursor-pointer text-slate-600 hover:text-slate-900";
      renderAnalyticsDashboard();
    }
  }

  function openQueueModal(queueToEdit = null) {
    const modal = document.getElementById("queue-modal");
    document.getElementById("queue-modal-title").textContent = queueToEdit
      ? "Edit Queue Settings"
      : "Create Service Queue";
    document.getElementById("queue-modal-id").value = queueToEdit ? String(queueToEdit.id) : "";
    document.getElementById("queue-modal-name").value = queueToEdit ? queueToEdit.name : "";
    document.getElementById("queue-modal-prefix").value = queueToEdit ? queueToEdit.prefix : "";
    document.getElementById("queue-modal-counter").value = queueToEdit ? queueToEdit.counter_label : "";
    document.getElementById("queue-modal-sla").value = queueToEdit ? String(queueToEdit.sla_minutes) : "10";
    modal.classList.remove("hidden");
  }

  function closeQueueModal() {
    document.getElementById("queue-modal").classList.add("hidden");
  }

  function openCancelModal(queueId, tokenId, tokenCode, personName) {
    state.cancelTarget = { queueId, tokenId, tokenCode, personName };
    document.getElementById("cancel-modal-subtitle").textContent =
      `Cancel token ${tokenCode} for ${personName}? This will remove them from the waiting list and log the cancellation.`;
    document.getElementById("cancel-reason-input").value = "";
    document.getElementById("cancel-modal").classList.remove("hidden");
  }

  function closeCancelModal() {
    state.cancelTarget = null;
    document.getElementById("cancel-modal").classList.add("hidden");
  }

  // ---------------------------------------------------------------------------
  // Bootstrapping & Event Listeners
  // ---------------------------------------------------------------------------

  async function enterApp() {
    document.getElementById("login-view").classList.add("hidden");
    document.getElementById("app-view").classList.remove("hidden");
    document.getElementById("manager-name").textContent = state.session?.manager?.name || "Manager";
    document.getElementById("manager-email").textContent = state.session?.manager?.email || "";
    updateSyncBadge();
    await loadQueues();
  }

  function bindEvents() {
    // Login form
    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const password = document.getElementById("login-password").value;
      await performLogin(email, password);
    });

    document.getElementById("demo-login-btn").addEventListener("click", async () => {
      document.getElementById("login-email").value = DEMO_CREDENTIALS.email;
      document.getElementById("login-password").value = DEMO_CREDENTIALS.password;
      await performLogin(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
    });

    document.getElementById("logout-btn").addEventListener("click", performLogout);

    // Navigation Tabs
    document.getElementById("tab-btn-operations").addEventListener("click", () => switchTab("operations"));
    document.getElementById("tab-btn-analytics").addEventListener("click", () => switchTab("analytics"));

    // Queue Creation & Editing
    document.getElementById("new-queue-btn").addEventListener("click", () => openQueueModal(null));
    document.getElementById("empty-create-queue-btn").addEventListener("click", () => openQueueModal(null));
    document.getElementById("edit-queue-btn").addEventListener("click", () => {
      const q = getActiveQueue();
      if (q) openQueueModal(q);
    });
    document.getElementById("queue-modal-close").addEventListener("click", closeQueueModal);
    document.getElementById("queue-modal-cancel").addEventListener("click", closeQueueModal);
    document.getElementById("queue-modal-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const editId = document.getElementById("queue-modal-id").value || null;
      const payload = {
        name: document.getElementById("queue-modal-name").value.trim(),
        prefix: document.getElementById("queue-modal-prefix").value.trim().toUpperCase(),
        counter_label: document.getElementById("queue-modal-counter").value.trim(),
        sla_minutes: Number(document.getElementById("queue-modal-sla").value),
      };
      closeQueueModal();
      await saveQueue(payload, editId);
    });

    // Issue New Token
    document.getElementById("issue-token-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const q = getActiveQueue();
      if (!q) return;
      const personName = document.getElementById("token-person-name").value.trim();
      if (!personName) {
        showToast("Person Name is required.", "warning");
        return;
      }
      const payload = {
        person_name: personName,
        phone: document.getElementById("token-phone").value.trim(),
        priority: document.getElementById("token-priority").value,
        notes: document.getElementById("token-notes").value.trim(),
      };
      await issueToken(q.id, payload);
      e.target.reset();
    });

    // Assign Top Token (Header Button)
    document.getElementById("assign-top-header-btn").addEventListener("click", () => {
      const q = getActiveQueue();
      if (q) assignTopToken(q.id);
    });

    // Search / Filter Waiting Queue
    const searchInput = document.getElementById("queue-search-input");
    const clearSearchBtn = document.getElementById("clear-search-btn");
    searchInput.addEventListener("input", () => {
      state.searchQuery = searchInput.value;
      clearSearchBtn.classList.toggle("hidden", !state.searchQuery);
      renderActiveQueueWorkspace();
    });
    clearSearchBtn.addEventListener("click", () => {
      searchInput.value = "";
      state.searchQuery = "";
      clearSearchBtn.classList.add("hidden");
      renderActiveQueueWorkspace();
    });

    // Cancel Token Modal
    document.getElementById("cancel-modal-dismiss").addEventListener("click", closeCancelModal);
    document.getElementById("cancel-modal-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.cancelTarget) return;
      const { queueId, tokenId } = state.cancelTarget;
      const reason = document.getElementById("cancel-reason-input").value.trim();
      closeCancelModal();
      await cancelWaitingToken(queueId, tokenId, reason);
    });

    // Reset Sample Data Modal
    document.getElementById("reset-demo-btn").addEventListener("click", () => {
      document.getElementById("reset-modal").classList.remove("hidden");
    });
    document.getElementById("reset-modal-cancel").addEventListener("click", () => {
      document.getElementById("reset-modal").classList.add("hidden");
    });
    document.getElementById("reset-modal-confirm").addEventListener("click", async () => {
      document.getElementById("reset-modal").classList.add("hidden");
      await clearAllData();
    });

    // Analytics Scope Filter
    document.getElementById("analytics-scope-select").addEventListener("change", (e) => {
      state.analyticsScope = e.target.value;
      renderAnalyticsDashboard();
    });

    // Live wait time refresh every 15s
    setInterval(() => {
      if (state.session && state.activeTab === "operations") {
        renderActiveQueueWorkspace();
      }
    }, 15000);
  }

  async function init() {
    bindEvents();
    const savedAuth = localStorage.getItem(STORAGE_KEYS.AUTH);
    if (savedAuth) {
      try {
        state.session = JSON.parse(savedAuth);
        if (!state.offlineMode) {
          try {
            await apiRequest("/api/auth/me");
          } catch (err) {
            if (err.message !== "OFFLINE_MODE") {
              handleForceLogout();
              return;
            }
          }
        }
        await enterApp();
        return;
      } catch {
        localStorage.removeItem(STORAGE_KEYS.AUTH);
      }
    }
    updateSyncBadge();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

