from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Importaciones locales
from app import models
from app.database import engine
from app.routers import auth, usuarios, proyectos, tareas, reportes, notificaciones, materiales, inventario, health

app = FastAPI(title="Constructora GG - API Python")

app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(proyectos.router)
app.include_router(tareas.router)
app.include_router(reportes.router)
app.include_router(notificaciones.router)
app.include_router(materiales.router)
app.include_router(inventario.router)
app.include_router(health.router)

# --- Configuración de CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

import os
import shutil
from datetime import datetime
from fastapi import UploadFile, File
from fastapi.staticfiles import StaticFiles

# Crear tablas en SQLite automáticamente al iniciar
models.Base.metadata.create_all(bind=engine)

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    file_name = f"img_{int(datetime.now().timestamp())}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    # Devolver URL relativa que luego consumirá el frontend
    return {"url": f"/uploads/{file_name}"}
