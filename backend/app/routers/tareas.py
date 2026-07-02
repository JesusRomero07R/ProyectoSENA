from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from app import models, schemas
from app.database import get_db
from app.security import require_role

router = APIRouter(tags=["tareas"])


@router.get("/tareas/mis-tareas", response_model=List[schemas.TareaOperario])
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

@router.get("/tareas/mis-tareas/{id_tarea}", response_model=schemas.TareaDetalleOperario)
def get_my_task_detail(
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

        # Obtener nombre del operario que reportó
        operario = db.query(models.Usuario).filter(models.Usuario.id_usuario == r.id_operario_fk).first()
        nombre_operario = f"{operario.nombre} {operario.apellido}" if operario else "Desconocido"

        historial_final.append({
            "id_reporte": r.id_reporte,
            "id_tarea_fk": r.id_tarea_fk,
            "id_operario_fk": r.id_operario_fk,
            "nombre_operario": nombre_operario,
            "fecha_reporte": r.fecha_reporte,
            "porcentaje": r.porcentaje,
            "observaciones": r.observaciones,
            "foto_url": r.foto_url,
            "horas_trabajadas": r.horas_trabajadas,
            "materiales_detalles": m_detalles
        })

    finalizador_nombre = None
    if tarea.id_usuario_finalizado_fk and tarea.finalizador:
        finalizador_nombre = f"{tarea.finalizador.nombre} {tarea.finalizador.apellido}"

    # Eventos de ciclo de vida (finalizaciones, reactivaciones)
    eventos = db.query(models.EventoTarea).filter(models.EventoTarea.id_tarea_fk == id_tarea).order_by(models.EventoTarea.fecha).all()
    eventos_historial = []
    for ev in eventos:
        nombre_usuario = f"{ev.usuario.nombre} {ev.usuario.apellido}" if ev.usuario else "Desconocido"
        eventos_historial.append({
            "tipo": ev.tipo,
            "motivo": ev.motivo,
            "nombre_usuario": nombre_usuario,
            "fecha": ev.fecha.isoformat() if ev.fecha else None
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
        "historial_reportes": historial_final,
        "finalizador_nombre": finalizador_nombre,
        "motivo_finalizacion": tarea.motivo_finalizacion,
        "eventos_historial": eventos_historial
    }

@router.post("/tareas", response_model=schemas.Tarea)
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

@router.get("/proyectos/{id_proyecto}/tareas", response_model=List[schemas.TareaDetallada])
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
            "operarios_ids": [o.id_usuario for o in tarea.operarios],
            "finalizador_nombre": f"{tarea.finalizador.nombre} {tarea.finalizador.apellido}" if tarea.finalizador else None
        })

    return resultado

@router.put("/tareas/{id_tarea}", response_model=schemas.Tarea)
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

    estado_anterior = db_tarea.estado

    # 3. Actualizar campos básicos
    update_data = tarea_update.dict(exclude={"id_operarios"}, exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_tarea, key, value)

    # REGLA DE AUDITORÍA: Si el estado cambia a 'finalizada', grabamos quién lo hizo
    if tarea_update.estado == "finalizada":
        db_tarea.id_usuario_finalizado_fk = current_user.id_usuario
        db_tarea.motivo_finalizacion = "finalizado_por_lider"
        db_tarea.avance = 100
        db.add(models.EventoTarea(id_tarea_fk=db_tarea.id_tarea, tipo="finalizada", motivo="finalizado_por_lider", id_usuario_fk=current_user.id_usuario))
    elif estado_anterior == "finalizada" and tarea_update.estado and tarea_update.estado != "finalizada":
        # Evento de reactivación
        db.add(models.EventoTarea(id_tarea_fk=db_tarea.id_tarea, tipo="reactivada", id_usuario_fk=current_user.id_usuario))
        # Si se reactiva, limpiamos el finalizador y el motivo
        db_tarea.id_usuario_finalizado_fk = None
        db_tarea.motivo_finalizacion = None
        # Si el líder reactiva la tarea, esta debe volver a 0% de avance
        db_tarea.avance = 0
        # Limpiar los operarios asociados para que se deba reasignar
        db_tarea.operarios = []

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

    # Recalcular el avance general del proyecto
    tareas_proyecto = db.query(models.Tarea).filter(models.Tarea.id_proyecto_fk == proyecto.id_proyecto).all()
    if tareas_proyecto:
        total_avance = sum(t.avance for t in tareas_proyecto)
        proyecto.avance_general = total_avance / len(tareas_proyecto)

    db.commit()
    db.refresh(db_tarea)
    return db_tarea

@router.delete("/tareas/{id_tarea}")
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
