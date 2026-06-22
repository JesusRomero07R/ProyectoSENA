from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from pydantic_settings import BaseSettings
import os
import shutil

# Importaciones locales
import models
import schemas
import database
from database import engine, get_db

# --- Configuración desde .env ---
class Settings(BaseSettings):
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    class Config:
        env_file = ".env"

settings = Settings()

app = FastAPI(title="Constructora GG - API Python")

# --- Configuración de CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Asegurar carpeta de uploads
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

# Crear tablas en SQLite automáticamente al iniciar
models.Base.metadata.create_all(bind=engine)

# --- Seguridad ---
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

# --- Dependencias de Seguridad ---
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar el token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        role_id: int = payload.get("role")
        if email is None or role_id is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email, role=role_id)
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.Usuario).filter(models.Usuario.correo == token_data.email, models.Usuario.activo == True).first()
    if user is None:
        raise credentials_exception
    return user

def require_role(allowed_roles: List[int]):
    """Middleware de roles: 1=Admin, 2=Lider, 3=Operario"""
    async def role_checker(current_user: models.Usuario = Depends(get_current_user)):
        if current_user.id_rol_fk not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos suficientes"
            )
        return current_user
    return role_checker

# --- Rutas de Autenticación ---

@app.post("/auth/login", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    try:
        # Manejar login con solo el nombre de usuario (sin el dominio @constructora-gg.com)
        email = form_data.username.lower()
        if "@" not in email:
            email = f"{email}@constructora-gg.com"

        # 1. Buscar usuario por correo (insensible a mayúsculas) y que esté activo
        user = db.query(models.Usuario).filter(
            models.Usuario.correo == email,
            models.Usuario.activo == True
        ).first()
        
        # 2. Validar existencia del usuario
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Correo no registrado o cuenta desactivada"
            )
        
        # DEBUG - Información recibida
        print(f'DEBUG - Login attempt for: {form_data.username}')

        # 3. Validar contraseña
        is_valid = False
        try:
            is_valid = verify_password(form_data.password, user.password_hash)
        except Exception as ve:
            print(f"DEBUG - Password verification error: {ve}")
            raise HTTPException(status_code=500, detail="Error en la verificación de credenciales")

        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Contraseña incorrecta"
            )
        
        access_token = create_access_token(data={"sub": user.correo, "role": user.id_rol_fk})
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG - Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/solicitar-recuperacion")
async def solicitar_recuperacion(request: schemas.PasswordRecoveryRequest, db: Session = Depends(get_db)):
    email = request.username.lower()
    if "@" not in email:
        email = f"{email}@constructora-gg.com"
    
    user = db.query(models.Usuario).filter(models.Usuario.correo == email, models.Usuario.activo == True).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado o inactivo")

    # Crear notificación para el admin
    notif = models.Notificacion(
        titulo="Solicitud de Recuperación",
        mensaje=f"El usuario {user.nombre} ({user.correo}) solicita cambio de contraseña.",
        tipo="password_reset"
    )
    db.add(notif)
    db.commit()
    
    return {"message": "Solicitud enviada al administrador"}

# --- Rutas de Usuarios (CRUD Admin) ---

@app.get("/usuarios", response_model=List[schemas.Usuario])
async def list_usuarios(
    id_rol_fk: Optional[int] = None,
    disponibilidad: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    query = db.query(models.Usuario)
    if id_rol_fk is not None:
        query = query.filter(models.Usuario.id_rol_fk == id_rol_fk)
    if disponibilidad:
        # Filtro por cadena exacta para asegurar consistencia
        query = query.filter(models.Usuario.disponibilidad == disponibilidad)
    return query.all()

@app.post("/usuarios", response_model=schemas.Usuario)
async def create_usuario(
    usuario: schemas.UsuarioCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    # Verificar si el correo ya existe
    db_user = db.query(models.Usuario).filter(models.Usuario.correo == usuario.correo).first()
    if db_user:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    # Hashear contraseña y crear usuario
    hashed_password = get_password_hash(usuario.password)
    user_data = usuario.dict(exclude={"password"})
    db_usuario = models.Usuario(**user_data, password_hash=hashed_password)
    
    db.add(db_usuario)
    db.commit()
    db.refresh(db_usuario)
    return db_usuario

@app.get("/usuarios/operarios-disponibles", response_model=List[schemas.Usuario])
async def get_operarios_disponibles(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    """
    Obtiene todos los operarios (Rol 3) que están activos y NO están 
    vinculados a ningún proyecto que tenga el estado 'activo'.
    """
    # Subconsulta: IDs de usuarios en proyectos activos
    ocupados_subquery = db.query(models.proyectos_usuarios.c.id_usuario).join(
        models.Proyecto, models.proyectos_usuarios.c.id_proyecto == models.Proyecto.id_proyecto
    ).filter(models.Proyecto.estado == "activo").subquery()

    disponibles = db.query(models.Usuario).filter(
        models.Usuario.id_rol_fk == 3,
        models.Usuario.activo == True,
        ~models.Usuario.id_usuario.in_(ocupados_subquery)
    ).all()
    
    return disponibles

@app.get("/usuarios/me", response_model=schemas.UsuarioDetallado)
async def get_my_user_detalle(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2, 3]))
):
    """
    Permite a cualquier usuario obtener su propio perfil y estadísticas.
    """
    return await get_usuario_detalle(id_usuario=current_user.id_usuario, db=db, current_user=current_user)

@app.get("/usuarios/{id_usuario}", response_model=schemas.UsuarioDetallado)
async def get_usuario_detalle(
    id_usuario: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2, 3]))
):
    # 1. Buscar el usuario
    db_usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario).first()
    if not db_usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    tareas_totales = 0
    tareas_completadas = 0
    proyectos_activos = 0
    rendimiento = 0.0

    if db_usuario.id_rol_fk == 1: # ADMIN: Estadísticas Globales
        tareas_totales = db.query(models.Usuario).filter(models.Usuario.activo == True).count() # Total usuarios
        tareas_completadas = db.query(models.Proyecto).filter(models.Proyecto.estado == "finalizado").count() # Proyectos finalizados
        proyectos_activos = db.query(models.Proyecto).filter(models.Proyecto.estado == "activo").count() # Proyectos activos
        
        # Rendimiento Global (Avance promedio de proyectos activos)
        avg_avance = db.query(func.avg(models.Tarea.avance)).join(models.Proyecto).filter(models.Proyecto.estado == "activo").scalar()
        rendimiento = float(avg_avance) if avg_avance else 0.0

    elif db_usuario.id_rol_fk == 2: # LIDER: Sus Proyectos y Tareas
        proyectos = db.query(models.Proyecto).filter(models.Proyecto.id_lider_fk == id_usuario).all()
        proyectos_activos = len([p for p in proyectos if p.estado == "activo"])
        
        id_proyectos = [p.id_proyecto for p in proyectos]
        tareas = db.query(models.Tarea).filter(models.Tarea.id_proyecto_fk.in_(id_proyectos)).all() if id_proyectos else []
        
        tareas_totales = len(tareas)
        tareas_completadas = len([t for t in tareas if t.estado == "finalizada"])
        
        if tareas:
            rendimiento = sum(t.avance for t in tareas) / len(tareas)
        
    else: # OPERARIO: Sus asignaciones personales
        tareas_asignadas = db.query(models.Tarea).join(models.Tarea.operarios).filter(
            models.Usuario.id_usuario == id_usuario
        ).all()
        tareas_totales = len(tareas_asignadas)
        tareas_completadas = len([t for t in tareas_asignadas if t.estado == "finalizada"])
        
        proyectos_asignados = db.query(models.Proyecto).join(models.Proyecto.operarios).filter(
            models.Usuario.id_usuario == id_usuario,
            models.Proyecto.estado == "activo"
        ).count()
        proyectos_activos = proyectos_asignados
        
        rendimiento = (tareas_completadas / tareas_totales * 100) if tareas_totales > 0 else 0.0

    # 5. Mapeo al esquema
    user_data = {c.name: getattr(db_usuario, c.name) for c in db_usuario.__table__.columns}
    user_data.update({
        "tareas_totales": tareas_totales,
        "tareas_completadas": tareas_completadas,
        "proyectos_activos": proyectos_activos,
        "rendimiento": round(rendimiento, 1)
    })

    return user_data

