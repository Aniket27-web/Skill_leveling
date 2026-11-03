import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings


def _fernet() -> Fernet:
    seed = settings.CREDENTIAL_ENCRYPTION_KEY
    if not seed:
        if settings.ENVIRONMENT.lower() == "production":
            raise RuntimeError("Set a strong CREDENTIAL_ENCRYPTION_KEY before storing provider credentials in production.")
        seed = settings.SECRET_KEY
    derived_key = base64.urlsafe_b64encode(hashlib.sha256(seed.encode("utf-8")).digest())
    return Fernet(derived_key)


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode("utf-8")).decode("ascii")


def decrypt_secret(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeError) as exc:
        raise RuntimeError("Stored provider credential cannot be decrypted. Check CREDENTIAL_ENCRYPTION_KEY.") from exc
