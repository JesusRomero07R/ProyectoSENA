import pytest

@pytest.mark.asyncio
async def test_create_proyecto_admin_success(client_admin):
    # Arrange
    payload = {
        "nombre": "Edificio A",
        "descripcion": "Construcción habitacional",
        "ciudad": "Bogotá",
        "direccion": "Calle 100",
        "presupuesto": 1000000,
        "id_lider_fk": 2
    }
    
    # Act
    response = await client_admin.post("/proyectos", json=payload)
    
    # Assert
    assert response.status_code == 200
    assert response.json()["nombre"] == "Edificio A"
    assert response.json()["id_lider_fk"] == 2

@pytest.mark.asyncio
async def test_create_proyecto_lider_invalid_role(client_admin):
    # Arrange: El ID 3 es un operario
    payload = {
        "nombre": "Proyecto Fallido",
        "descripcion": "Construcción habitacional",
        "ciudad": "Bogotá",
        "direccion": "Calle 100",
        "presupuesto": 1000000,
        "id_lider_fk": 3
    }
    
    # Act
    response = await client_admin.post("/proyectos", json=payload)
    
    # Assert
    assert response.status_code == 400
    assert "no tiene permisos para ser líder" in response.json()["detail"]

@pytest.mark.asyncio
async def test_get_proyectos_admin_success(client_admin):
    # Act
    response = await client_admin.get("/proyectos")
    
    # Assert
    assert response.status_code == 200
    assert isinstance(response.json(), list)

@pytest.mark.asyncio
async def test_get_proyectos_allowed_for_operario(client_operario):
    # Act
    response = await client_operario.get("/proyectos")
    
    # Assert
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_configurar_equipo_success(client_admin):
    # 1. Crear proyecto primero
    proj_payload = {
        "nombre": "Proyecto Equipo",
        "descripcion": "Construcción habitacional",
        "ciudad": "Bogotá",
        "direccion": "Calle 100",
        "presupuesto": 1000000,
        "id_lider_fk": 2
    }
    proj_res = await client_admin.post("/proyectos", json=proj_payload)
    proj_id = proj_res.json()["id_proyecto"]
    
    # 2. Configurar equipo
    equipo_payload = {
        "id_proyecto": proj_id,
        "id_usuarios": [3]
    }
    
    # Act
    response = await client_admin.post("/proyectos/configurar-equipo", json=equipo_payload)
    
    # Assert
    assert response.status_code == 200
    assert response.json()["message"] == "Equipo configurado correctamente"

@pytest.mark.asyncio
async def test_asignar_operario_tarea_y_acceso_inventario(client_admin, client_lider, client_operario):
    # 1. Crear proyecto con líder David (id=2)
    proj_payload = {
        "nombre": "Proyecto Tareas",
        "descripcion": "Construcción",
        "ciudad": "Cali",
        "direccion": "Avenida 5",
        "presupuesto": 500000,
        "id_lider_fk": 2
    }
    proj_res = await client_admin.post("/proyectos", json=proj_payload)
    assert proj_res.status_code == 200
    proj_id = proj_res.json()["id_proyecto"]
    
    # 2. Crear una tarea para el proyecto y asignar al operario Pedro (id=3)
    # usando client_lider (David)
    task_payload = {
        "titulo": "Instalar tuberías",
        "descripcion": "Instalación de tuberías de agua",
        "id_proyecto_fk": proj_id,
        "id_operarios": [3]
    }
    task_res = await client_lider.post("/tareas", json=task_payload)
    assert task_res.status_code == 200
    
    # 3. Verificar que el operario Pedro puede acceder al inventario del proyecto
    # usando client_operario (Pedro)
    inv_res = await client_operario.get(f"/inventario/proyecto/{proj_id}")
    assert inv_res.status_code == 200

