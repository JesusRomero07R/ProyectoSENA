from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from app import models, schemas
from app.database import get_db
from app.security import require_role

router = APIRouter(tags=["materiales"])


# --- Rutas de Categorías de Materiales ---

@router.get("/categorias", response_model=List[schemas.CategoriaMaterial])
async def list_categorias(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1, 2]))
):
    return db.query(models.CategoriaMaterial).all()

@router.post("/categorias", response_model=schemas.CategoriaMaterial)
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

@router.get("/materiales", response_model=List[schemas.MaterialDetailed])
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

@router.post("/materiales", response_model=schemas.Material)
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

@router.put("/materiales/{id_material}/categoria", response_model=schemas.Material)
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

@router.delete("/materiales/{id_material}")
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