@app.put("/usuarios/{id_usuario}", response_model=schemas.Usuario)
async def update_usuario(
    id_usuario: int,
    usuario_update: schemas.UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2, 3]))
):
    db_usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario).first()
    if not db_usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Seguridad: Solo Admin o el propio usuario
    if current_user.id_rol_fk != 1 and current_user.id_usuario != id_usuario:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar este usuario")

    update_data = usuario_update.dict(exclude_unset=True)
    
    # Restricciones para no-admins: no pueden cambiar rol, estado, disponibilidad o activo
    if current_user.id_rol_fk != 1:
        for restricted in ["id_rol_fk", "estado", "disponibilidad", "activo"]:
            if restricted in update_data:
                del update_data[restricted]

    # Manejar actualización de contraseña
    if "password" in update_data:
        db_usuario.password_hash = pwd_context.hash(update_data["password"])
        del update_data["password"]

    for key, value in update_data.items():
        setattr(db_usuario, key, value)
    
    db.commit()
    db.refresh(db_usuario)
    return db_usuario

@app.delete("/usuarios/{id_usuario}")
async def delete_usuario(
    id_usuario: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    db_usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario).first()
    if not db_usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # 1. Borrado lógico
    db_usuario.activo = False
    db_usuario.disponibilidad = "disponible"

    # 2. Desvincular de Proyectos (Tabla proyectos_usuarios)
    db.execute(
        models.proyectos_usuarios.delete().where(models.proyectos_usuarios.c.id_usuario == id_usuario)
    )

    # 3. Desvincular de Tareas (Tabla tareas_operarios)
    db.execute(
        models.tareas_operarios.delete().where(models.tareas_operarios.c.id_usuario == id_usuario)
    )

    db.commit()
    return {"message": f"Usuario {id_usuario} desactivado y desvinculado de proyectos/tareas correctamente"}

@app.patch("/usuarios/{id_usuario}/activar")
async def activar_usuario(
    id_usuario: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    db_usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario).first()
    if not db_usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    db_usuario.activo = True
    db.commit()
    return {"message": f"Usuario {id_usuario} reactivado correctamente"}

# --- Rutas de Proyectos ---

@app.post("/proyectos/{id_proyecto}/subir-archivo")
async def upload_archivo_proyecto(
    id_proyecto: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    # Generar ruta única
    file_name = f"proj_{id_proyecto}_{datetime.now().timestamp()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Registrar en base de datos
    db_archivo = models.ArchivoProyecto(
        id_proyecto_fk=id_proyecto,
        id_usuario_fk=current_user.id_usuario,
        nombre_original=file.filename,
        nombre_archivo=file_name,
        tipo_mime=file.content_type,
        ruta_url=file_path,
        tamanio_bytes=os.path.getsize(file_path)
    )
    db.add(db_archivo)
    db.commit()
    
    return {"message": "Archivo subido exitosamente", "path": file_path}

@app.get("/proyectos", response_model=List[schemas.Proyecto])
async def get_proyectos(
    estado: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(require_role([1, 2, 3]))
):
    query = db.query(models.Proyecto)
    
    if current_user.id_rol_fk == 2:
        query = query.filter(models.Proyecto.id_lider_fk == current_user.id_usuario)
    elif current_user.id_rol_fk == 3:
        # El operario solo ve proyectos donde está asignado en la tabla intermedia
        query = query.join(models.Proyecto.operarios).filter(models.Usuario.id_usuario == current_user.id_usuario)

    if estado:
        query = query.filter(models.Proyecto.estado == estado)
    
    proyectos = query.all()

    # Mapear a respuesta con avance_general calculado
    resultado = []
    for p in proyectos:
        tareas = db.query(models.Tarea).filter(models.Tarea.id_proyecto_fk == p.id_proyecto).all()
        avance = 0.0
        if tareas:
            total = sum(t.avance for t in tareas)
            avance = round(total / len(tareas), 1)
        
        # Convertir a dict y añadir avance
        p_dict = {c.name: getattr(p, c.name) for c in p.__table__.columns}
        p_dict["avance_general"] = avance
        p_dict["lider"] = p.lider # SQLAlchemy manejará la relación
        p_dict["id_operarios"] = [o.id_usuario for o in p.operarios]
        resultado.append(p_dict)

    return resultado

@app.get("/proyectos/valida-equipos", response_model=List[schemas.ProyectoEquipoDetalle])
async def get_valida_equipos(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    # Consulta eficiente con joinedload para traer líder y operarios de una vez
    proyectos = db.query(models.Proyecto).options(
        joinedload(models.Proyecto.lider),
        joinedload(models.Proyecto.operarios)
    ).filter(models.Proyecto.estado == "activo").all()

    resultado = []
    for p in proyectos:
        resultado.append({
            "id_proyecto": p.id_proyecto,
            "nombre_proyecto": p.nombre,
            "nombre_lider": f"{p.lider.nombre} {p.lider.apellido}" if p.lider else "Sin líder",
            "operarios_nombres": [f"{o.nombre} {o.apellido}" for o in p.operarios]
        })

    return resultado

def format_proyecto(p: models.Proyecto, db: Session):
    # Calcular avance_general
    tareas = db.query(models.Tarea).filter(models.Tarea.id_proyecto_fk == p.id_proyecto).all()
    avance = 0.0
    if tareas:
        total = sum(t.avance for t in tareas)
        avance = round(total / len(tareas), 1)

    # Mapear a dict compatible con schemas.Proyecto
    return {
        "id_proyecto": p.id_proyecto,
        "nombre": p.nombre,
        "descripcion": p.descripcion,
        "ciudad": p.ciudad,
        "direccion": p.direccion,
        "presupuesto": float(p.presupuesto),
        "fecha_inicio": p.fecha_inicio,
        "fecha_fin": p.fecha_fin,
        "estado": p.estado,
        "id_lider_fk": p.id_lider_fk,
        "avance_general": avance,
        "lider": p.lider,
        "id_operarios": [o.id_usuario for o in p.operarios]
    }

@app.post("/proyectos", response_model=schemas.Proyecto)
async def create_proyecto(
    proyecto: schemas.ProyectoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    # 1. Verificar que el id_lider_fk exista
    lider = db.query(models.Usuario).filter(models.Usuario.id_usuario == proyecto.id_lider_fk).first()
    if not lider:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error: El líder con ID {proyecto.id_lider_fk} no existe en el sistema."
        )

    # 2. Verificar que el usuario asignado como líder tenga el rol adecuado
    if lider.id_rol_fk not in [1, 2]: # Admin o Lider
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El usuario {lider.nombre} no tiene permisos para ser líder de proyecto."
        )

    try:
        db_proyecto = models.Proyecto(**proyecto.dict())
        db.add(db_proyecto)
        db.commit()
        db.refresh(db_proyecto)
        return format_proyecto(db_proyecto, db)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear el proyecto: {str(e)}"
        )

