from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
sys.path.insert(0, '/home/cristian/SENA ADSO/proyecto_constructora/constructora/backend')
from app import models, schemas
from app.database import SQLALCHEMY_DATABASE_URL
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()
tarea = db.query(models.Tarea).filter(models.Tarea.id_tarea == 1).first()
if not tarea: print("No tarea"); sys.exit(0)
from app.routers.tareas import get_my_task_detail
class MockUser: id_rol_fk = 2; id_usuario = 2
try:
    res = get_my_task_detail(id_tarea=1, db=db, current_user=MockUser())
    print("Success!", res)
except Exception as e:
    import traceback
    traceback.print_exc()
