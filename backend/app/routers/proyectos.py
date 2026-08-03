from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
import os
import shutil

from app import models, schemas
from app.database import get_db
from app.security import get_current_user, require_role

router = APIRouter(tags=["proyectos"])

# Asegurar carpeta de uploads
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)


@router.post("/proyectos/{id_proyecto}/subir-archivo")
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

@router.get("/proyectos", response_model=List[schemas.Proyecto])
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

@router.get("/proyectos/valida-equipos", response_model=List[schemas.ProyectoEquipoDetalle])
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
        "foto_render_url": p.foto_render_url,
        "avance_general": avance,
        "lider": p.lider,
        "id_operarios": [o.id_usuario for o in p.operarios]
    }

@router.post("/proyectos", response_model=schemas.Proyecto)
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

@router.put("/proyectos/{id_proyecto}", response_model=schemas.Proyecto)
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
            if tarea.estado != "finalizada":
                tarea.operarios = []

    update_data = proyecto_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_proyecto, key, value)

    db.commit()
    db.refresh(db_proyecto)
    return format_proyecto(db_proyecto, db)

@router.get("/proyectos/{id_proyecto}", response_model=schemas.Proyecto)
async def get_proyecto(
    id_proyecto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    p = db.query(models.Proyecto).filter(models.Proyecto.id_proyecto == id_proyecto).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    return format_proyecto(p, db)

@router.get("/proyectos/{id_proyecto}/reporte-detallado")
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

@router.delete("/proyectos/{id_proyecto}")
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

@router.post("/proyectos/{id_proyecto}/finalizar")
async def finalizar_proyecto_endpoint(
    id_proyecto: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    await finalizar_proyecto_logic(id_proyecto, db, current_user)
    return {"message": "Proyecto finalizado exitosamente. Personal liberado e inventario devuelto al global."}

@router.get("/proyectos/{id_proyecto}/estado-equipo", response_model=List[schemas.OperarioEstado])
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

@router.get("/proyectos/{id_proyecto}/operarios-libres", response_model=List[schemas.Usuario])
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

@router.post("/proyectos/configurar-equipo")
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

@router.delete("/proyectos/{id_proyecto}/equipo/{id_usuario}")
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
@router.post("/proyectos/trasladar-material")
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
