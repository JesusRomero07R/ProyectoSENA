from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import models, schemas
from app.database import get_db
from app.security import require_role

router = APIRouter(tags=["reportes"])


@router.post("/reportes", response_model=schemas.ReporteAvance)
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
        total_avance += (t.avance or 0)

    if tareas_proyecto:
        proyecto.avance_general = total_avance / len(tareas_proyecto)

        # Actualizar estado de la tarea
        if reporte.porcentaje >= 100:
            tarea.estado = "finalizada"
            tarea.id_usuario_finalizado_fk = current_user.id_usuario
            tarea.motivo_finalizacion = "progreso_completado"
            db.add(models.EventoTarea(id_tarea_fk=tarea.id_tarea, tipo="finalizada", motivo="progreso_completado", id_usuario_fk=current_user.id_usuario))
        elif reporte.porcentaje > 0:
            tarea.estado = "en_progreso"

    db.commit()
    db.refresh(db_reporte)
    return db_reporte

@router.delete("/reportes/{id_reporte}")
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

@router.get("/reportes", response_model=List[schemas.ReporteAvanceDetailed])
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
