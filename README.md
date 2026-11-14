# QueueFlow Pro — Full-Stack Queue Management & Analytics

QueueFlow Pro is a production-ready full-stack queue management web application built with **Python FastAPI**, **SQLite**, **Tailwind CSS**, and **Chart.js**. It supports multi-queue operations, automatic sequential token generation, live queue reordering, one-click service dispatch, in-page cancellation workflows, and real-time SLA analytics.

## Features

1. **Queue Manager Authentication**: Email/password login with PBKDF2-hashed credentials, session persistence, one-click **Instant Demo Login** (`manager@queueflow.io` / `manager123`), and logout.
2. **Named Queue Creation & Management**: Create and edit multiple queues with custom Name, Token Prefix (e.g., `OPD`, `PHM`, `LAB`), Service Counter label, and Target SLA (mins/token).
3. **Automatic Token Issuance**: Issue tokens with Person Name, optional Phone/Contact, Priority (`Standard`, `Priority`, `Follow-up`), and Service Notes. Generates sequential codes (`OPD-101`, `OPD-102`, ...) with arrival timestamps.
4. **Live Waiting Queue & Service Banner**: Ordered waiting list (`#1`, `#2`, `#3`...) with live wait duration, estimated time to service, search/filter box, a **Currently In Service** banner, and a **Recent Service & Cancellation History** log.
5. **Queue Reordering**: Swap waiting tokens **↑ Up** and **↓ Down** with boundary guards at `#1` and the last position.
6. **One-Click Service Dispatch**: **Assign Top Token for Service** transitions `#1` to `IN_SERVICE`, records actual wait duration, marks any previously active token as `SERVED`, and advances remaining positions. Includes **Mark Service Complete**.
7. **In-Page Token Cancellation**: Clean confirmation modal with optional cancellation reason, logging cancelled tokens in history and re-indexing remaining positions.
8. **Analytics Dashboard**: Queue scope filter (`All Queues Combined` or per-queue), 4 KPI cards (Mean Wait Time, Active Queue Depth, Service Throughput, Cancellation Rate), 3 responsive Chart.js visualizations (Hourly Trend, Avg Wait vs. Target SLA, Token Lifecycle Breakdown), and a Per-Queue Operational Breakdown table.
9. **Offline / Standalone Resilience**: Syncs with the FastAPI + SQLite backend when running on a server and gracefully falls back to `localStorage` if `frontend/index.html` is opened directly.

## Project Structure

```text
.
├── backend/
│   ├── app.py               # FastAPI application, SQLite schema, demo seed & REST API
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── index.html           # Responsive UI (Tailwind CSS + Chart.js)
│   └── app.js               # Frontend state, API client, localStorage fallback & charts
├── tests/
│   └── test_e2e.py          # Automated end-to-end pytest suite
├── .gitignore
└── README.md
```

## Quick Start

### 1. Create a Virtual Environment & Install Dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. Run the Application

```bash
uvicorn backend.app:app --reload --port 8000
```

Open **[http://localhost:8000](http://localhost:8000)** in your browser and click **Instant Demo Login** (or sign in with `manager@queueflow.io` / `manager123`).

### 3. Run Automated Tests

```bash
pytest -v tests/test_e2e.py
```

## REST API Reference

All endpoints except `/api/health`, `/api/auth/login`, `/`, and `/app.js` require a `Bearer <token>` header returned by `/api/auth/login`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate manager and issue session token |
| `POST` | `/api/auth/logout` | Invalidate current session token |
| `GET` | `/api/auth/me` | Get authenticated manager profile |
| `GET` | `/api/queues` | List all queues with waiting, in-service, and history tokens |
| `POST` | `/api/queues` | Create a new service queue |
| `PATCH` | `/api/queues/{queue_id}` | Update queue settings (name, prefix, counter, SLA) |
| `POST` | `/api/queues/{queue_id}/tokens` | Issue a new sequential waiting token |
| `PATCH` | `/api/queues/{queue_id}/tokens/{token_id}/move` | Move a waiting token `up` or `down` |
| `POST` | `/api/queues/{queue_id}/assign-top` | Assign `#1` waiting token to `IN_SERVICE` |
| `POST` | `/api/queues/{queue_id}/complete-service` | Mark active `IN_SERVICE` token as `SERVED` |
| `DELETE` | `/api/queues/{queue_id}/tokens/{token_id}` | Cancel a waiting token with optional reason |
| `GET` | `/api/analytics?queue_id=all` | Compute KPIs, hourly trends, SLA comparison & breakdown |
| `POST` | `/api/reset-demo` | Restore default 3 sample queues and demo tokens |
