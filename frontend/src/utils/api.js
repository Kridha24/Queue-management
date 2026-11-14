export const STORAGE_KEYS = {
  AUTH: "queueflow_auth_session_v1",
  ACTIVE_QUEUE_ID: "queueflow_active_queue_v1",
  SETTINGS: "queueflow_settings_v2",
};

export async function apiRequest(path, options = {}, token = null, onUnauthorized = null) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (response.status === 401 && onUnauthorized) {
    onUnauthorized();
    throw new Error("Session expired. Please sign in again.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data && data.detail ? data.detail : `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return data;
}

export function playDispatchChime(enabled = true) {
  if (!enabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch {
    // Ignore audio errors if autoplay blocked
  }
}

export function formatTime(isoString) {
  if (!isoString) return "--";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatMinsAgo(isoString) {
  if (!isoString) return 0;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, (Date.now() - d.getTime()) / 60000);
}

export function getTimeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

