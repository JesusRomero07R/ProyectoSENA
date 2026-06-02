from datetime import datetime, timedelta
from jose import jwt

SECRET_KEY = "test_key"
ALGORITHM = "HS256"

def test_token():
    data = {"sub": "test@example.com"}
    token = jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)
    print(f"Token: {token}")
    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    print(f"Decoded: {decoded}")

if __name__ == "__main__":
    test_token()
