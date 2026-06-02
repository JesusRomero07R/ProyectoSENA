import requests

API_URL = "http://localhost:8000"

def test_health():
    try:
        res = requests.get(f"{API_URL}/health")
        print(f"Health check: {res.status_code} - {res.json()}")
    except Exception as e:
        print(f"Health check failed: {e}")

if __name__ == "__main__":
    test_health()
