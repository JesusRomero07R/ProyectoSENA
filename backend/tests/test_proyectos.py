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
async def test_get_proyectos_forbidden_for_operario(client_operario):
    # Act
    response = await client_operario.get("/proyectos")
    
    # Assert
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_configurar_equipo_success(client_admin):
    # 1. Crear proyecto primero
    proj_payload = {
        "nombre": "Proyecto Equipo",
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