@pytest.mark.asyncio
async def test_reportar_avance_con_materiales_insuficientes(client_admin, client_lider, client_operario):
    from tests.conftest import override_get_db_sync
    import models
    db = next(override_get_db_sync())
    
    # 1. Crear categoría y material en DB
    cat = models.CategoriaMaterial(nombre_categoria="Herramientas")
    db.add(cat)
    db.commit()
    db.refresh(cat)
    
    mat = models.Material(nombre="Pala", id_categoria_fk=cat.id_categoria, unidad_medida="unid")
    db.add(mat)
    db.commit()
    db.refresh(mat)
    
    # 2. Crear proyecto
    proj = models.Proyecto(
        nombre="Proyecto Reportes",
        descripcion="Construcción",
        ciudad="Cali",
        direccion="Avenida 5",
        presupuesto=500000,
        id_lider_fk=2,
        estado="activo"
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    
    # 3. Crear tarea
    tarea = models.Tarea(
        titulo="Excavar zanja",
        id_proyecto_fk=proj.id_proyecto,
        estado="pendiente",
        avance=0
    )
    # Asignar operario Pedro (id=3)
    operario = db.query(models.Usuario).filter(models.Usuario.id_usuario == 3).first()
    tarea.operarios.append(operario)
    db.add(tarea)
    db.commit()
    db.refresh(tarea)
    
    # 4. Reportar avance con cantidad insuficiente (0 stock en proyecto)
    report_payload = {
        "id_tarea_fk": tarea.id_tarea,
        "porcentaje": 50,
        "observaciones": "Avance excavación",
        "horas_trabajadas": 4.5,
        "materiales_usados": [
            {"id_material": mat.id_material, "cantidad": 5}
        ]
    }
    
    response = await client_operario.post("/reportes", json=report_payload)
    assert response.status_code == 400
    assert "Stock insuficiente" in response.json()["detail"]
    
    # Verificar que se creó la SolicitudMaterial
    sol = db.query(models.SolicitudMaterial).filter(models.SolicitudMaterial.id_proyecto_fk == proj.id_proyecto).first()
    assert sol is not None
    assert sol.id_material_fk == mat.id_material
    assert sol.cantidad_solicitada == 5
    assert sol.estado_solicitud == "pendiente"

@pytest.mark.asyncio
async def test_reportar_avance_con_materiales_suficientes(client_admin, client_lider, client_operario):
    from tests.conftest import override_get_db_sync
    import models
    db = next(override_get_db_sync())
    
    # 1. Crear categoría y material
    cat = models.CategoriaMaterial(nombre_categoria="Construccion")
    db.add(cat)
    db.commit()
    db.refresh(cat)
    
    mat = models.Material(nombre="Cemento", id_categoria_fk=cat.id_categoria, unidad_medida="saco")
    db.add(mat)
    db.commit()
    db.refresh(mat)
    
    # 2. Crear proyecto
    proj = models.Proyecto(
        nombre="Proyecto Reportes 2",
        descripcion="Construcción",
        ciudad="Cali",
        direccion="Avenida 5",
        presupuesto=500000,
        id_lider_fk=2,
        estado="activo"
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    
    # 3. Crear stock en proyecto
    inv = models.InventarioProyecto(
        id_proyecto_fk=proj.id_proyecto,
        id_material_fk=mat.id_material,
        stock_actual=10,
        unidad_medida="saco"
    )
    db.add(inv)
    db.commit()
    
    # 4. Crear tarea
    tarea = models.Tarea(
        titulo="Cimentación",
        id_proyecto_fk=proj.id_proyecto,
        estado="pendiente",
        avance=0
    )
    operario = db.query(models.Usuario).filter(models.Usuario.id_usuario == 3).first()
    tarea.operarios.append(operario)
    db.add(tarea)
    db.commit()
    db.refresh(tarea)
    
    # 5. Reportar avance
    report_payload = {
        "id_tarea_fk": tarea.id_tarea,
        "porcentaje": 100,
        "observaciones": "Listo el cemento",
        "horas_trabajadas": 8.0,
        "materiales_usados": [
            {"id_material": mat.id_material, "cantidad": 4}
        ]
    }
    
    response = await client_operario.post("/reportes", json=report_payload)
    assert response.status_code == 200
    
    # Verificar stock reducido
    db.refresh(inv)
    assert inv.stock_actual == 6

@pytest.mark.asyncio
async def test_eliminar_reporte_avance(client_admin, client_lider, client_operario):
    from tests.conftest import override_get_db_sync
    import models
    db = next(override_get_db_sync())
    
    # 1. Crear categoría y material
    cat = models.CategoriaMaterial(nombre_categoria="Construccion E")
    db.add(cat)
    db.commit()
    db.refresh(cat)
    
    mat = models.Material(nombre="Cemento E", id_categoria_fk=cat.id_categoria, unidad_medida="saco")
    db.add(mat)
    db.commit()
    db.refresh(mat)
    
    # 2. Crear proyecto
    proj = models.Proyecto(
        nombre="Proyecto Reportes E",
        descripcion="Construcción",
        ciudad="Cali",
        direccion="Avenida 5",
        presupuesto=500000,
        id_lider_fk=2,
        estado="activo"
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    
    # 3. Crear stock en proyecto
    inv = models.InventarioProyecto(
        id_proyecto_fk=proj.id_proyecto,
        id_material_fk=mat.id_material,
        stock_actual=10,
        unidad_medida="saco"
    )
    db.add(inv)
    db.commit()
    
    # 4. Crear tarea
    tarea = models.Tarea(
        titulo="Cimentación E",
        id_proyecto_fk=proj.id_proyecto,
        estado="pendiente",
        avance=0
    )
    operario = db.query(models.Usuario).filter(models.Usuario.id_usuario == 3).first()
    tarea.operarios.append(operario)
    db.add(tarea)
    db.commit()
    db.refresh(tarea)
    
    # 5. Reportar avance
    report_payload = {
        "id_tarea_fk": tarea.id_tarea,
        "porcentaje": 50,
        "observaciones": "Listo el cemento E",
        "horas_trabajadas": 8.0,
        "materiales_usados": [
            {"id_material": mat.id_material, "cantidad": 4}
        ]
    }
    
    response = await client_operario.post("/reportes", json=report_payload)
    assert response.status_code == 200
    report_id = response.json()["id_reporte"]
    
    # Verificar stock reducido y tarea en progreso
    db.refresh(inv)
    db.refresh(tarea)
    assert inv.stock_actual == 6
    assert tarea.avance == 50
    assert tarea.estado == "en_progreso"
    
    # 6. Eliminar el reporte avance
    del_res = await client_operario.delete(f"/reportes/{report_id}")
    assert del_res.status_code == 200
    
    # Verificar stock restablecido y tarea pendiente / avance 0
    db.refresh(inv)
    db.refresh(tarea)
    assert inv.stock_actual == 10
    assert tarea.avance == 0
    assert tarea.estado == "pendiente"


@pytest.mark.asyncio
async def test_eliminar_reporte_tarea_finalizada_fail(client_admin, client_lider, client_operario):
    from tests.conftest import override_get_db_sync
    import models
    db = next(override_get_db_sync())
    
    # 1. Crear categoría y material
    cat = models.CategoriaMaterial(nombre_categoria="Construccion F")
    db.add(cat)
    db.commit()
    db.refresh(cat)
    
    mat = models.Material(nombre="Cemento F", id_categoria_fk=cat.id_categoria, unidad_medida="saco")
    db.add(mat)
    db.commit()
    db.refresh(mat)
    
    # 2. Crear proyecto
    proj = models.Proyecto(
        nombre="Proyecto Reportes F",
        descripcion="Construcción",
        ciudad="Medellin",
        direccion="Avenida 10",
        presupuesto=300000,
        id_lider_fk=2,
        estado="activo"
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    
    # 3. Crear stock en proyecto
    inv = models.InventarioProyecto(
        id_proyecto_fk=proj.id_proyecto,
        id_material_fk=mat.id_material,
        stock_actual=10,
        unidad_medida="saco"
    )
    db.add(inv)
    db.commit()
    
    # 4. Crear tarea
    tarea = models.Tarea(
        titulo="Cimentación F",
        id_proyecto_fk=proj.id_proyecto,
        estado="pendiente",
        avance=0
    )
    operario = db.query(models.Usuario).filter(models.Usuario.id_usuario == 3).first()
    tarea.operarios.append(operario)
    db.add(tarea)
    db.commit()
    db.refresh(tarea)
    
    # 5. Reportar avance al 100% (finaliza la tarea)
    report_payload = {
        "id_tarea_fk": tarea.id_tarea,
        "porcentaje": 100,
        "observaciones": "Listo el cemento F al 100%",
        "horas_trabajadas": 8.0,
        "materiales_usados": [
            {"id_material": mat.id_material, "cantidad": 4}
        ]
    }
    
    response = await client_operario.post("/reportes", json=report_payload)
    assert response.status_code == 200
    report_id = response.json()["id_reporte"]
    
    # Verificar que la tarea está finalizada
    db.refresh(tarea)
    assert tarea.avance == 100
    assert tarea.estado == "finalizada"
    
    # 6. Intentar eliminar el reporte avance (debe fallar con 400 ya que la tarea está finalizada)
    del_res = await client_operario.delete(f"/reportes/{report_id}")
    assert del_res.status_code == 400
    assert del_res.json()["detail"] == "No se pueden eliminar reportes de una tarea finalizada"


@pytest.mark.asyncio
async def test_reactivar_tarea_restaura_avance_y_finalizador(client_admin, client_lider, client_operario):
    from tests.conftest import override_get_db_sync
    import models
    db = next(override_get_db_sync())
    
    # 1. Crear categoría y material
    cat = models.CategoriaMaterial(nombre_categoria="Construccion R")
    db.add(cat)
    db.commit()
    db.refresh(cat)
    
    mat = models.Material(nombre="Cemento R", id_categoria_fk=cat.id_categoria, unidad_medida="saco")
    db.add(mat)
    db.commit()
    db.refresh(mat)
    
    # 2. Crear proyecto
    proj = models.Proyecto(
        nombre="Proyecto Reactivacion R",
        descripcion="Construcción",
        ciudad="Bogota",
        direccion="Calle 100",
        presupuesto=250000,
        id_lider_fk=2,
        estado="activo"
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    
    # 3. Crear stock en proyecto
    inv = models.InventarioProyecto(
        id_proyecto_fk=proj.id_proyecto,
        id_material_fk=mat.id_material,
        stock_actual=10,
        unidad_medida="saco"
    )
    db.add(inv)
    db.commit()
    
    # 4. Crear tarea
    tarea = models.Tarea(
        titulo="Cimentación R",
        id_proyecto_fk=proj.id_proyecto,
        estado="pendiente",
        avance=0
    )
    operario = db.query(models.Usuario).filter(models.Usuario.id_usuario == 3).first()
    tarea.operarios.append(operario)
    db.add(tarea)
    db.commit()
    db.refresh(tarea)
    
    # 5. Reportar avance al 45%
    report_payload = {
        "id_tarea_fk": tarea.id_tarea,
        "porcentaje": 45,
        "observaciones": "Avance del 45%",
        "horas_trabajadas": 4.0,
        "materiales_usados": []
    }
    
    response = await client_operario.post("/reportes", json=report_payload)
    assert response.status_code == 200
    
    db.refresh(tarea)
    assert tarea.avance == 45
    assert tarea.estado == "en_progreso"
    
    # 6. Finalizar la tarea por parte del líder
    finalizar_payload = {
        "estado": "finalizada"
    }
    res_finalizada = await client_lider.put(f"/tareas/{tarea.id_tarea}", json=finalizar_payload)
    assert res_finalizada.status_code == 200
    
    db.refresh(tarea)
    assert tarea.avance == 100
    assert tarea.estado == "finalizada"
    assert tarea.id_usuario_finalizado_fk == 2
    
    # 7. Reactivar la tarea por parte del líder
    reactivar_payload = {
        "estado": "en_progreso"
    }
    res_reactivada = await client_lider.put(f"/tareas/{tarea.id_tarea}", json=reactivar_payload)
    assert res_reactivada.status_code == 200
    
    db.refresh(tarea)
    assert tarea.avance == 0
    assert tarea.estado == "en_progreso"
    assert tarea.id_usuario_finalizado_fk is None





