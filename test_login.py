import requests

API_URL = "http://localhost:8000"

def test_login():
    try:
        data = {"username": "admin@constructora-gg.com", "password": "admin123"}
        res = requests.post(f"{API_URL}/auth/login", data=data)
        print(f"Status Code: {res.status_code}")
        print(f"Response: {res.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_login()
