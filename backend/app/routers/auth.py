from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.security import verify_password, create_access_token

router = APIRouter(tags=["auth"])


@router.post("/auth/login", response_model=schemas.Token)
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

        access_token = create_access_token(
            data={"sub": user.correo, "role": user.id_rol_fk, "nombre": user.nombre, "apellido": user.apellido}
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG - Login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auth/solicitar-recuperacion")
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
