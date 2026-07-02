from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List, Optional

from app import models, schemas
from app.database import get_db
from app.security import pwd_context, require_role, get_password_hash

router = APIRouter(tags=["usuarios"])


@router.get("/usuarios", response_model=List[schemas.Usuario])
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

@router.post("/usuarios", response_model=schemas.Usuario)
async def create_usuario(
    usuario: schemas.UsuarioCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    # Normalizar correo a minúsculas
    correo_lower = usuario.correo.lower()

    # Verificar si el correo ya existe (búsqueda en minúsculas)
    db_user = db.query(models.Usuario).filter(models.Usuario.correo == correo_lower).first()
    if db_user:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    # Hashear contraseña y crear usuario
    hashed_password = get_password_hash(usuario.password)
    user_data = usuario.dict(exclude={"password", "correo"})
    db_usuario = models.Usuario(**user_data, correo=correo_lower, password_hash=hashed_password)

    db.add(db_usuario)
    db.commit()
    db.refresh(db_usuario)
    return db_usuario

@router.get("/usuarios/operarios-disponibles", response_model=List[schemas.Usuario])
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

@router.get("/usuarios/me", response_model=schemas.UsuarioDetallado)
async def get_my_user_detalle(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2, 3]))
):
    """
    Permite a cualquier usuario obtener su propio perfil y estadísticas.
    """
    return await get_usuario_detalle(id_usuario=current_user.id_usuario, db=db, current_user=current_user)

@router.get("/usuarios/{id_usuario}", response_model=schemas.UsuarioDetallado)
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

@router.put("/usuarios/{id_usuario}", response_model=schemas.Usuario)
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

    # Restricciones para no-admins: no pueden cambiar correo, rol, estado, disponibilidad o activo
    if current_user.id_rol_fk != 1:
        for restricted in ["correo", "id_rol_fk", "estado", "disponibilidad", "activo"]:
            if restricted in update_data:
                del update_data[restricted]
                
    if "correo" in update_data and update_data["correo"]:
        correo_lower = update_data["correo"].lower()
        if db.query(models.Usuario).filter(models.Usuario.correo == correo_lower, models.Usuario.id_usuario != id_usuario).first():
            raise HTTPException(status_code=400, detail="El correo ya está registrado por otro usuario")
        update_data["correo"] = correo_lower

    # Manejar actualización de contraseña
    if "password" in update_data:
        db_usuario.password_hash = pwd_context.hash(update_data["password"])
        del update_data["password"]

    for key, value in update_data.items():
        setattr(db_usuario, key, value)

    db.commit()
    db.refresh(db_usuario)
    return db_usuario

@router.delete("/usuarios/{id_usuario}")
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

@router.patch("/usuarios/{id_usuario}/activar")
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
