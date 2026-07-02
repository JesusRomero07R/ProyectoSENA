from fastapi import APIRouter

router = APIRouter(tags=["health"])


# --- Ruta de Salud ---
@router.get("/health")
def health_check():
    return {"status": "ok", "engine": "FastAPI + SQLAlchemy (SQLite)"}
