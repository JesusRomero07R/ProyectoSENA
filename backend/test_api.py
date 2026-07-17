import sys
import app.routers.tareas as tareas
import inspect
print("Is async?", inspect.iscoroutinefunction(tareas.get_my_task_detail))
