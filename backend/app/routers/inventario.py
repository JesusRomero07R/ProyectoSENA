from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app import models, schemas
from app.database import get_db
from app.security import require_role

router = APIRouter(tags=["inventario"])


# --- Rutas de Inventario Global ---

@router.get("/inventario/proyecto/{id_proyecto}", response_model=List[schemas.InventarioProyecto])
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

@router.get("/inventario", response_model=List[schemas.InventarioGlobalDetailed])
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

@router.put("/materiales/{id_material}/stock", response_model=schemas.InventarioGlobal)
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
