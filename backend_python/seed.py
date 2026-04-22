import models
import database
from sqlalchemy.orm import Session
from passlib.context import CryptContext

# Configuración de hashing (Coincide con main.py)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_data():
    # 1. Asegurar que las tablas existan
    print("🚀 Iniciando creación de tablas...")
    models.Base.metadata.create_all(bind=database.engine)
    print("✅ Tablas verificadas/creadas.")

    db = database.SessionLocal()
    try:
        # 2. Insertar Roles (1: Admin, 2: Lider, 3: Operario)
        roles_default = [
            (1, "Admin"),
            (2, "Lider"),
            (3, "Operario")
        ]
        
        print("\n🛠️ Verificando roles...")
        for rid, rname in roles_default:
            role = db.query(models.Rol).filter(models.Rol.id_rol == rid).first()
            if not role:
                new_role = models.Rol(id_rol=rid, nombre_rol=rname)
                db.add(new_role)
                db.commit()
                print(f"   [+] Rol '{rname}' (ID: {rid}) creado.")
            else:
                print(f"   [ok] Rol '{rname}' ya existe.")

        # 3. Crear el Usuario Administrador
        admin_email = "admin@constructora-gg.com"
        admin_pass = "admin123"
        
        print(f"\n👤 Verificando usuario administrador ({admin_email})...")
        existing_admin = db.query(models.Usuario).filter(models.Usuario.correo == admin_email).first()
        
        if not existing_admin:
            hashed_pw = pwd_context.hash(admin_pass)
            admin_user = models.Usuario(
                nombre="Admin",
                apellido="GG",
                correo=admin_email,
                password_hash=hashed_pw,
                id_rol_fk=1, # Admin
                estado="activo",
                disponibilidad="disponible"
            )
            db.add(admin_user)
            db.commit()
            print(f"   [+] Administrador creado con éxito.")
            print(f"   🔑 Email: {admin_email}")
            print(f"   🔑 Pass:  {admin_pass}")
        else:
            print(f"   [ok] El usuario administrador ya existe.")

        print("\n✨ Proceso de inicialización completado con éxito.")

    except Exception as e:
        print(f"\n❌ Error durante la inicialización: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
