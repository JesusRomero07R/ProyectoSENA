from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta

# Importaciones locales
import models
import schemas
import database
from database import engine, get_db

app = FastAPI(title="Constructora GG - API Python")

# Crear tablas en SQLite automáticamente al iniciar (Mantenido después de instanciar app)
models.Base.metadata.create_all(bind=engine)

# --- Seguridad ---
SECRET_KEY = "super_secret_key_constructora_gg" # En producción usar variable de entorno
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# --- Dependencias de Seguridad ---
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar el token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.Usuario).filter(models.Usuario.correo == token_data.email).first()
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
    user = db.query(models.Usuario).filter(models.Usuario.correo == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Correo o contraseña incorrectos")
    
    access_token = create_access_token(data={"sub": user.correo, "role": user.id_rol_fk})
    return {"access_token": access_token, "token_type": "bearer"}

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

@app.put("/usuarios/{id_usuario}", response_model=schemas.Usuario)
async def update_usuario(
    id_usuario: int,
    usuario_update: schemas.UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    db_usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario).first()
    if not db_usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    update_data = usuario_update.dict(exclude_unset=True)
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
    
    db.delete(db_usuario)
    db.commit()
    return {"message": f"Usuario {id_usuario} eliminado correctamente"}

# --- Rutas de Proyectos ---

@app.get("/proyectos", response_model=List[schemas.Proyecto])
async def get_proyectos(
    estado: Optional[str] = None,
    db: Session = Depends(get_db), 
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    query = db.query(models.Proyecto)
    if estado:
        query = query.filter(models.Proyecto.estado == estado)
    
    # Gracias al @property id_operarios en el modelo y Config.from_attributes en el esquema,
    # Pydantic mapeará automáticamente la relación a la lista de IDs.
    return query.all()

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
        return db_proyecto
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
    current_user: models.Usuario = Depends(require_role([1]))
):
    db_proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not db_proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    update_data = proyecto_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_proyecto, key, value)
    
    db.commit()
    db.refresh(db_proyecto)
    return db_proyecto

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

@app.post("/proyectos/{id_proyecto}/finalizar")
async def finalizar_proyecto(
    id_proyecto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    # 1. Validar existencia y permisos
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    if current_user.id_rol_fk != 1 and proyecto.id_lider_fk != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="No tienes permisos para finalizar este proyecto")

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
        return {"message": "Proyecto finalizado exitosamente. Personal liberado e inventario devuelto al global."}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en la transacción: {str(e)}")

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

    # Procesar resultados para evitar duplicados si un operario tiene múltiples tareas (aunque no debería)
    operarios_dict = {}
    for usuario, titulo_tarea in resultados:
        if usuario.id_usuario not in operarios_dict:
            operarios_dict[usuario.id_usuario] = {
                "id_usuario": usuario.id_usuario,
                "nombre": usuario.nombre,
                "apellido": usuario.apellido,
                "en_tarea": titulo_tarea is not None,
                "titulo_tarea": titulo_tarea
            }
        # Si ya existe pero encontramos una fila con tarea, actualizamos
        elif titulo_tarea and not operarios_dict[usuario.id_usuario]["en_tarea"]:
            operarios_dict[usuario.id_usuario]["en_tarea"] = True
            operarios_dict[usuario.id_usuario]["titulo_tarea"] = titulo_tarea

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

@app.post("/proyectos/trasladar-material")
async def trasladar_material(
    traslado: schemas.TrasladoMaterial,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([2])) # Solo Líder
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == traslado.id_proyecto).first()
    if not proyecto or proyecto.id_lider_fk != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="No eres el líder de este proyecto")
    
    # 1. Verificar stock en InventarioGlobal
    inv_global = db.query(models.InventarioGlobal).filter(
        models.InventarioGlobal.id_material_fk == traslado.id_material
    ).first()
    
    if not inv_global or inv_global.stock_actual < traslado.cantidad:
        raise HTTPException(status_code=400, detail="Stock global insuficiente")
    
    # 2. Restar de InventarioGlobal
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
        models.Proyecto.nombre.label("nombre_proyecto"),
        models.Tarea.estado
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

@app.post("/tareas", response_model=schemas.Tarea)
async def create_tarea(
    tarea: schemas.TareaCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    tarea_data = tarea.dict(exclude={"id_operarios"})
    db_tarea = models.Tarea(**tarea_data)
    
    # Asignar lista de operarios
    for user_id in tarea.id_operarios:
        usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == user_id).first()
        if usuario:
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

    # 2. Obtener tareas con joinedload para operarios en una sola consulta
    tareas = db.query(models.Tarea).options(
        joinedload(models.Tarea.operarios)
    ).filter(models.Tarea.id_proyecto_fk == id_proyecto).all()

    resultado = []
    for tarea in tareas:
        # Calcular el avance (máximo porcentaje reportado)
        avance_max = db.query(func.max(models.ReporteAvance.porcentaje)).filter(
            models.ReporteAvance.id_tarea_fk == tarea.id_tarea
        ).scalar() or 0

        resultado.append({
            "id_tarea": tarea.id_tarea,
            "titulo": tarea.titulo,
            "descripcion": tarea.descripcion,
            "estado": tarea.estado,
            "avance": avance_max,
            "operarios_nombres": [f"{o.nombre} {o.apellido}" for o in tarea.operarios]
        })

    return resultado

