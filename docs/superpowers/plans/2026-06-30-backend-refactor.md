# Backend Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 1719-line monolithic `backend/main.py` into a small, domain-organized `backend/app/` package — without changing any route, payload, status code, or side effect — verified at every step by the existing pytest suite.

**Architecture:** Pure structural refactor (move + import-path edit), zero new abstractions. Each FastAPI domain (auth, usuarios, proyectos, tareas, reportes, notificaciones, materiales, inventario) becomes one `APIRouter` module under `backend/app/routers/`. Cross-cutting auth/JWT/password code becomes `backend/app/security.py`. Settings become `backend/app/config.py`. `models.py`, `schemas.py`, `database.py` relocate unchanged into `backend/app/`. `backend/main.py` survives as a 2-line compatibility shim so `uvicorn main:app` and `Dockerfile.backend` keep working with zero changes.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic — no new dependencies.

## Global Constraints

- **No behavior changes.** Same routes, same paths, same response models, same status codes, same side effects (operario availability, inventory transfer, notifications, soft-delete). This is a move, not a rewrite.
- **No new abstractions (YAGNI/ponytail).** No service layer, no repository pattern, no dependency-injection framework, no base-router class. Functions move as-is; only `import` lines and module boundaries change.
- **No file over ~350 lines** in the resulting structure (current worst case, `proyectos.py`, lands around 300; if any extracted router exceeds it, split is still by sub-resource, not by technical layer).
- **`uvicorn main:app` must keep working unmodified** — `Dockerfile.backend:21` and `CLAUDE.md` run commands are not touched.
- **Verification = run `cd backend && pytest tests/` after every task.** All tests green before moving to the next task. This plan does not add new tests (no behavior is changing); it relies on the existing suite (`test_auth.py`, `test_proyectos.py`, `test_usuarios.py`) as the safety net.
- Database file path (`sqlite:///../database/constructora_gg.db`) and upload dir (`uploads/`) are resolved relative to the process **working directory** (`backend/`), not the importing module's location — confirmed safe to relocate `database.py`/file-writing code into a subpackage.

---

## Target File Structure

```
backend/
  main.py                  # 2-line shim: `from app.main import app` (uvicorn entrypoint, unchanged command)
  seed.py                  # unchanged behavior, imports updated to `from app import models, database`
  app/
    __init__.py
    main.py                # FastAPI() instance, CORS, upload-dir bootstrap, table creation, include_router calls
    config.py               # Settings (BaseSettings) + settings instance
    security.py              # pwd_context, oauth2_scheme, verify_password, get_password_hash,
                              # create_access_token, get_current_user, require_role
    database.py               # moved as-is (engine, SessionLocal, Base, get_db)
    models.py                  # moved as-is
    schemas.py                  # moved as-is
    routers/
      __init__.py
      auth.py               # POST /auth/login, POST /auth/solicitar-recuperacion
      usuarios.py            # /usuarios*
      proyectos.py            # /proyectos* (incl. equipo, traslado-material, finalizar, subir-archivo)
      tareas.py                # /tareas*
      reportes.py               # /reportes*
      notificaciones.py          # /notificaciones*
      materiales.py               # /categorias*, /materiales*
      inventario.py                # /inventario*, PUT /materiales/{id}/stock
      health.py                     # GET /health
  tests/                    # unchanged test logic; only import lines updated
```

**Mapping of every current endpoint to its destination file** (so nothing gets lost):

| Current `main.py` lines | Endpoint(s) | New file |
|---|---|---|
| 102-146 | `POST /auth/login` | `app/routers/auth.py` |
| 148-170 | `POST /auth/solicitar-recuperacion` | `app/routers/auth.py` |
| 172-380 | `/usuarios*` (list, create, operarios-disponibles, me, detalle, update, delete, activar) | `app/routers/usuarios.py` |
| 382-1001 | `/proyectos*` incl. `subir-archivo`, `valida-equipos`, `format_proyecto` helper, `reporte-detallado`, `finalizar`, `finalizar_proyecto_logic` helper, `estado-equipo`, `operarios-libres`, `configurar-equipo`, `desvincular-operario`, `trasladar-material` | `app/routers/proyectos.py` |
| 1002-1097 | `/tareas/mis-tareas*`, `POST /tareas` | `app/routers/tareas.py` |
| 1140-1277 | `GET /proyectos/{id}/tareas`, `PUT /tareas/{id}`, `DELETE /tareas/{id}` | `app/routers/tareas.py` |
| 1278-1437 | `POST /reportes`, `DELETE /reportes/{id}` | `app/routers/reportes.py` |
| 1438-1468 | `GET /reportes` | `app/routers/reportes.py` |
| 1469-1489 | `/notificaciones*` | `app/routers/notificaciones.py` |
| 1490-1628 | `/categorias*`, `/materiales*` (list, create, update categoria, delete) | `app/routers/materiales.py` |
| 1629-1716 | `/inventario/proyecto/{id}`, `GET /inventario`, `PUT /materiales/{id}/stock` | `app/routers/inventario.py` |
| 1717-1719 | `GET /health` | `app/routers/health.py` |
| 21-29 | `Settings` class + `settings` | `app/config.py` |
| 52-100 | `pwd_context`, `oauth2_scheme`, `verify_password`, `get_password_hash`, `create_access_token`, `get_current_user`, `require_role` | `app/security.py` |
| 1-50 (app/CORS/upload-dir/table-creation) | App bootstrap | `app/main.py` |