@app.put("/proyectos/{id_proyecto}", response_model=schemas.Proyecto)
async def update_proyecto(
    id_proyecto: int,
    proyecto_update: schemas.ProyectoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    db_proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not db_proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    # REGLA DE SEGURIDAD: Si es Líder, solo puede editar su propio proyecto
    if current_user.id_rol_fk == 2 and db_proyecto.id_lider_fk != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar este proyecto")

    # Si se está marcando como FINALIZADO, ejecutamos la lógica especial
    # Pero ahora nos aseguramos de que devuelva el objeto formateado correcto
    if proyecto_update.estado == "finalizado" and db_proyecto.estado != "finalizado":
        await finalizar_proyecto_logic(id_proyecto=id_proyecto, db=db, current_user=current_user)
        db.refresh(db_proyecto)
        return format_proyecto(db_proyecto, db)

    # Si se está marcando como ACTIVO (reactivación) y antes estaba FINALIZADO
    if proyecto_update.estado == "activo" and db_proyecto.estado == "finalizado":
        # Desvincular operarios del proyecto y de sus tareas para que permanezcan disponibles
        for operario in db_proyecto.operarios:
            operario.disponibilidad = "disponible"
        db_proyecto.operarios = []
        
        tareas = db.query(models.Tarea).filter(models.Tarea.id_proyecto_fk == id_proyecto).all()
        for tarea in tareas:
            tarea.operarios = []

    update_data = proyecto_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_proyecto, key, value)

    db.commit()
    db.refresh(db_proyecto)
    return format_proyecto(db_proyecto, db)

