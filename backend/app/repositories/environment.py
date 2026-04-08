from typing import Optional, List
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session
from app.models.environment import Environment
from app.repositories.base import BaseRepository
from app.core.config import get_settings


class EnvironmentRepository(BaseRepository[Environment]):
    def __init__(self, db: Session):
        super().__init__(Environment, db)
        settings = get_settings()
        self._fernet = Fernet(settings.FERNET_KEY.encode()) if settings.FERNET_KEY else None

    def get_by_name(self, name: str) -> Optional[Environment]:
        return self.db.query(Environment).filter(Environment.name == name).first()

    def get_by_url(self, url: str) -> Optional[Environment]:
        return self.db.query(Environment).filter(Environment.url == url).first()

    def get_active(self) -> List[Environment]:
        return self.db.query(Environment).filter(Environment.is_active == True).all()

    def create_environment(
        self,
        name: str,
        url: str,
        db_name: str,
        user: str,
        password: str,
        order: int = 0,
        category: str = "unknown",
    ) -> Environment:
        encrypted_password = self._fernet.encrypt(password.encode()) if self._fernet else password.encode()
        env = Environment(
            name=name,
            url=url,
            db_name=db_name,
            user=user,
            encrypted_password=encrypted_password,
            order=order,
            category=category,
        )
        return self.create(env)

    def get_decrypted_password(self, env: Environment) -> str:
        if self._fernet and env.encrypted_password:
            return self._fernet.decrypt(env.encrypted_password).decode()
        return env.encrypted_password.decode() if env.encrypted_password else ""
