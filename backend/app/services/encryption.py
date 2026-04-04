from cryptography.fernet import Fernet, InvalidToken
from app.core.config import get_settings


class EncryptionService:
    def __init__(self):
        settings = get_settings()
        if settings.FERNET_KEY:
            try:
                self._fernet = Fernet(settings.FERNET_KEY.encode())
            except (ValueError, Exception):
                self._fernet = None
        else:
            self._fernet = None

    def encrypt(self, data: str) -> bytes:
        if not self._fernet:
            raise ValueError("FERNET_KEY not configured")
        return self._fernet.encrypt(data.encode())

    def decrypt(self, encrypted_data: bytes) -> str:
        if not self._fernet:
            raise ValueError("FERNET_KEY not configured")
        try:
            return self._fernet.decrypt(encrypted_data).decode()
        except InvalidToken:
            raise ValueError("Failed to decrypt data - invalid key or corrupted data")

    @staticmethod
    def generate_key() -> str:
        return Fernet.generate_key().decode()


encryption_service = EncryptionService()