**Out of scope (explicitly not touched by this plan):**
- `backend/tests/*` logic/assertions (only imports change)
- `Dockerfile.backend`, `docker-compose.yml`, `start.sh`, `stop.sh`, `README.md`
- `frontend/`
- Route paths, request/response schemas, business logic, DB schema

**Flagged for separate decision (not executed automatically):** `backend/test_auth.py`, `backend/test_db.py`, `backend/test_token.py` are ad-hoc manual debug scripts at the backend root (not part of the `pytest` suite, not imported by anything except each other). They duplicate coverage already in `backend/tests/`. Task 11 proposes their removal as a distinct, separately-confirmable step — not bundled into the structural move.

---

### Task 1: Scaffold the `app/` package (no behavior change)

**Files:**
- Create: `backend/app/__init__.py` (empty)
- Create: `backend/app/routers/__init__.py` (empty)

- [ ] Create both empty `__init__.py` files.
- [ ] Run: `cd backend && pytest tests/ -v` — Expected: PASS (unaffected, nothing imports `app/` yet).
- [ ] Commit: `git add backend/app && git commit -m "chore: scaffold backend/app package"`

---

### Task 2: Extract `app/config.py`

**Files:**
- Create: `backend/app/config.py`
- Modify: `backend/main.py` (remove `Settings` class + `settings =` line, lines 21-29; import instead)

**Interfaces:**
- Produces: `settings` (instance of `Settings`), importable as `from app.config import settings`

- [ ] Create `backend/app/config.py`:
```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
```
- [ ] In `backend/main.py`, delete lines 21-29 (the `Settings` class and `settings = Settings()`), and add near the top imports: `from app.config import settings`
- [ ] Run: `cd backend && pytest tests/ -v` — Expected: PASS
- [ ] Commit: `git add backend/app/config.py backend/main.py && git commit -m "refactor: extract Settings into app/config.py"`

---

### Task 3: Extract `app/security.py`

**Files:**
- Create: `backend/app/security.py`
- Modify: `backend/main.py` (remove lines 52-100; import instead)

**Interfaces:**
- Consumes: `settings` from `app.config` (Task 2), `get_db` from `database` (still top-level at this point), `models`, `schemas`
- Produces: `pwd_context`, `oauth2_scheme`, `verify_password(plain, hashed)`, `get_password_hash(password)`, `create_access_token(data: dict)`, `get_current_user(token, db)`, `require_role(allowed_roles: List[int])`

- [ ] Read `backend/main.py:55-100` to copy the exact current bodies (do not paraphrase logic).
- [ ] Create `backend/app/security.py`:
```python
from datetime import datetime, timedelta
from typing import List

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.Usuario).filter(models.Usuario.correo == email).first()
    if user is None:
        raise credentials_exception
    return user


def require_role(allowed_roles: List[int]):
    def role_checker(current_user: models.Usuario = Depends(get_current_user)):
        if current_user.id_rol not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permisos para realizar esta acción",
            )
        return current_user
    return role_checker
```
  **Note:** copy the exact body of `create_access_token`, `get_current_user`, and `require_role` from `backend/main.py:61-101` instead of trusting the snippet above verbatim if there is any discrepancy — the snippet reflects the file as read during planning; re-diff against the live file before pasting.
- [ ] In `backend/main.py`, delete lines 52-100 and replace with:
```python
from app.security import (
    pwd_context,
    oauth2_scheme,
    verify_password,
    get_password_hash,
    create_access_token,
    get_current_user,
    require_role,
)
```
- [ ] Run: `cd backend && pytest tests/ -v` — Expected: PASS
- [ ] Commit: `git add backend/app/security.py backend/main.py && git commit -m "refactor: extract auth/JWT helpers into app/security.py"`

---

