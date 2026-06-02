import requests

API_URL = "http://localhost:8000"

def get_token():
    data = {"username": "admin@constructora-gg.com", "password": "admin123"}
    res = requests.post(f"{API_URL}/auth/login", data=data)
    return res.json()["access_token"]

def test_proyectos():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    res = requests.get(f"{API_URL}/proyectos", headers=headers)
    print(f"Status: {res.status_code}")
    print(f"Projects: {res.json()}")

if __name__ == "__main__":
    test_proyectos()
