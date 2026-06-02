import main
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def test_verify():
    plain = "admin123"
    hashed = pwd_context.hash(plain)
    print(f"Verified: {pwd_context.verify(plain, hashed)}")

if __name__ == "__main__":
    test_verify()
