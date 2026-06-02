import pytest

@pytest.mark.asyncio
async def test_login_success(client):
    # Arrange
    payload = {
        "username": "admin@constructora-gg.com",
        "password": "admin123"
    }
    
    # Act
    response = await client.post("/auth/login", data=payload)
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_login_invalid_credentials(client):
    # Arrange
    payload = {
        "username": "admin@constructora-gg.com",
        "password": "wrongpassword"
    }
    
    # Act
    response = await client.post("/auth/login", data=payload)
    
    # Assert
    assert response.status_code == 401
    assert response.json()["detail"] == "Contraseña incorrecta"

@pytest.mark.asyncio
async def test_login_user_not_found(client):
    # Arrange
    payload = {
        "username": "nonexistent@test.com",
        "password": "somepassword"
    }
    
    # Act
    response = await client.post("/auth/login", data=payload)
    
    # Assert
    assert response.status_code == 401
    assert response.json()["detail"] == "Correo no registrado o cuenta desactivada"
