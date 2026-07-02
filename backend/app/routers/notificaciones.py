from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app import models, schemas
from app.database import get_db
from app.security import require_role

router = APIRouter(tags=["notificaciones"])


@router.get("/notificaciones", response_model=List[schemas.Notificacion])
async def list_notificaciones(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(require_role([1]))
):
    return db.query(models.Notificacion).order_by(models.Notificacion.fecha_creacion.desc()).all()

@router.patch("/notificaciones/{id_notificacion}/leer")
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
