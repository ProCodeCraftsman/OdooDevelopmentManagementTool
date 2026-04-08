from typing import Optional
import bcrypt
from sqlalchemy.orm import Session
from app.models.user import User
from app.repositories.base import BaseRepository


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
        is_active: bool = True,
        role_ids: list[int] | None = None,
    ) -> User:
        from app.models.role import Role

        hashed_password = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user = User(
            username=username,
            email=email,
            hashed_password=hashed_password,
            is_active=is_active,
        )
        if role_ids:
            roles = self.db.query(Role).filter(Role.id.in_(role_ids)).all()
            user.roles = roles
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_user(
        self,
        user_id: int,
        username: str | None = None,
        email: str | None = None,
        password: str | None = None,
        is_active: bool | None = None,
        role_ids: list[int] | None = None,
    ) -> User | None:
        from app.models.role import Role

        user = self.get(user_id)
        if not user:
            return None

        if username is not None:
            user.username = username
        if email is not None:
            user.email = email
        if password is not None:
            user.hashed_password = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        if is_active is not None:
            user.is_active = is_active
        if role_ids is not None:
            roles = self.db.query(Role).filter(Role.id.in_(role_ids)).all()
            user.roles = roles

        self.db.commit()
        self.db.refresh(user)
        return user

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
