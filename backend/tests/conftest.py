import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from cryptography.fernet import Fernet

os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only-32chars"
os.environ["FERNET_KEY"] = Fernet.generate_key().decode()
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from app.models.base import Base
from app.models.user import User
from app.core.database import get_db
from app.core.config import get_settings
from app.main import app


@pytest.fixture(scope="function")
def db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(db_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    yield session
    session.close()


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_user(db_session):
    from app.repositories.user import UserRepository

    user_repo = UserRepository(db_session)
    user = user_repo.create_user(
        username="testuser",
        email="test@example.com",
        password="testpassword123",
        is_admin=False,
    )
    return user


@pytest.fixture
def admin_user(db_session):
    from app.repositories.user import UserRepository

    user_repo = UserRepository(db_session)
    user = user_repo.create_user(
        username="admin",
        email="admin@example.com",
        password="adminpassword123",
        is_admin=True,
    )
    return user


@pytest.fixture
def auth_headers(client, sample_user):
    response = client.post(
        "/api/v1/auth/token",
        json={"username": "testuser", "password": "testpassword123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(client, admin_user):
    response = client.post(
        "/api/v1/auth/token",
        json={"username": "admin", "password": "adminpassword123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