### Task 4: Relocate `database.py`, `models.py`, `schemas.py` into `app/`

**Files:**
- Move: `backend/database.py` → `backend/app/database.py`
- Move: `backend/models.py` → `backend/app/models.py`
- Move: `backend/schemas.py` → `backend/app/schemas.py`
- Modify: `backend/main.py`, `backend/app/security.py`, `backend/seed.py`, `backend/tests/conftest.py`, `backend/tests/test_usuarios.py` (import paths)

- [ ] `git mv backend/database.py backend/app/database.py`
- [ ] `git mv backend/models.py backend/app/models.py`
- [ ] `git mv backend/schemas.py backend/app/schemas.py`
- [ ] In `backend/app/security.py`, change `import models`, `import schemas`, `from database import get_db` to `from app import models, schemas` and `from app.database import get_db`.
- [ ] In `backend/main.py`, change `import models`, `import schemas`, `import database`, `from database import engine, get_db` to `from app import models, schemas, database` and `from app.database import engine, get_db`.
- [ ] In `backend/seed.py`, change `import models` / `import database` to `from app import models, database`.
- [ ] In `backend/tests/conftest.py:16-18`, change:
```python
from main import app, get_db, settings, get_password_hash
from database import Base
import models
```
  to:
```python
from main import app
from app.database import get_db, Base
from app.config import settings
from app.security import get_password_hash
from app import models
```
- [ ] In `backend/tests/test_usuarios.py:3`, keep `from main import app` (unaffected — `main.py` still exposes `app`).
- [ ] Run: `cd backend && pytest tests/ -v` — Expected: PASS
- [ ] Commit: `git add -A backend && git commit -m "refactor: relocate database/models/schemas into app package"`

---

### Task 5: Extract `app/routers/auth.py`

**Files:**
- Create: `backend/app/routers/auth.py`
- Modify: `backend/main.py` (remove lines for `POST /auth/login` and `POST /auth/solicitar-recuperacion`; add `app.include_router(auth.router)`)

**Interfaces:**
- Consumes: `get_db` (`app.database`), `verify_password`/`create_access_token` (`app.security`), `models`/`schemas` (`app`)
- Produces: `router = APIRouter(prefix="/auth", tags=["auth"])` mounted at the existing `/auth/*` paths

- [ ] Read `backend/main.py:102-170` to copy the two endpoint bodies verbatim.
- [ ] Create `backend/app/routers/auth.py` with `router = APIRouter(tags=["auth"])` (no prefix — paths already include `/auth/` in the original decorators, e.g. `@app.post("/auth/login")`; replicate as `@router.post("/auth/login")` to keep the exact path) and move both endpoint functions (`login`, `solicitar_recuperacion`) unchanged, importing `get_db`, `verify_password`, `get_password_hash`, `create_access_token`, `models`, `schemas` from their new locations.
- [ ] In `backend/main.py`, delete the moved endpoint code, add `from app.routers import auth` near the top, and add `app.include_router(auth.router)` after the `app = FastAPI(...)` block.
- [ ] Run: `cd backend && pytest tests/test_auth.py -v` — Expected: PASS
- [ ] Run: `cd backend && pytest tests/ -v` — Expected: PASS (full suite)
- [ ] Commit: `git add backend/app/routers/auth.py backend/main.py && git commit -m "refactor: extract auth router"`

---

### Task 6: Extract `app/routers/usuarios.py`

**Files:**
- Create: `backend/app/routers/usuarios.py`
- Modify: `backend/main.py`

- [ ] Read `backend/main.py:172-380` to copy all `/usuarios*` endpoint bodies verbatim (list, create, operarios-disponibles, me, detalle por id, update, delete, activar).
- [ ] Create `backend/app/routers/usuarios.py` with `router = APIRouter(tags=["usuarios"])`, decorators kept exactly as in the source (e.g. `@router.get("/usuarios", ...)`), importing `get_db`, `get_current_user`, `require_role`, `get_password_hash`, `models`, `schemas` from their new locations.
- [ ] In `backend/main.py`, delete the moved code, add `from app.routers import usuarios`, add `app.include_router(usuarios.router)`.
- [ ] Run: `cd backend && pytest tests/test_usuarios.py -v` — Expected: PASS
- [ ] Run: `cd backend && pytest tests/ -v` — Expected: PASS
- [ ] Commit: `git add backend/app/routers/usuarios.py backend/main.py && git commit -m "refactor: extract usuarios router"`

---

### Task 7: Extract `app/routers/proyectos.py`

**Files:**
- Create: `backend/app/routers/proyectos.py`
- Modify: `backend/main.py`

