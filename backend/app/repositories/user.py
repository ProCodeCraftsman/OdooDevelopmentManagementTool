from typing import Optional
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.models.user import User
from app.repositories.base import BaseRepository

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserRepository(BaseRepository[User]):
    def __init__(self, db: Session):
        super().__init__(User, db)

    def get_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    def create_user(
        self,
        username: str,
        email: str,
        password: str,
        is_admin: bool = False,
        is_active: bool = True,
        role_id: int | None = None,
    ) -> User:
        hashed_password = pwd_context.hash(password)
        user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            is_admin=is_admin,
            is_active=is_active,
            role_id=role_id,
        )
        return self.create(user)

    def update_user(
        self,
        user_id: int,
        username: str | None = None,
        email: str | None = None,
        password: str | None = None,
        is_admin: bool | None = None,
        is_active: bool | None = None,
        role_id: int | None = None,
    ) -> User | None:
        user = self.get(user_id)
        if not user:
            return None
        
        if username is not None:
            user.username = username
        if email is not None:
            user.email = email
        if password is not None:
            user.hashed_password = pwd_context.hash(password)
        if is_admin is not None:
            user.is_admin = is_admin
        if is_active is not None:
            user.is_active = is_active
        if role_id is not None:
            user.role_id = role_id
        
        self.db.commit()
        self.db.refresh(user)
        return user

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)
