import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from jose import jwt
from sqlalchemy import select

import sys
import os

# Añadir el directorio backend al path para importaciones
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from app.database import get_db, Base
from app.config import settings
from app.security import get_password_hash
from app import models

# Configuración de base de datos para tests (SQLite en memoria)
SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# --- Overrides ---

async def override_get_db():
    async with AsyncSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

# --- Mocking synchronous query calls in main.py for tests ---
# Since main.py uses db.query() which is synchronous, and we are injecting an AsyncSession,
# we need to either refactor main.py to be async-compatible or mock the query behavior.
# For this task, I will attempt to bridge the gap in conftest.py if possible, 
# but the best approach is to make main.py aware of the session type.
# However, I will try a different approach: Using a synchronous SQLite in-memory DB for tests 
# to match main.py's expectations, but running it within the async test client.

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker as sync_sessionmaker

SYNC_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
sync_engine = create_engine(
    SYNC_SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
)
SyncSessionLocal = sync_sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)

def override_get_db_sync():
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db_sync

# --- Fixtures ---

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=sync_engine)
    
    db = SyncSessionLocal()
    # Roles
    roles = [
        models.Rol(id_rol=1, nombre_rol="Admin"),
        models.Rol(id_rol=2, nombre_rol="Lider"),
        models.Rol(id_rol=3, nombre_rol="Operario")
    ]
    db.add_all(roles)
    
    # Usuarios
    users = [
        models.Usuario(
            id_usuario=1,
            nombre="Admin",
            apellido="GG",
            correo="admin@constructora-gg.com",
            password_hash=get_password_hash("admin123"),
            id_rol_fk=1,
            activo=True
        ),
        models.Usuario(
            id_usuario=2,
            nombre="David",
            apellido="Lider",
            correo="david.lider@constructora-gg.com",
            password_hash=get_password_hash("lider123"),
            id_rol_fk=2,
            activo=True
        ),
        models.Usuario(
            id_usuario=3,
            nombre="Pedro",
            apellido="Operario",
            correo="pedro.operario@constructora-gg.com",
            password_hash=get_password_hash("operario123"),
            id_rol_fk=3,
            activo=True
        )
    ]
    db.add_all(users)
    db.commit()
    db.close()

    yield
    
    Base.metadata.drop_all(bind=sync_engine)

def create_test_token(email: str, role: int):
    data = {"sub": email, "role": role}
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def client_admin():
    token = create_test_token("admin@constructora-gg.com", 1)
    headers = {"Authorization": f"Bearer {token}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as ac:
        yield ac

@pytest.fixture
async def client_lider():
    token = create_test_token("david.lider@constructora-gg.com", 2)
    headers = {"Authorization": f"Bearer {token}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as ac:
        yield ac

@pytest.fixture
async def client_operario():
    token = create_test_token("pedro.operario@constructora-gg.com", 3)
    headers = {"Authorization": f"Bearer {token}"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as ac:
        yield ac