@app.get("/proyectos/{id_proyecto}", response_model=schemas.Proyecto)
async def get_proyecto(
    id_proyecto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    p = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    return format_proyecto(p, db)

@app.get("/proyectos/{id_proyecto}/reporte-detallado")
async def get_proyecto_reporte_detallado(
    id_proyecto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        
    if current_user.id_rol_fk != 1 and proyecto.id_lider_fk != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver el reporte de este proyecto")
        
    lider_nombre = f"{proyecto.lider.nombre} {proyecto.lider.apellido}" if proyecto.lider else "No asignado"
    
    operarios = [
        {
            "id_usuario": o.id_usuario,
            "nombre_completo": f"{o.nombre} {o.apellido}",
            "correo": o.correo,
            "telefono": o.telefono or "No registrado"
        }
        for o in proyecto.operarios
    ]
    
    tareas = db.query(models.Tarea).options(
        joinedload(models.Tarea.operarios),
        joinedload(models.Tarea.finalizador)
    ).filter(models.Tarea.id_proyecto_fk == id_proyecto).all()
    
    tareas_detalles = []
    for t in tareas:
        tareas_detalles.append({
            "id_tarea": t.id_tarea,
            "titulo": t.titulo,
            "descripcion": t.descripcion or "Sin descripción",
            "estado": t.estado,
            "avance": t.avance,
            "prioridad": t.prioridad,
            "fecha_limite": t.fecha_limite,
            "operarios_nombres": [f"{o.nombre} {o.apellido}" for o in t.operarios],
            "finalizador_nombre": f"{t.finalizador.nombre} {t.finalizador.apellido}" if t.finalizador else None
        })
        
    # Obtener todos los reportes de avance de las tareas de este proyecto
    tarea_ids = [t.id_tarea for t in tareas]
    reportes_avance = []
    total_horas = 0.0
    
    if tarea_ids:
        reportes_db = db.query(
            models.ReporteAvance,
            models.Tarea.titulo.label("titulo_tarea"),
            models.Usuario.nombre.label("nombre_operario"),
            models.Usuario.apellido.label("apellido_operario")
        ).join(
            models.Tarea, models.ReporteAvance.id_tarea_fk == models.Tarea.id_tarea
        ).join(
            models.Usuario, models.ReporteAvance.id_operario_fk == models.Usuario.id_usuario
        ).filter(
            models.Tarea.id_proyecto_fk == id_proyecto
        ).order_by(models.ReporteAvance.fecha_reporte.desc()).all()
        
        for r, titulo_tarea, nom_op, ape_op in reportes_db:
            total_horas += r.horas_trabajadas
            
            # Materiales usados en este reporte
            materiales_usados = []
            for rm in r.materiales_detalles:
                materiales_usados.append({
                    "nombre_material": rm.material.nombre if rm.material else "Desconocido",
                    "cantidad_usada": rm.cantidad_usada,
                    "unidad_medida": rm.material.unidad_medida if rm.material else ""
                })
                
            reportes_avance.append({
                "id_reporte": r.id_reporte,
                "titulo_tarea": titulo_tarea,
                "nombre_operario": f"{nom_op} {ape_op}",
                "fecha_reporte": r.fecha_reporte,
                "porcentaje": r.porcentaje,
                "observaciones": r.observaciones or "Sin observaciones",
                "horas_trabajadas": r.horas_trabajadas,
                "foto_url": r.foto_url,
                "materiales_usados": materiales_usados
            })
            
    # Obtener inventario de este proyecto
    inventario_proy = db.query(models.InventarioProyecto).filter(models.InventarioProyecto.id_proyecto_fk == id_proyecto).all()
    materiales_inventario = []
    for inv in inventario_proy:
        materiales_inventario.append({
            "nombre_material": inv.material.nombre if inv.material else "Desconocido",
            "stock_actual": inv.stock_actual,
            "unidad_medida": inv.unidad_medida
        })
        
    avance_general = 0.0
    if tareas:
        total_avance = sum(t.avance for t in tareas)
        avance_general = round(total_avance / len(tareas), 1)
        
    return {
        "id_proyecto": proyecto.id_proyecto,
        "nombre": proyecto.nombre,
        "descripcion": proyecto.descripcion or "Sin descripción",
        "ciudad": proyecto.ciudad,
        "direccion": proyecto.direccion,
        "presupuesto": float(proyecto.presupuesto),
        "fecha_inicio": proyecto.fecha_inicio,
        "fecha_fin": proyecto.fecha_fin,
        "estado": proyecto.estado,
        "lider_nombre": lider_nombre,
        "avance_general": avance_general,
        "operarios": operarios,
        "tareas": tareas_detalles,
        "total_horas_trabajadas": total_horas,
        "reportes_avance": reportes_avance,
        "inventario": materiales_inventario
    }

@app.delete("/proyectos/{id_proyecto}")
async def delete_proyecto(
    id_proyecto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    db_proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not db_proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    # LIBERAR OPERARIOS: Antes de borrar, poner a todos los operarios asignados como 'disponible'
    for operario in db_proyecto.operarios:
        operario.disponibilidad = "disponible"

    db.delete(db_proyecto)
    db.commit()
    return {"message": f"Proyecto {id_proyecto} eliminado correctamente"}

async def finalizar_proyecto_logic(id_proyecto: int, db: Session, current_user: models.Usuario):
    # 1. Validar existencia y permisos (ya hecho en el llamador, pero por seguridad)
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    try:
        # 2. Cambiar estado del proyecto
        proyecto.estado = "finalizado"

        # 3. Liberar al Líder
        lider = db.query(models.Usuario).filter(models.Usuario.id_usuario == proyecto.id_lider_fk).first()
        if lider:
            lider.disponibilidad = "disponible"

        # 3b. Liberar a todos los Operarios
        for operario in proyecto.operarios:
            operario.disponibilidad = "disponible"

        # 4. Devolver materiales al Inventario Global
        inv_proyecto = db.query(models.InventarioProyecto).filter(
            models.InventarioProyecto.id_proyecto_fk == id_proyecto
        ).all()

        for item in inv_proyecto:
            if item.stock_actual > 0:
                inv_global = db.query(models.InventarioGlobal).filter(
                    models.InventarioGlobal.id_material_fk == item.id_material_fk
                ).first()
                if inv_global:
                    inv_global.stock_actual += item.stock_actual

                # Vaciar la bodega del proyecto
                item.stock_actual = 0

        db.commit()
        return True

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en la transacción: {str(e)}")

@app.post("/proyectos/{id_proyecto}/finalizar")
async def finalizar_proyecto_endpoint(
    id_proyecto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    await finalizar_proyecto_logic(id_proyecto, db, current_user)
    return {"message": "Proyecto finalizado exitosamente. Personal liberado e inventario devuelto al global."}

@app.get("/proyectos/{id_proyecto}/estado-equipo", response_model=List[schemas.OperarioEstado])
async def get_estado_equipo(
    id_proyecto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    # Solo el admin o el líder del proyecto pueden ver esto
    if current_user.id_rol_fk != 1 and proyecto.id_lider_fk != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver el equipo de este proyecto")

    # Consulta con JOIN para obtener operarios y su tarea actual (si existe y no está finalizada)
    # Usamos outerjoin para incluir operarios sin tareas
    resultados = db.query(
        models.Usuario,
        models.Tarea.titulo.label("titulo_tarea")
    ).join(
        models.proyectos_usuarios,
        models.Usuario.id_usuario == models.proyectos_usuarios.c.id_usuario
    ).outerjoin(
        models.tareas_operarios,
        models.Usuario.id_usuario == models.tareas_operarios.c.id_usuario
    ).outerjoin(
        models.Tarea,
        (models.tareas_operarios.c.id_tarea == models.Tarea.id_tarea) &
        (models.Tarea.id_proyecto_fk == id_proyecto) &
        (models.Tarea.estado != "finalizada")
    ).filter(
        models.proyectos_usuarios.c.id_proyecto == id_proyecto
    ).all()

    # Procesar resultados para agrupar tareas por operario
    operarios_dict = {}
    for usuario, titulo_tarea in resultados:
        if usuario.id_usuario not in operarios_dict:
            operarios_dict[usuario.id_usuario] = {
                "id_usuario": usuario.id_usuario,
                "nombre": usuario.nombre,
                "apellido": usuario.apellido,
                "en_tarea": False,
                "tareas_activas": []
            }
        
        if titulo_tarea and proyecto.estado != "finalizado":
            operarios_dict[usuario.id_usuario]["en_tarea"] = True
            if titulo_tarea not in operarios_dict[usuario.id_usuario]["tareas_activas"]:
                operarios_dict[usuario.id_usuario]["tareas_activas"].append(titulo_tarea)

    return list(operarios_dict.values())

@app.get("/proyectos/{id_proyecto}/operarios-libres", response_model=List[schemas.Usuario])
async def get_operarios_libres(
    id_proyecto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    # 1. Validar existencia del proyecto y permisos del líder
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    if current_user.id_rol_fk != 1 and proyecto.id_lider_fk != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="No tienes permisos para consultar este proyecto")

    # 2. Identificar operarios ocupados (tienen tareas pendientes o en progreso)
    # Se usa una subconsulta para obtener los IDs de usuarios con tareas activas
    ocupados_subquery = db.query(models.tareas_operarios.c.id_usuario).join(
        models.Tarea, models.tareas_operarios.c.id_tarea == models.Tarea.id_tarea
    ).filter(
        models.Tarea.estado.in_(["pendiente", "en_progreso"])
    ).subquery()

    # 3. Filtrar operarios vinculados al proyecto (Rol 3) que no estén en la subconsulta
    operarios_libres = db.query(models.Usuario).join(
        models.proyectos_usuarios, models.Usuario.id_usuario == models.proyectos_usuarios.c.id_usuario
    ).filter(
        models.proyectos_usuarios.c.id_proyecto == id_proyecto,
        models.Usuario.id_rol_fk == 3,
        ~models.Usuario.id_usuario.in_(ocupados_subquery)
    ).all()

    return operarios_libres

@app.post("/proyectos/configurar-equipo")
async def configurar_equipo(
    equipo: schemas.EquipoProyecto,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == equipo.id_proyecto).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    for user_id in equipo.id_usuarios:
        usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == user_id).first()

        if not usuario:
            raise HTTPException(status_code=404, detail=f"Usuario con ID {user_id} no encontrado")

        # VALIDACIÓN: Solo se pueden asignar operarios (Rol 3)
        if usuario.id_rol_fk != 3:
            raise HTTPException(
                status_code=400,
                detail=f"El usuario {usuario.nombre} no es un Operario. Solo se pueden asignar operarios al equipo."
            )

        # VALIDACIÓN: Un operario no puede estar en dos proyectos activos simultáneamente
        proyecto_activo = db.query(models.Proyecto).join(models.Proyecto.operarios).filter(
            models.Usuario.id_usuario == user_id,
            models.Proyecto.estado == "activo"
        ).first()

        if proyecto_activo and proyecto_activo.id_proyecto != equipo.id_proyecto:
            raise HTTPException(
                status_code=400,
                detail=f"El operario {usuario.nombre} ya está asignado al proyecto activo: {proyecto_activo.nombre}"
            )

        if usuario not in proyecto.operarios:
            proyecto.operarios.append(usuario)
            # Marcar como ocupado al asignar al equipo
            usuario.disponibilidad = "ocupado"

    db.commit()
    return {"message": "Equipo configurado correctamente"}

@app.delete("/proyectos/{id_proyecto}/equipo/{id_usuario}")
async def desvincular_operario(
    id_proyecto: int,
    id_usuario: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    """
    Elimina a un operario de un proyecto y lo vuelve a poner como 'disponible'.
    """
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if usuario in proyecto.operarios:
        proyecto.operarios.remove(usuario)
        usuario.disponibilidad = "disponible"
        db.commit()
        return {"message": "Operario desvinculado con éxito"}
    else:
        raise HTTPException(status_code=400, detail="El usuario no pertenece a este proyecto")
@app.post("/proyectos/trasladar-material")
async def trasladar_material(
    traslado: schemas.TrasladoMaterial,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2])) # Admin o Líder
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == traslado.id_proyecto).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        
    if current_user.id_rol_fk == 2 and proyecto.id_lider_fk != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="No tienes permisos sobre este proyecto")

    if proyecto.estado == "finalizado":
        raise HTTPException(status_code=400, detail="No se puede trasladar inventario a un proyecto finalizado")
    
    # 1. Verificar existencia del material
    material = db.query(models.Material).filter(models.Material.id_material == traslado.id_material).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material no encontrado")

    # 2. Verificar stock en InventarioGlobal
    inv_global = db.query(models.InventarioGlobal).filter(
        models.InventarioGlobal.id_material_fk == traslado.id_material
    ).first()
    
    actual_stock = inv_global.stock_actual if inv_global else 0

    if actual_stock < traslado.cantidad:
        # REGLA DE ALARMA: Notificamos al Admin sobre la falta de stock
        alarma = models.Notificacion(
            titulo="ALERTA: Stock Insuficiente en Bodega",
            mensaje=f"El líder {current_user.nombre} solicitó {traslado.cantidad} {material.unidad_medida} de '{material.nombre}' para el proyecto '{proyecto.nombre}', pero el stock global ({actual_stock}) es insuficiente.",
            tipo="alarma_stock",
            id_material_fk=material.id_material,
            stock_actual=actual_stock,
            unidad_medida=material.unidad_medida
        )
        db.add(alarma)
        db.commit()
        raise HTTPException(
            status_code=400, 
            detail=f"Stock insuficiente en bodega central (Disponible: {actual_stock}). Se ha enviado una alerta al administrador."
        )
    
    # 3. Restar de InventarioGlobal
    inv_global.stock_actual -= traslado.cantidad
    
    # 3. Sumar a InventarioProyecto
    inv_proy = db.query(models.InventarioProyecto).filter(
        models.InventarioProyecto.id_proyecto_fk == traslado.id_proyecto,
        models.InventarioProyecto.id_material_fk == traslado.id_material
    ).first()
    
    if not inv_proy:
        material = db.query(models.Material).filter(models.Material.id_material == traslado.id_material).first()
        inv_proy = models.InventarioProyecto(
            id_proyecto_fk=traslado.id_proyecto,
            id_material_fk=traslado.id_material,
            stock_actual=traslado.cantidad,
            unidad_medida=material.unidad_medida
        )
        db.add(inv_proy)
    else:
        inv_proy.stock_actual += traslado.cantidad
    
    db.commit()
    return {"message": f"Traslado de {traslado.cantidad} unidades completado"}

# --- Rutas de Tareas ---

@app.get("/tareas/mis-tareas", response_model=List[schemas.TareaOperario])
async def get_my_tasks(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([3])) # Solo Operarios
):
    # Consulta con JOIN para obtener el nombre del proyecto
    tareas = db.query(
        models.Tarea.id_tarea,
        models.Tarea.titulo,
        models.Tarea.id_proyecto_fk,
        models.Proyecto.nombre.label("nombre_proyecto"),
        models.Tarea.estado,
        models.Tarea.avance,
        models.Tarea.prioridad
    ).join(
        models.tareas_operarios,
        models.Tarea.id_tarea == models.tareas_operarios.c.id_tarea
    ).join(
        models.Proyecto,
        models.Tarea.id_proyecto_fk == models.Proyecto.id_proyecto
    ).filter(
        models.tareas_operarios.c.id_usuario == current_user.id_usuario
    ).all()
    
    return tareas

