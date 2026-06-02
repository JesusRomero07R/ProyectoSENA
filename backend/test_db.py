import models
import database
from sqlalchemy.orm import Session

def test_query():
    db = database.SessionLocal()
    try:
        user = db.query(models.Usuario).filter(models.Usuario.correo == "admin@constructora-gg.com").first()
        if user:
            print(f"User found: {user.nombre}")
        else:
            print("User NOT found")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_query()
