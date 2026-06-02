import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_list_usuarios_admin_success(client_admin):
    # Act
    response = await client_admin.get("/usuarios")
    
    # Assert
    assert response.status_code == 200
    assert len(response.json()) >= 3 # Los 3 creados en setup_db

@pytest.mark.asyncio
async def test_list_usuarios_forbidden_for_lider(client_lider):
    # Act
    response = await client_lider.get("/usuarios")
    
    # Assert
    assert response.status_code == 403
    assert response.json()["detail"] == "No tienes permisos suficientes"

@pytest.mark.asyncio
async def test_create_usuario_admin_success(client_admin):
    # Arrange
    payload = {
        "nombre": "Nuevo",
        "apellido": "Usuario",
        "correo": "nuevo@test.com",
        "telefono": "123456",
        "id_rol_fk": 3,
        "password": "password123"
    }
    
    # Act
    response = await client_admin.post("/usuarios", json=payload)
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["correo"] == "nuevo@test.com"
    assert data["nombre"] == "Nuevo"

@pytest.mark.asyncio
async def test_create_usuario_duplicate_email(client_admin):
    # Arrange
    payload = {
        "nombre": "Duplicate",
        "apellido": "User",
        "correo": "admin@constructora-gg.com",
        "id_rol_fk": 1,
        "password": "password123"
    }
    
    # Act
    response = await client_admin.post("/usuarios", json=payload)
    
    # Assert
    assert response.status_code == 400
    assert response.json()["detail"] == "El correo ya está registrado"

@pytest.mark.asyncio
async def test_update_usuario_success(client_admin):
    # Arrange
    payload = {"nombre": "Admin Updated"}
    
    # Act
    response = await client_admin.put("/usuarios/1", json=payload)
    
    # Assert
    assert response.status_code == 200
    assert response.json()["nombre"] == "Admin Updated"

@pytest.mark.asyncio
async def test_delete_usuario_logical_success(client_admin):
    # Act
    response = await client_admin.delete("/usuarios/3")
    
    # Assert
    assert response.status_code == 200
    assert "desactivado" in response.json()["message"]
    
    # Verificar que ya no puede loguearse
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        login_res = await ac.post("/auth/login", data={
            "username": "pedro.operario@constructora-gg.com",
            "password": "operario123"
        })
        assert login_res.status_code == 401
