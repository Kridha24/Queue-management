# QueueFlow Pro — Command Center

Production-grade Full-Stack Queue Management Application built with **React (Vite) + Tailwind CSS + Framer Motion + Lucide Icons + Recharts** on the frontend and a **4-layer HLD/LLD FastAPI** backend supporting **PostgreSQL (`DATABASE_URL`)** and **SQLite** (with automatic `/tmp/queueflow.db` fallback on Vercel).

- **Live App (Render)**: https://queueflow-pro-urex.onrender.com
- **Interactive Swagger / OpenAPI Docs**: https://queueflow-pro-urex.onrender.com/docs (local: `http://127.0.0.1:8000/docs`)
- **Demo Credentials**: `manager@queueflow.io` / `manager123` (or click **Instant Demo Login**)

### Stand-Out Differentiators
- **Public TV / Waiting-Room Display Mode**: Distraction-free full-screen board with Now Serving hero, Next 3 upcoming tokens, and live digital clock.
- **Cmd+K / Ctrl+K Command Palette & Keyboard Shortcuts**: `Space` / `Ctrl+Enter` to Assign Top Token (#1), `N` to focus the New Token input, `Esc` to exit modals/TV Mode.
- **CSV Report Export**: Downloadable `.csv` analytics report directly from the Analytics Dashboard.
- **60fps UI Craft**: Framer Motion layout animations on token reordering, live SLA progress bars (`Teal -> Amber -> Rose`), `tabular-nums` wait timers, shimmer skeleton loaders, and dedicated full-page **Settings & Theme Switcher**.

---

## High-Level Design (HLD)

```text
+-------------------------------------------------------------------+
|  React 18 + Vite + Tailwind CSS + Lucide + Recharts (frontend/)   |
|  - Dark-Rail Bento Workspace, Analytics, Dedicated Settings Tab   |
+---------------------------------+---------------------------------+
                                  | HTTPS / Stateless JWT Bearer
                                  v
+-------------------------------------------------------------------+
|  Stateless FastAPI API Tier (backend/main.py)                     |
|  - Security Headers, CORS, Global Exception Handlers, Rate Limit  |
+----------------+--------------------------------+-----------------+
                 |                                |
                 v                                v
+--------------------------------+   +------------------------------+
|  PostgreSQL / SQLite           |   |  Redis (Optional Cache/RL)   |
|  - Composite Index:            |   |  - Auth Rate Limiting        |
|    tokens(queue_id, status,    |   |  - Analytics 15s Cache       |
|           position)            |   |  - In-memory fallback        |
|  - AES-256-GCM PII Encryption  |   +------------------------------+
+--------------------------------+
```

---

## Low-Level Design (LLD) — 4-Layer Backend Architecture

```text
backend/
├── main.py                  # FastAPI entrypoint, CORS, security headers, global exception handlers
├── app.py                   # Compatibility shim re-exporting app & core helpers
├── core/
│   ├── config.py            # Environment settings, DB path, JWT secret, Vercel /tmp detection
│   ├── database.py          # Atomic transaction context manager, schema & composite indexes
│   └── security.py          # PBKDF2 password hashing, stateless HS256 JWT, AES-256-GCM, rate limit
├── schemas/                 # Pydantic request/response DTOs
│   ├── auth.py
│   ├── queue.py
│   └── token.py
├── repositories/            # Pure SQL data-access layer (zero business logic)
│   ├── manager_repo.py
│   ├── queue_repo.py
│   └── token_repo.py
├── services/                # Business logic (strict token state machine, atomic swaps, SLA math)
│   ├── auth_service.py
│   ├── queue_service.py
│   └── analytics_service.py
└── routers/                 # Thin HTTP controllers
    ├── auth_router.py
    ├── queue_router.py
    └── analytics_router.py
```

### Strict Token State Machine
- `WAITING -> IN_SERVICE -> SERVED`
- `WAITING -> CANCELLED`
- Invalid transitions return HTTP `400` with structured JSON (`{ "error": "...", "code": "INVALID_STATE_TRANSITION" }`).

---

## Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health & infrastructure status (DB, Redis, AES-256-GCM, Instance ID) |
| `POST` | `/api/auth/login` | Stateless JWT login (`manager@queueflow.io` / `manager123`) |
| `POST` | `/api/auth/google` | Google OAuth Sign-In verification |
| `GET` | `/api/queues` | List all queues with waiting, in-service, and history tokens |
| `POST` | `/api/queues` | Create a named queue (`name`, `prefix`, `counter_label`, `sla_minutes`) |
| `PATCH` | `/api/queues/{queue_id}` | Update queue settings |
| `POST` | `/api/queues/{queue_id}/tokens` | Issue next sequential token (`OPD-101`, `OPD-102`) |
| `PATCH` | `/api/queues/{queue_id}/tokens/{token_id}/move` | Atomically move token `up` or `down` |
| `POST` | `/api/queues/{queue_id}/assign-top` | Atomically assign `#1` token to service |
| `POST` | `/api/queues/{queue_id}/complete-service` | Mark active token as `SERVED` |
| `DELETE` | `/api/queues/{queue_id}/tokens/{token_id}` | Cancel a waiting token with optional reason |
| `GET` | `/api/analytics` | Zero-division-safe KPIs, hourly trend, SLA comparison, lifecycle |

---

## Local & Deployment Setup

### 1. Run Locally
```bash
# Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000

# Frontend (optional dev server with /api proxy)
cd frontend && npm install && npm run dev
# Build production bundle served by FastAPI
npm run build
```

### 2. Run Automated Tests
```bash
.venv/bin/pytest -v tests/
```

### 3. Deploy (Vercel & Render)
- **Vercel**: `vercel.json` routes all requests to `api/index.py`, and `VERCEL=1` automatically switches SQLite to `/tmp/queueflow.db`.
- **Render**: `render.yaml` deploys the Python web service with managed PostgreSQL (`DATABASE_URL`), Redis (`REDIS_URL`), and auto-generated `AES_ENCRYPTION_KEY`.
