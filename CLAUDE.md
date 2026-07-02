# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Setup
```bash
# From repo root, with venv active
pip install -r requirements.txt

# Create backend/.env
echo "SECRET_KEY=super_secret_key_constructora_gg_2026
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60" > backend/.env

# Seed database (creates backend/database/constructora_gg.db)
cd backend && python seed.py
```

### Run
```bash
# Terminal 1 — API (from repo root, venv active)
cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend
cd frontend && python3 -m http.server 8080
# Open http://localhost:8080
```

### Tests
```bash
# From backend/ directory
cd backend && pytest tests/

# Single test file
cd backend && pytest tests/test_auth.py

# Single test
cd backend && pytest tests/test_auth.py::test_login_success
```

API docs auto-generated at `http://localhost:8000/docs`.

## Architecture

### Backend (`backend/`)
FastAPI app organized as a package under `backend/app/`. `backend/main.py` is a 1-line compatibility shim (`from app.main import app`) so `uvicorn main:app` keeps working unchanged.

- `app/main.py` — FastAPI app instance, CORS middleware, table creation, router registration
- `app/config.py` — `Settings` (env-driven config) and the `settings` instance
- `app/security.py` — password hashing, JWT creation/decoding, `get_current_user`, `require_role`
- `app/database.py` — SQLite engine config; DB file at `backend/database/constructora_gg.db`
- `app/models.py` — SQLAlchemy ORM models
- `app/schemas.py` — Pydantic request/response schemas
- `app/routers/` — one router module per domain: `auth.py`, `usuarios.py`, `proyectos.py`, `tareas.py`, `reportes.py`, `notificaciones.py`, `materiales.py`, `inventario.py`, `health.py`
- `seed.py` — Creates tables and inserts default roles, admin user, and sample data

**Auth pattern**: `require_role([1, 2, 3])` FastAPI dependency enforces RBAC per endpoint. Roles: 1=Admin, 2=Lider, 3=Operario. JWT payload carries `sub` (email) and `role` (int). Login accepts bare username — `@constructora-gg.com` is appended if no `@` is present.

**Inventory model**: Two-tier. `InventarioGlobal` is the warehouse; `InventarioProyecto` is per-project stock. Materials are transferred from global → project via `POST /proyectos/trasladar-material`. When a project finalizes, remaining project stock returns automatically to global.

**Key side-effects**:
- Assigning an operario to a project sets `disponibilidad = "ocupado"`.
- Finalizing a project sets all team members back to `disponible` and returns project inventory to global.
- Deleting a user performs a soft-delete (`activo = False`) and unlinks them from all projects/tasks.
- Reporting progress (`POST /reportes`) automatically deducts material stock from `InventarioProyecto` and updates `Tarea.avance`. Hitting 100% sets the task state to `"finalizada"`.

### Frontend (`frontend/`)
Vanilla JS, no build step. `app.js` is the master script loaded by every page — it handles auth tokens, role-based DOM visibility (`.role-admin`, `.role-lider`, `.role-operario` CSS classes), and API communication.

- `index.html` — login page
- `dashboard.html` — main dashboard (loaded after login)
- `pages/` — one HTML file per feature (proyectos, tareas, inventario, usuarios, etc.)
- `shared/` — static pages (password recovery, about, terms)
- `styles.css` — global styles using CSS custom properties and grid

API base URL is hardcoded to `http://localhost:8000` in `app.js:6`.

### Tests (`backend/tests/`)
Uses `pytest-asyncio` + `httpx.AsyncClient` with ASGI transport. `conftest.py` overrides `get_db` with an in-memory synchronous SQLite session and pre-seeds roles and three users. Fixtures `client_admin`, `client_lider`, and `client_operario` inject pre-built JWT tokens — no real login required in tests.

### Database schema summary
Key many-to-many tables: `proyectos_usuarios` (project ↔ operarios), `tareas_operarios` (task ↔ operarios). `ReporteMaterial` links progress reports to consumed materials. `Notificacion` stores admin alerts for stock shortages and password-reset requests.