- [ ] Read `backend/main.py:382-1001` to copy verbatim: `subir-archivo`, `get_proyectos`, `valida-equipos`, the `format_proyecto` helper function, `create_proyecto`, `update_proyecto`, `get_proyecto`, `reporte-detallado`, `delete_proyecto`, the `finalizar_proyecto_logic` helper, `finalizar` endpoint, `estado-equipo`, `operarios-libres`, `configurar-equipo`, `desvincular-operario`, `trasladar-material`.
- [ ] Create `backend/app/routers/proyectos.py` with `router = APIRouter(tags=["proyectos"])`, all decorators and helper functions preserved exactly, importing `shutil`, `os`, `func` (sqlalchemy), `joinedload`, `get_db`, `get_current_user`, `require_role`, `models`, `schemas` from their new locations. Keep `format_proyecto` and `finalizar_proyecto_logic` as plain module-level functions in this file (they are only used by endpoints in this same file).
- [ ] In `backend/main.py`, delete the moved code, add `from app.routers import proyectos`, add `app.include_router(proyectos.router)`.
- [ ] Run: `cd backend && pytest tests/test_proyectos.py -v` — Expected: PASS
- [ ] Run: `cd backend && pytest tests/ -v` — Expected: PASS
- [ ] Commit: `git add backend/app/routers/proyectos.py backend/main.py && git commit -m "refactor: extract proyectos router"`

---

### Task 8: Extract `app/routers/tareas.py` and `app/routers/reportes.py`

**Files:**
- Create: `backend/app/routers/tareas.py`
- Create: `backend/app/routers/reportes.py`
- Modify: `backend/main.py`

- [ ] Read `backend/main.py:1002-1277` (mis-tareas, mis-tareas detail, create_tarea, get_tareas_detalladas_proyecto, update_tarea, delete_tarea) and copy verbatim into `backend/app/routers/tareas.py` with `router = APIRouter(tags=["tareas"])`.
- [ ] Read `backend/main.py:1278-1468` (create_reporte, delete_reporte, list_reportes) and copy verbatim into `backend/app/routers/reportes.py` with `router = APIRouter(tags=["reportes"])`. `create_reporte` touches `InventarioProyecto` stock and `Tarea.avance`/state — copy this logic unchanged, do not "clean it up" in this pass.
- [ ] In `backend/main.py`, delete the moved code, add `from app.routers import tareas, reportes`, add `app.include_router(tareas.router)` and `app.include_router(reportes.router)`.
- [ ] Run: `cd backend && pytest tests/ -v` — Expected: PASS
- [ ] Commit: `git add backend/app/routers/tareas.py backend/app/routers/reportes.py backend/main.py && git commit -m "refactor: extract tareas and reportes routers"`

---

### Task 9: Extract `app/routers/notificaciones.py`, `materiales.py`, `inventario.py`, `health.py`

**Files:**
- Create: `backend/app/routers/notificaciones.py`
- Create: `backend/app/routers/materiales.py`
- Create: `backend/app/routers/inventario.py`
- Create: `backend/app/routers/health.py`
- Modify: `backend/main.py`

- [ ] Read `backend/main.py:1469-1489` → copy into `backend/app/routers/notificaciones.py`, `router = APIRouter(tags=["notificaciones"])`.
- [ ] Read `backend/main.py:1490-1628` → copy `/categorias*` and `/materiales*` (list, create, update categoria, delete) into `backend/app/routers/materiales.py`, `router = APIRouter(tags=["materiales"])`.
- [ ] Read `backend/main.py:1629-1716` → copy `/inventario/proyecto/{id}`, `GET /inventario`, `PUT /materiales/{id}/stock` into `backend/app/routers/inventario.py`, `router = APIRouter(tags=["inventario"])`. Note `PUT /materiales/{id}/stock` keeps its existing path even though it lives in the inventory router — do not change the route path.
- [ ] Read `backend/main.py:1717-1719` → copy `GET /health` into `backend/app/routers/health.py`, `router = APIRouter(tags=["health"])`.
- [ ] In `backend/main.py`, delete all moved code, add the four imports, add the four `app.include_router(...)` calls.
- [ ] Run: `cd backend && pytest tests/ -v` — Expected: PASS
- [ ] Commit: `git add backend/app/routers/notificaciones.py backend/app/routers/materiales.py backend/app/routers/inventario.py backend/app/routers/health.py backend/main.py && git commit -m "refactor: extract notificaciones, materiales, inventario, health routers"`

---

### Task 10: Slim `app/main.py` and turn `backend/main.py` into a compatibility shim