@app.get("/tareas/mis-tareas/{id_tarea}", response_model=schemas.TareaDetalleOperario)
async def get_my_task_detail(
    id_tarea: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2, 3]))
):
    # 1. Obtener la tarea
    tarea = db.query(models.Tarea).filter(models.Tarea.id_tarea == id_tarea).first()
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    # 2. Validar permisos
    es_admin = current_user.id_rol_fk == 1
    es_lider = (current_user.id_rol_fk == 2 and tarea.proyecto.id_lider_fk == current_user.id_usuario)
    es_operario_asignado = (current_user.id_rol_fk == 3 and any(o.id_usuario == current_user.id_usuario for o in tarea.operarios))

    if not (es_admin or es_lider or es_operario_asignado):
        raise HTTPException(status_code=403, detail="No tienes permisos para ver esta tarea")

    # 3. Obtener historial de reportes
    query_reportes = db.query(models.ReporteAvance).filter(models.ReporteAvance.id_tarea_fk == id_tarea)
    
    # Si es operario, solo ve sus propios reportes (según requerimiento previo)
    if current_user.id_rol_fk == 3:
        query_reportes = query_reportes.filter(models.ReporteAvance.id_operario_fk == current_user.id_usuario)
    
    reportes = query_reportes.order_by(models.ReporteAvance.fecha_reporte.desc()).all()

    # 4. Calcular totales
    horas_totales = sum(r.horas_trabajadas for r in reportes)
    materiales_map = {}
    
    historial_final = []
    for r in reportes:
        m_detalles = []
        for md in r.materiales_detalles:
            m_info = {"nombre_material": md.material.nombre, "cantidad_usada": md.cantidad_usada, "unidad_medida": md.material.unidad_medida}
            m_detalles.append(m_info)
            mid = md.id_material_fk
            if mid not in materiales_map:
                materiales_map[mid] = {"nombre_material": md.material.nombre, "cantidad_usada": 0, "unidad_medida": md.material.unidad_medida}
            materiales_map[mid]["cantidad_usada"] += md.cantidad_usada
        
        historial_final.append({
            "id_reporte": r.id_reporte,
            "id_tarea_fk": r.id_tarea_fk,
            "id_operario_fk": r.id_operario_fk,
            "fecha_reporte": r.fecha_reporte,
            "porcentaje": r.porcentaje,
            "observaciones": r.observaciones,
            "foto_url": r.foto_url,
            "horas_trabajadas": r.horas_trabajadas,
            "materiales_detalles": m_detalles
        })

    return {
        "id_tarea": tarea.id_tarea,
        "titulo": tarea.titulo,
        "id_proyecto_fk": tarea.id_proyecto_fk,
        "nombre_proyecto": tarea.proyecto.nombre if tarea.proyecto else "S/P",
        "estado": tarea.estado,
        "avance": tarea.avance,
        "prioridad": tarea.prioridad,
        "horas_totales": horas_totales,
        "materiales_totales": list(materiales_map.values()),
        "historial_reportes": historial_final
    }