@app.put("/tareas/{id_tarea}", response_model=schemas.Tarea)
async def update_tarea(
    id_tarea: int,
    tarea_update: schemas.TareaUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    # 1. Buscar la tarea y su proyecto
    db_tarea = db.query(models.Tarea).filter(models.Tarea.id_tarea == id_tarea).first()
    if not db_tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == db_tarea.id_proyecto_fk).first()
    
    # 2. Validar permisos (Admin o Líder del proyecto)
    if current_user.id_rol_fk != 1 and proyecto.id_lider_fk != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar esta tarea")
    
    # 3. Actualizar campos básicos
    update_data = tarea_update.dict(exclude={"id_operarios"}, exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_tarea, key, value)
    
    # 4. Actualizar operarios si se enviaron
    if tarea_update.id_operarios is not None:
        nuevos_operarios = []
        for user_id in tarea_update.id_operarios:
            usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == user_id).first()
            if not usuario:
                raise HTTPException(status_code=404, detail=f"Operario con ID {user_id} no encontrado")
            
            # VALIDACIÓN: El operario debe pertenecer al proyecto de la tarea
            # Verificamos si el usuario está en la relación 'operarios' del proyecto
            if usuario not in proyecto.operarios:
                raise HTTPException(
                    status_code=400, 
                    detail=f"El operario {usuario.nombre} no está asignado al proyecto {proyecto.nombre}"
                )
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
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    # 1. Buscar la tarea y su proyecto asociado
    db_tarea = db.query(models.Tarea).filter(models.Tarea.id_tarea == id_tarea).first()
    if not db_tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == db_tarea.id_proyecto_fk).first()
    
    # 2. Validar permisos: Admin tiene acceso total, Líder solo si es su proyecto
    if current_user.id_rol_fk != 1 and proyecto.id_lider_fk != current_user.id_usuario:
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
            proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
            material = db.query(models.Material).filter(models.Material.id_material == mat_usado.id_material).first()
            
            nueva_solicitud = models.SolicitudMaterial(
                id_proyecto_fk=id_proyecto,
                id_lider_fk=proyecto.id_lider_fk,
                descripcion=f"Falta stock de {material.nombre} para completar tarea {tarea.titulo}. Cantidad faltante: {mat_usado.cantidad}",
                estado="pendiente"
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

    # 5. Recalcular avance general del proyecto (Promedio de tareas)
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    tareas_proyecto = db.query(models.Tarea).filter(models.Tarea.id_proyecto_fk == id_proyecto).all()
    
    total_avance = 0
    for t in tareas_proyecto:
        max_avance_tarea = db.query(func.max(models.ReporteAvance.porcentaje)).filter(
            models.ReporteAvance.id_tarea_fk == t.id_tarea
        ).scalar() or 0
        total_avance += max_avance_tarea
    
    if tareas_proyecto:
        proyecto.avance_general = total_avance / len(tareas_proyecto)
        
        # Actualizar estado de la tarea
        if reporte.porcentaje >= 100:
            tarea.estado = "finalizada"
        elif reporte.porcentaje > 0:
            tarea.estado = "en_progreso"
            
    db.commit()
    return db_reporte

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

@app.get("/materiales", response_model=List[schemas.Material])
async def list_materiales(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    # Nota: Para incluir el nombre de la categoría se podría hacer un join
    return db.query(models.Material).all()

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
    
    # 1. Crear el material
    db_material = models.Material(**material.dict())
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    
    # 2. Crear automáticamente registro en InventarioGlobal
    db_inventario = models.InventarioGlobal(
        id_material_fk=db_material.id_material,
        stock_actual=0,
        unidad_medida=db_material.unidad_medida
    )
    db.add(db_inventario)
    db.commit()
    
    return db_material

# --- Rutas de Inventario Global ---

@app.get("/inventario/proyecto/{id_proyecto}", response_model=List[schemas.InventarioProyecto])
async def get_inventario_proyecto(
    id_proyecto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    # Seguridad: Solo admin o el líder del proyecto
    if current_user.id_rol_fk != 1 and proyecto.id_lider_fk != current_user.id_usuario:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver el inventario de este proyecto")

    # Obtener inventario con nombres de materiales
    inventario = db.query(
        models.InventarioProyecto.id_material_fk,
        models.Material.nombre.label("nombre_material"),
        models.InventarioProyecto.stock_actual,
        models.InventarioProyecto.unidad_medida
    ).join(
        models.Material, 
        models.InventarioProyecto.id_material_fk == models.Material.id_material
    ).filter(
        models.InventarioProyecto.id_proyecto_fk == id_proyecto
    ).all()

    return inventario

@app.get("/inventario", response_model=List[schemas.InventarioGlobal])
async def list_inventario(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    return db.query(models.InventarioGlobal).all()

@app.put("/inventario/actualizar-stock/{id_material}", response_model=schemas.InventarioGlobal)
async def update_stock_manual(
    id_material: int,
    nuevo_stock: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    db_inventario = db.query(models.InventarioGlobal).filter(
        models.InventarioGlobal.id_material_fk == id_material
    ).first()
    
    if not db_inventario:
        raise HTTPException(status_code=404, detail="Registro de inventario no encontrado")
    
    db_inventario.stock_actual = nuevo_stock
    db.commit()
    db.refresh(db_inventario)
    return db_inventario

# --- Ruta de Salud ---
@app.get("/health")
def health_check():
    return {"status": "ok", "engine": "FastAPI + SQLAlchemy (SQLite)"}
