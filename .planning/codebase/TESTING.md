# Testing Patterns

**Analysis Date:** 2026-04-05

## Test Framework

**Runner:**
- pytest 8.0.0+ (from `requirements.txt`)
- pytest-asyncio for async tests
- pytest-cov for coverage

**Assertion Library:**
- pytest built-in assertions (`assert`, `assert ... in`, etc.)

**Run Commands (from AGENTS.md):**
```bash
# Run all tests
pytest -v

# Run single test (RECOMMENDED)
pytest tests/test_services/test_comparer.py::test_comparer_returns_upgrade_when_source_greater -v

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run specific test file
pytest tests/test_api/test_auth.py
```

## Test File Organization

**Location:**
- Co-located under `backend/tests/`
- Directory structure mirrors app structure:
  ```
  backend/tests/
  ├── conftest.py                    # Shared fixtures
  ├── test_api/
  │   ├── test_auth.py
  │   ├── test_development_requests.py
  │   ├── test_environments.py
  │   ├── test_roles.py
  │   └── test_users.py
  ├── test_core/
  │   └── test_security_matrix.py
  ├── test_repositories/
  │   └── __init__.py
  └── test_services/
      ├── __init__.py
      ├── test_auth_service.py
      ├── test_comparer.py
      └── test_development_request_service.py
  ```

**Naming:**
- `test_*.py` for test files
- Classes prefixed with `Test` (e.g., `class TestParseSemver:`)
- Test functions prefixed with `test_` (e.g., `def test_parse_standard_version(self):`)

## Test Structure

**Suite Organization:**
```python
# From backend/tests/test_services/test_comparer.py
class TestParseSemver:
    def test_parse_standard_version(self):
        assert parse_semver("17.0.1.10") == (17, 0, 1, 10)

    def test_parse_empty_string_returns_none(self):
        assert parse_semver("") is None


class TestCalculateReleaseAction:
    def test_upgrade_needed(self):
        assert calculate_release_action("17.0.1.10", "17.0.1.9") == "Upgrade"
```

**Patterns:**
- Class-based grouping for related tests
- Single assertions or small assertion groups per test
- Descriptive test names: `test_{function}_{scenario}_{expected_result}`

## Fixtures and Mocks

**Location:**
- `backend/tests/conftest.py` for shared fixtures
- Local fixtures in test files for specific tests

**Shared Fixtures (`backend/tests/conftest.py`):**
```python
# Database fixtures
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

# Test client fixture
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

# User fixtures
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

# Auth fixtures
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
```

**Environment Setup in Fixtures:**
```python
import os
os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-testing-only-32chars"
os.environ["FERNET_KEY"] = Fernet.generate_key().decode()
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
```

## Mocking

**Framework:** `unittest.mock` (built-in)

**Patterns:**
```python
from unittest.mock import MagicMock, patch

# Mock repository/service
def test_non_development_cannot_transition_to_testing_state(self):
    service = DevelopmentRequestService(MagicMock())
    service.request_type_repo = MagicMock()
    service.request_type_repo.get.return_value = MockRequestType(1, "Non Development")
    
    with pytest.raises(HTTPException) as exc_info:
        service.validate_intra_parameter_rules({"request_type_id": 1})
    
    assert exc_info.value.status_code == 400

# Patch object
def test_validate_module_version_returns_true_when_dev_env_not_found(self):
    service = DevelopmentRequestService(MagicMock())
    with patch.object(service.db, "query") as mock_query:
        mock_query.return_value.filter.return_value.first.return_value = None
        result = service.validate_module_version("test_module", "1.0.0")
```

**Mock Classes Pattern:**
```python
class MockRequestType:
    def __init__(self, id: int, category: str):
        self.id = id
        self.category = category
```

## Coverage

**Requirements:** Not explicitly enforced

**View Coverage:**
```bash
pytest --cov=app --cov-report=term-missing
```

## Test Types

**Unit Tests:**
- `backend/tests/test_services/test_comparer.py` - pure function tests
- `backend/tests/test_services/test_auth_service.py` - service method tests

**Integration Tests:**
- `backend/tests/test_api/test_auth.py` - API endpoint tests with TestClient
- Use in-memory SQLite database

**E2E Tests:**
- Not used in backend

## Common Patterns

**Error Testing:**
```python
# From test_auth.py
def test_register_duplicate_username(self, client, sample_user):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "testuser",
            "email": "different@example.com",
            "password": "password123",
        },
    )
    assert response.status_code == 400
    assert "Username already registered" in response.json()["detail"]
```

**API Client Usage:**
```python
# Get test client with auth
response = client.post(
    "/api/v1/development-requests/requests/",
    json={"request_type_id": 1, ...},
    headers=admin_headers,
)
assert response.status_code == 200
```

---

*Testing analysis: 2026-04-05*