@app.post("/tareas", response_model=schemas.Tarea)
async def create_tarea(
    tarea: schemas.TareaCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([2]))
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == tarea.id_proyecto_fk).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if proyecto.id_lider_fk != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="No eres el líder de este proyecto")
    if proyecto.estado == "finalizado":
        raise HTTPException(status_code=400, detail="No se pueden agregar tareas a un proyecto finalizado")

    tarea_data = tarea.dict(exclude={"id_operarios"})
    db_tarea = models.Tarea(**tarea_data)
    
    # Asignar lista de operarios
    for user_id in tarea.id_operarios:
        usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == user_id).first()
        if not usuario:
            raise HTTPException(status_code=404, detail=f"Operario con ID {user_id} no encontrado")
        
        # Si el operario no está asignado al proyecto, validar disponibilidad y agregarlo al proyecto
        if usuario not in proyecto.operarios:
            proyecto_activo = db.query(models.Proyecto).join(models.Proyecto.operarios).filter(
                models.Proyecto.estado == "activo",
                models.Usuario.id_usuario == user_id
            ).first()
            if proyecto_activo:
                raise HTTPException(
                    status_code=400, 
                    detail=f"El operario {usuario.nombre} ya está asignado al proyecto activo: {proyecto_activo.nombre}"
                )
            proyecto.operarios.append(usuario)
        
        usuario.disponibilidad = "ocupado"
        db_tarea.operarios.append(usuario)
            
    db.add(db_tarea)
    db.commit()
    db.refresh(db_tarea)
    return db_tarea

@app.get("/proyectos/{id_proyecto}/tareas", response_model=List[schemas.TareaDetallada])
async def get_tareas_detalladas_proyecto(
    id_proyecto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    # 1. Validar existencia del proyecto y permisos del líder
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    if current_user.id_rol_fk != 1 and proyecto.id_lider_fk != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver las tareas de este proyecto")

    # 2. Obtener tareas con joinedload para operarios y finalizador
    tareas = db.query(models.Tarea).options(
        joinedload(models.Tarea.operarios),
        joinedload(models.Tarea.finalizador)
    ).filter(models.Tarea.id_proyecto_fk == id_proyecto).all()

    resultado = []
    for tarea in tareas:
        resultado.append({
            "id_tarea": tarea.id_tarea,
            "titulo": tarea.titulo,
            "descripcion": tarea.descripcion,
            "estado": tarea.estado,
            "avance": tarea.avance,
            "prioridad": tarea.prioridad,
            "operarios_nombres": [f"{o.nombre} {o.apellido}" for o in tarea.operarios],
            "finalizador_nombre": f"{tarea.finalizador.nombre} {tarea.finalizador.apellido}" if tarea.finalizador else None
        })

    return resultado

@app.put("/tareas/{id_tarea}", response_model=schemas.Tarea)
async def update_tarea(
    id_tarea: int,
    tarea_update: schemas.TareaUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([2]))
):
    # 1. Buscar la tarea y su proyecto
    db_tarea = db.query(models.Tarea).filter(models.Tarea.id_tarea == id_tarea).first()
    if not db_tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == db_tarea.id_proyecto_fk).first()
    
    # 2. Validar permisos (Líder del proyecto)
    if proyecto.id_lider_fk != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar esta tarea")
    
    # 3. Actualizar campos básicos
    update_data = tarea_update.dict(exclude={"id_operarios"}, exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_tarea, key, value)
    
    # REGLA DE AUDITORÍA: Si el estado cambia a 'finalizada', grabamos quién lo hizo
    if tarea_update.estado == "finalizada":
        db_tarea.id_usuario_finalizado_fk = current_user.id_usuario
        db_tarea.avance = 100
    elif tarea_update.estado and db_tarea.estado == "finalizada" and tarea_update.estado != "finalizada":
        # Si se reactiva, limpiamos el finalizador
        db_tarea.id_usuario_finalizado_fk = None
    
    # 4. Actualizar operarios si se enviaron
    if tarea_update.id_operarios is not None:
        nuevos_operarios = []
        for user_id in tarea_update.id_operarios:
            usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == user_id).first()
            if not usuario:
                raise HTTPException(status_code=404, detail=f"Operario con ID {user_id} no encontrado")
            
            # Si el operario no está asignado al proyecto, validar disponibilidad y agregarlo al proyecto
            if usuario not in proyecto.operarios:
                proyecto_activo = db.query(models.Proyecto).join(models.Proyecto.operarios).filter(
                    models.Proyecto.estado == "activo",
                    models.Usuario.id_usuario == user_id
                ).first()
                if proyecto_activo:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"El operario {usuario.nombre} ya está asignado al proyecto activo: {proyecto_activo.nombre}"
                    )
                # Asociar al proyecto y marcar como ocupado
                proyecto.operarios.append(usuario)
            
            usuario.disponibilidad = "ocupado"
            nuevos_operarios.append(usuario)
        
        # Reemplazar la lista anterior por la nueva
        db_tarea.operarios = nuevos_operarios
    
    db.commit()
    db.refresh(db_tarea)
    return db_tarea

@app.delete("/tareas/{id_tarea}")
async def delete_tarea(
    id_tarea: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([2]))
):
    # 1. Buscar la tarea y su proyecto asociado
    db_tarea = db.query(models.Tarea).filter(models.Tarea.id_tarea == id_tarea).first()
    if not db_tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == db_tarea.id_proyecto_fk).first()
    
    # 2. Validar permisos: Líder del proyecto
    if proyecto.id_lider_fk != current_user.id_usuario:
        raise HTTPException(
            status_code=403, 
            detail="No tienes permisos para eliminar tareas de este proyecto"
        )
    
    # 3. Eliminar la tarea (SQLAlchemy se encarga de la tabla intermedia tareas_operarios)
    db.delete(db_tarea)
    db.commit()
    
    return {"message": f"Tarea {id_tarea} eliminada correctamente"}

# --- Rutas de Reportes de Avance ---