**Files:**
- Create: `backend/app/main.py`
- Modify: `backend/main.py` (final form)

By this point `backend/main.py` should only contain: imports, the `app = FastAPI(...)` block, CORS middleware, upload-dir bootstrap, `models.Base.metadata.create_all(...)`, the `app.include_router(...)` calls, and the leftover `from app.security import (...)` re-import (now unused by `main.py` itself but still needed because `tests/conftest.py` may reference `from main import app`). Move that body into `app/main.py` and reduce `backend/main.py` to a shim.

- [ ] Create `backend/app/main.py`:
```python
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.database import engine
from app.routers import (
    auth,
    usuarios,
    proyectos,
    tareas,
    reportes,
    notificaciones,
    materiales,
    inventario,
    health,
)

app = FastAPI(title="Constructora GG - API Python")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

models.Base.metadata.create_all(bind=engine)

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(proyectos.router)
app.include_router(tareas.router)
app.include_router(reportes.router)
app.include_router(notificaciones.router)
app.include_router(materiales.router)
app.include_router(inventario.router)
app.include_router(health.router)
```
- [ ] Replace the entire contents of `backend/main.py` with:
```python
from app.main import app
```
- [ ] In `backend/tests/conftest.py`, change `from main import app` (already updated in Task 4) — verify it still resolves correctly against the new `app.main` indirection; no change needed since `main.py` still exposes `app`.
- [ ] Run: `cd backend && pytest tests/ -v` — Expected: PASS (full suite, all files)
- [ ] Run: `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 &` then `curl -s http://localhost:8000/health` — Expected: same response as before the refactor; then stop the server (`kill %1`).
- [ ] Commit: `git add backend/app/main.py backend/main.py && git commit -m "refactor: slim main.py to app bootstrap, keep main.py as uvicorn shim"`

---

### Task 11 (optional, confirm before doing): Remove stray debug scripts

**Files:**
- Delete: `backend/test_auth.py`
- Delete: `backend/test_db.py`
- Delete: `backend/test_token.py`

These three files at `backend/` root are manual `if __name__ == "__main__":` debug scripts (print-based, not asserts, not collected by `pytest.ini`/`tests/`). They reference the pre-refactor `import main` / `import models` / `import database` paths and will break after Task 4 unless updated — and they add no coverage beyond `backend/tests/`.

- [ ] Confirm with the user before deleting (this plan flags it; it does not assume consent).
- [ ] `git rm backend/test_auth.py backend/test_db.py backend/test_token.py`
- [ ] Run: `cd backend && pytest tests/ -v` — Expected: PASS (unaffected, these were never part of the suite)
- [ ] Commit: `git commit -m "chore: remove unused manual debug scripts superseded by tests/"`

---

### Task 12: Final verification pass

- [ ] Run: `cd backend && pytest tests/ -v` — Expected: full PASS, same test count as the pre-refactor baseline captured in Task 0's note below.
- [ ] Run: `cd backend && python -c "import main; print(main.app.routes.__len__())"` and compare the printed route count against the pre-refactor count (capture this number before Task 1 starts, e.g. `cd backend && python -c "import main; print(len(main.app.routes))"` on the original `main.py`).
- [ ] Start the server (`cd backend && uvicorn main:app --reload`) and the frontend (`cd frontend && python3 -m http.server 8080`), log in through the UI, and exercise one read endpoint per router (proyectos list, usuarios list, materiales list, inventario list) to confirm the live app behaves identically.
- [ ] Update `CLAUDE.md`'s "Backend (`backend/`)" section to describe the new `app/` package layout instead of "Single-file FastAPI app."
- [ ] Final commit: `git add CLAUDE.md && git commit -m "docs: update CLAUDE.md for backend/app package layout"`

---

## Progress Checklist (top-level)

- [ ] Task 1 — Scaffold `app/` package
- [ ] Task 2 — Extract `app/config.py`
- [ ] Task 3 — Extract `app/security.py`
- [ ] Task 4 — Relocate `database.py`, `models.py`, `schemas.py`
- [ ] Task 5 — Extract `app/routers/auth.py`
- [ ] Task 6 — Extract `app/routers/usuarios.py`
- [ ] Task 7 — Extract `app/routers/proyectos.py`
- [ ] Task 8 — Extract `app/routers/tareas.py` + `reportes.py`
- [ ] Task 9 — Extract `notificaciones.py`, `materiales.py`, `inventario.py`, `health.py`
- [ ] Task 10 — Slim `app/main.py`, shim `backend/main.py`
- [ ] Task 11 — Remove stray debug scripts (optional, needs confirmation)
- [ ] Task 12 — Final verification + docs update