@app.post("/reportes", response_model=schemas.ReporteAvance)
async def create_reporte(
    reporte: schemas.ReporteAvanceCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([3])) # Solo Operario
):
    # 1. Validar tarea y obtener proyecto
    tarea = db.query(models.Tarea).filter(models.Tarea.id_tarea == reporte.id_tarea_fk).first()
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    id_proyecto = tarea.id_proyecto_fk
    
    # 2. Validar Materiales y Stock en InventarioProyecto
    for mat_usado in reporte.materiales_usados:
        inv_proy = db.query(models.InventarioProyecto).filter(
            models.InventarioProyecto.id_proyecto_fk == id_proyecto,
            models.InventarioProyecto.id_material_fk == mat_usado.id_material
        ).first()
        
        if not inv_proy or inv_proy.stock_actual < mat_usado.cantidad:
            # AUTOMÁTICO: Crear solicitud de material para el líder
            material = db.query(models.Material).filter(models.Material.id_material == mat_usado.id_material).first()
            
            cant_actual = inv_proy.stock_actual if inv_proy else 0
            cant_faltante = mat_usado.cantidad - cant_actual
            
            nueva_solicitud = models.SolicitudMaterial(
                id_proyecto_fk=id_proyecto,
                id_material_fk=mat_usado.id_material,
                cantidad_solicitada=cant_faltante,
                estado_solicitud="pendiente"
            )
            db.add(nueva_solicitud)
            db.commit()
            
            raise HTTPException(
                status_code=400, 
                detail=f"Stock insuficiente de {material.nombre} en el proyecto. Se ha generado una solicitud automática al líder."
            )

    # 3. Crear el reporte principal
    reporte_dict = reporte.dict(exclude={"materiales_usados"})
    db_reporte = models.ReporteAvance(
        **reporte_dict,
        id_operario_fk=current_user.id_usuario
    )
    db.add(db_reporte)
    db.commit()
    db.refresh(db_reporte)

    # 4. Procesar materiales usados: Restar stock y guardar relación
    for mat_usado in reporte.materiales_usados:
        inv_proy = db.query(models.InventarioProyecto).filter(
            models.InventarioProyecto.id_proyecto_fk == id_proyecto,
            models.InventarioProyecto.id_material_fk == mat_usado.id_material
        ).first()
        
        inv_proy.stock_actual -= mat_usado.cantidad
        
        db_mat_reporte = models.ReporteMaterial(
            id_reporte_fk=db_reporte.id_reporte,
            id_material_fk=mat_usado.id_material,
            cantidad_usada=mat_usado.cantidad
        )
        db.add(db_mat_reporte)

    # 5. Actualizar avance de la tarea y recalcular general del proyecto
    tarea.avance = reporte.porcentaje # Actualizar el avance de la tarea individual
    
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    tareas_proyecto = db.query(models.Tarea).filter(models.Tarea.id_proyecto_fk == id_proyecto).all()
    
    total_avance = 0
    for t in tareas_proyecto:
        total_avance += t.avance
    
    if tareas_proyecto:
        proyecto.avance_general = total_avance / len(tareas_proyecto)
        
        # Actualizar estado de la tarea
        if reporte.porcentaje >= 100:
            tarea.estado = "finalizada"
        elif reporte.porcentaje > 0:
            tarea.estado = "en_progreso"
            
    db.commit()
    return db_reporte

@app.delete("/reportes/{id_reporte}")
async def delete_reporte(
    id_reporte: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([3])) # Solo Operarios
):
    # 1. Validar existencia del reporte
    reporte = db.query(models.ReporteAvance).filter(models.ReporteAvance.id_reporte == id_reporte).first()
    if not reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
        
    # Seguridad: Un operario solo puede eliminar sus propios reportes
    if reporte.id_operario_fk != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar este reporte")
        
    # 2. Obtener la tarea relacionada
    tarea = db.query(models.Tarea).filter(models.Tarea.id_tarea == reporte.id_tarea_fk).first()
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea asociada no encontrada")
        
    if tarea.estado == "finalizada":
        raise HTTPException(status_code=400, detail="No se pueden eliminar reportes de una tarea finalizada")
        
    id_proyecto = tarea.id_proyecto_fk
    
    # 3. Devolver stock al InventarioProyecto
    for mat_detalle in reporte.materiales_detalles:
        inv_proy = db.query(models.InventarioProyecto).filter(
            models.InventarioProyecto.id_proyecto_fk == id_proyecto,
            models.InventarioProyecto.id_material_fk == mat_detalle.id_material_fk
        ).first()
        if inv_proy:
            inv_proy.stock_actual += mat_detalle.cantidad_usada
            
    # 4. Eliminar registros de ReporteMaterial
    db.query(models.ReporteMaterial).filter(models.ReporteMaterial.id_reporte_fk == id_reporte).delete()
    
    # 5. Eliminar el reporte principal
    db.delete(reporte)
    db.commit()
    
    # 6. Recalcular el avance de la tarea y del proyecto
    otros_reportes = db.query(models.ReporteAvance).filter(models.ReporteAvance.id_tarea_fk == tarea.id_tarea).all()
    if otros_reportes:
        tarea.avance = max(r.porcentaje for r in otros_reportes)
    else:
        tarea.avance = 0
        
    # Actualizar estado de la tarea basado en el nuevo avance
    if tarea.avance >= 100:
        tarea.estado = "finalizada"
    elif tarea.avance > 0:
        tarea.estado = "en_progreso"
    else:
        tarea.estado = "pendiente"
        
    # Si la tarea ya no está finalizada, limpiar el usuario finalizador
    if tarea.avance < 100:
        tarea.id_usuario_finalizado_fk = None
        
    # Recalcular el avance general del proyecto
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    tareas_proyecto = db.query(models.Tarea).filter(models.Tarea.id_proyecto_fk == id_proyecto).all()
    total_avance = sum(t.avance for t in tareas_proyecto)
    if tareas_proyecto:
        proyecto.avance_general = total_avance / len(tareas_proyecto)
        
    db.commit()
    return {"message": f"Reporte {id_reporte} eliminado y stock restablecido correctamente"}

@app.get("/reportes", response_model=List[schemas.ReporteAvanceDetailed])
async def list_reportes(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    # Consulta uniendo con Tarea, Proyecto y Usuario para obtener nombres
    reportes = db.query(
        models.ReporteAvance,
        models.Proyecto.nombre.label("nombre_proyecto"),
        models.Tarea.titulo.label("titulo_tarea"),
        models.Usuario.nombre.label("nombre_operario")
    ).join(
        models.Tarea, models.ReporteAvance.id_tarea_fk == models.Tarea.id_tarea
    ).join(
        models.Proyecto, models.Tarea.id_proyecto_fk == models.Proyecto.id_proyecto
    ).join(
        models.Usuario, models.ReporteAvance.id_operario_fk == models.Usuario.id_usuario
    ).order_by(models.ReporteAvance.fecha_reporte.desc()).limit(limit).all()

    # Mapeo manual para ReporteAvanceDetailed
    resultado = []
    for r, proj, tarea, user in reportes:
        reporte_dict = {c.name: getattr(r, c.name) for c in r.__table__.columns}
        reporte_dict["nombre_proyecto"] = proj
        reporte_dict["titulo_tarea"] = tarea
        reporte_dict["nombre_operario"] = user
        resultado.append(reporte_dict)

    return resultado

@app.get("/notificaciones", response_model=List[schemas.Notificacion])
async def list_notificaciones(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    return db.query(models.Notificacion).order_by(models.Notificacion.fecha_creacion.desc()).all()

@app.patch("/notificaciones/{id_notificacion}/leer")
async def marcar_notificacion_leida(
    id_notificacion: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    notif = db.query(models.Notificacion).filter(models.Notificacion.id_notificacion == id_notificacion).first()
    if notif:
        notif.leida = True
        db.commit()
    return {"message": "Marcada como leída"}

# --- Rutas de Categorías de Materiales ---

@app.get("/categorias", response_model=List[schemas.CategoriaMaterial])
async def list_categorias(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    return db.query(models.CategoriaMaterial).all()

@app.post("/categorias", response_model=schemas.CategoriaMaterial)
async def create_categoria(
    categoria: schemas.CategoriaMaterialCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    db_cat = db.query(models.CategoriaMaterial).filter(
        models.CategoriaMaterial.nombre_categoria == categoria.nombre_categoria
    ).first()
    if db_cat:
        raise HTTPException(status_code=400, detail="La categoría ya existe")
    
    db_categoria = models.CategoriaMaterial(**categoria.dict())
    db.add(db_categoria)
    db.commit()
    db.refresh(db_categoria)
    return db_categoria

# --- Rutas de Materiales ---

@app.get("/materiales", response_model=List[schemas.MaterialDetailed])
async def list_materiales(
    categoria_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    query = db.query(models.Material).options(joinedload(models.Material.categoria))
    
    if categoria_id is not None:
        query = query.filter(models.Material.id_categoria_fk == categoria_id)
        
    materiales = query.all()
    
    # Mapeo manual para asegurar que el validador de pydantic reciba lo que espera o usar alias
    resultado = []
    for m in materiales:
        resultado.append({
            "id_material": m.id_material,
            "nombre": m.nombre,
            "id_categoria_fk": m.id_categoria_fk,
            "stock_minimo": m.stock_minimo,
            "unidad_medida": m.unidad_medida,
            "categoria_nombre": m.categoria.nombre_categoria if m.categoria else "Sin categoría"
        })
    return resultado

@app.post("/materiales", response_model=schemas.Material)
async def create_material(
    material: schemas.MaterialCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    # Verificar duplicados
    db_mat = db.query(models.Material).filter(models.Material.nombre == material.nombre).first()
    if db_mat:
        raise HTTPException(status_code=400, detail="El material ya existe")
    
    # 0. Lógica de Categoría automática
    id_cat = material.id_categoria_fk
    if id_cat is None:
        cat_default = db.query(models.CategoriaMaterial).filter(
            models.CategoriaMaterial.nombre_categoria == "Por Confirmar"
        ).first()
        if not cat_default:
            cat_default = models.CategoriaMaterial(nombre_categoria="Por Confirmar")
            db.add(cat_default)
            db.commit()
            db.refresh(cat_default)
        id_cat = cat_default.id_categoria

    # 1. Crear el material
    material_data = material.dict(exclude={"stock", "id_categoria_fk"})
    db_material = models.Material(**material_data, id_categoria_fk=id_cat)
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    
    # 2. Crear automáticamente registro en InventarioGlobal con el stock inicial
    db_inventario = models.InventarioGlobal(
        id_material_fk=db_material.id_material,
        stock_actual=material.stock,
        unidad_medida=db_material.unidad_medida
    )
    db.add(db_inventario)
    db.commit()
    
    return db_material

@app.put("/materiales/{id_material}/categoria", response_model=schemas.Material)
async def update_material_categoria(
    id_material: int,
    nueva_categoria_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    db_material = db.query(models.Material).filter(models.Material.id_material == id_material).first()
    if not db_material:
        raise HTTPException(status_code=404, detail="Material no encontrado")
    
    db_cat = db.query(models.CategoriaMaterial).filter(
        models.CategoriaMaterial.id_categoria == nueva_categoria_id
    ).first()
    if not db_cat:
        raise HTTPException(status_code=400, detail="La categoría especificada no existe")
    
    db_material.id_categoria_fk = nueva_categoria_id
    db.commit()
    db.refresh(db_material)
    return db_material

@app.delete("/materiales/{id_material}")
async def delete_material(
    id_material: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    db_material = db.query(models.Material).filter(models.Material.id_material == id_material).first()
    if not db_material:
        raise HTTPException(status_code=404, detail="Material no encontrado")
    
    # Nota: El borrado de material puede fallar si hay registros en inventario o reportes
    # por restricciones de FK. En una implementación real, se consideraría borrado lógico.
    try:
        db.delete(db_material)
        db.commit()
        return {"message": f"Material {id_material} eliminado correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="No se puede eliminar el material porque tiene registros asociados.")

# --- Rutas de Inventario Global ---

@app.get("/inventario/proyecto/{id_proyecto}", response_model=List[schemas.InventarioProyecto])
async def get_inventario_proyecto(
    id_proyecto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2, 3]))
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    # Seguridad: Solo admin, el líder del proyecto, u operarios asignados al mismo o a sus tareas
    is_lider = (current_user.id_rol_fk == 2 and proyecto.id_lider_fk == current_user.id_usuario)
    
    is_operario_in_team = (current_user.id_rol_fk == 3 and any(o.id_usuario == current_user.id_usuario for o in proyecto.operarios))
    is_operario_in_tasks = False
    if current_user.id_rol_fk == 3:
        is_operario_in_tasks = db.query(models.Tarea).join(models.Tarea.operarios).filter(
            models.Tarea.id_proyecto_fk == id_proyecto,
            models.Usuario.id_usuario == current_user.id_usuario
        ).first() is not None
    is_operario = is_operario_in_team or is_operario_in_tasks
    
    if current_user.id_rol_fk != 1 and not is_lider and not is_operario:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver el inventario de este proyecto")

    # Obtener inventario con nombres de materiales y categorías
    inventario = db.query(
        models.InventarioProyecto.id_material_fk,
        models.Material.nombre.label("nombre_material"),
        models.InventarioProyecto.stock_actual,
        models.InventarioProyecto.unidad_medida,
        models.CategoriaMaterial.nombre_categoria.label("categoria_nombre")
    ).join(
        models.Material, 
        models.InventarioProyecto.id_material_fk == models.Material.id_material
    ).join(
        models.CategoriaMaterial,
        models.Material.id_categoria_fk == models.CategoriaMaterial.id_categoria
    ).filter(
        models.InventarioProyecto.id_proyecto_fk == id_proyecto
    ).all()

    return inventario

@app.get("/inventario", response_model=List[schemas.InventarioGlobalDetailed])
async def list_inventario(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2, 3]))
):
    # Unimos con Material y Categoria para obtener nombres
    inventario = db.query(
        models.InventarioGlobal.id_inventario,
        models.InventarioGlobal.id_material_fk,
        models.InventarioGlobal.stock_actual,
        models.InventarioGlobal.unidad_medida,
        models.Material.nombre.label("nombre_material"),
        models.Material.stock_minimo.label("stock_minimo"),
        models.CategoriaMaterial.nombre_categoria.label("categoria_nombre")
    ).join(
        models.Material,
        models.InventarioGlobal.id_material_fk == models.Material.id_material
    ).join(
        models.CategoriaMaterial,
        models.Material.id_categoria_fk == models.CategoriaMaterial.id_categoria
    ).all()
    
    return inventario

@app.put("/materiales/{id_material}/stock", response_model=schemas.InventarioGlobal)
async def update_stock_manual(
    id_material: int,
    nueva_cantidad: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    db_inventario = db.query(models.InventarioGlobal).filter(
        models.InventarioGlobal.id_material_fk == id_material
    ).first()
    
    if not db_inventario:
        raise HTTPException(status_code=404, detail="Material o registro de inventario no encontrado")
    
    db_inventario.stock_actual = nueva_cantidad
    db.commit()
    db.refresh(db_inventario)
    return db_inventario

# --- Ruta de Salud ---
@app.get("/health")
def health_check():
    return {"status": "ok", "engine": "FastAPI + SQLAlchemy (SQLite)"}
