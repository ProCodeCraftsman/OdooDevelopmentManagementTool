import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.core.database import get_db
from app.models.base import Base
from app.models.user import User
from app.models.role import Role
from app.models.control_parameters import RequestType, RequestState, FunctionalCategory, Priority
from app.models.module import Module
from app.models.sync_record import SyncRecord
from app.models.environment import Environment
from app.models.development_request import RequestModuleLine, RequestReleasePlanLine
from app.core.security_matrix import RoleLevel


SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    admin_role = Role(id=1, name="Admin", priority=RoleLevel.ADMIN, is_active=True)
    pm_role = Role(id=2, name="PM", priority=RoleLevel.PM, is_active=True)
    dev_role = Role(id=3, name="Developer", priority=RoleLevel.DEVELOPER, is_active=True)
    db.add_all([admin_role, pm_role, dev_role])

    req_type_dev = RequestType(id=1, name="Bug Fix", category="Development", is_active=True)
    req_type_non_dev = RequestType(id=2, name="Documentation", category="Non Development", is_active=True)
    db.add_all([req_type_dev, req_type_non_dev])

    req_state_open = RequestState(id=1, name="Open - Under Review", category="Open", is_active=True, display_order=1)
    req_state_in_progress = RequestState(id=2, name="In Progress - Development", category="In Progress", is_active=True, display_order=2)
    req_state_testing = RequestState(id=4, name="In Progress - Testing (Dev)", category="In Progress", is_active=True, display_order=3)
    req_state_closed = RequestState(id=3, name="Closed - Released", category="Closed", is_active=True, display_order=4)
    db.add_all([req_state_open, req_state_in_progress, req_state_testing, req_state_closed])

    func_cat = FunctionalCategory(id=1, name="Sales", is_active=True)
    func_cat_inactive = FunctionalCategory(id=2, name="HR - Employee", is_active=False)
    db.add_all([func_cat, func_cat_inactive])

    priority = Priority(id=1, name="High", level=3, is_active=True)
    priority2 = Priority(id=2, name="Low", level=5, is_active=True)
    db.add_all([priority, priority2])

    dev_env = Environment(id=1, name="DEV", order=4, url="http://dev.local", db_name="dev_db", user="admin", encrypted_password=b"dummy")
    db.add(dev_env)

    module_hr = Module(id=1, name="hr_payroll", shortdesc="HR Payroll")
    module_sale = Module(id=2, name="sale_management", shortdesc="Sale Management")
    db.add_all([module_hr, module_sale])

    sync_record = SyncRecord(
        id=1, environment_id=1, module_id=1, version_major=17, version_minor=0,
        version_patch=1, version_build=5, version_string="17.0.1.5"
    )
    db.add(sync_record)

    db.commit()

    yield db

    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
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
def admin_user(db_session):
    from app.services.auth_service import auth_service
    hashed = auth_service.hash_password("testpassword")
    admin = User(
        id=1, username="admin", email="admin@test.com", hashed_password=hashed, is_admin=True, role_id=1
    )
    db_session.add(admin)
    db_session.commit()
    return admin


@pytest.fixture
def pm_user(db_session):
    from app.services.auth_service import auth_service
    hashed = auth_service.hash_password("testpassword")
    pm = User(
        id=2, username="pm", email="pm@test.com", hashed_password=hashed, role_id=2
    )
    db_session.add(pm)
    db_session.commit()
    return pm


@pytest.fixture
def dev_user(db_session):
    from app.services.auth_service import auth_service
    hashed = auth_service.hash_password("testpassword")
    dev = User(
        id=3, username="dev", email="dev@test.com", hashed_password=hashed, role_id=3
    )
    db_session.add(dev)
    db_session.commit()
    return dev


@pytest.fixture
def admin_headers(client, admin_user):
    response = client.post(
        "/api/v1/auth/token",
        json={"username": "admin", "password": "testpassword"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def pm_headers(client, pm_user):
    response = client.post(
        "/api/v1/auth/token",
        json={"username": "pm", "password": "testpassword"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def dev_headers(client, dev_user):
    response = client.post(
        "/api/v1/auth/token",
        json={"username": "dev", "password": "testpassword"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def open_request(client, admin_headers, dev_user):
    response = client.post(
        "/api/v1/development-requests/requests/",
        json={
            "request_type_id": 1,
            "functional_category_id": 1,
            "priority_id": 1,
            "description": "Open test request",
            "assigned_developer_id": dev_user.id,
        },
        headers=admin_headers,
    )
    return response.json()


@pytest.fixture
def closed_request(client, admin_headers, dev_user, db_session):
    from app.repositories.development_request import DevelopmentRequestRepository
    from app.repositories.request_state import RequestStateRepository

    response = client.post(
        "/api/v1/development-requests/requests/",
        json={
            "request_type_id": 1,
            "functional_category_id": 1,
            "priority_id": 1,
            "description": "Closed test request",
            "assigned_developer_id": dev_user.id,
        },
        headers=admin_headers,
    )
    request = response.json()

    repo = DevelopmentRequestRepository(db_session)
    state_repo = RequestStateRepository(db_session)
    closed_state = state_repo.get(3)

    req = repo.get(request["id"])
    req.request_state_id = closed_state.id
    req.request_close_date = datetime.utcnow()
    db_session.commit()

    return request


@pytest.fixture
def in_progress_request(client, admin_headers, dev_user, db_session):
    from app.repositories.development_request import DevelopmentRequestRepository
    from app.repositories.request_state import RequestStateRepository

    response = client.post(
        "/api/v1/development-requests/requests/",
        json={
            "request_type_id": 1,
            "functional_category_id": 1,
            "priority_id": 1,
            "description": "In Progress request",
            "assigned_developer_id": dev_user.id,
        },
        headers=admin_headers,
    )
    request = response.json()

    repo = DevelopmentRequestRepository(db_session)
    state_repo = RequestStateRepository(db_session)
    in_progress_state = state_repo.get(2)

    req = repo.get(request["id"])
    req.request_state_id = in_progress_state.id
    db_session.commit()

    return request


@pytest.fixture
def request_with_partial_deployment(client, admin_headers, dev_user, db_session):
    from app.repositories.development_request import DevelopmentRequestRepository
    from app.repositories.request_state import RequestStateRepository

    response = client.post(
        "/api/v1/development-requests/requests/",
        json={
            "request_type_id": 1,
            "functional_category_id": 1,
            "priority_id": 1,
            "description": "Request with partial deployment",
            "assigned_developer_id": dev_user.id,
        },
        headers=admin_headers,
    )
    request = response.json()

    repo = DevelopmentRequestRepository(db_session)
    state_repo = RequestStateRepository(db_session)
    closed_state = state_repo.get(3)

    req = repo.get(request["id"])
    req.request_state_id = closed_state.id
    req.request_close_date = datetime.utcnow()

    line1 = RequestReleasePlanLine(
        request_id=request["id"],
        release_plan_date=datetime.utcnow(),
        release_plan_status="Deployed to Production"
    )
    line2 = RequestReleasePlanLine(
        request_id=request["id"],
        release_plan_date=datetime.utcnow(),
        release_plan_status="Pending"
    )
    db_session.add_all([line1, line2])
    db_session.commit()

    return request


@pytest.fixture
def request_with_full_deployment(client, admin_headers, dev_user, db_session):
    from app.repositories.development_request import DevelopmentRequestRepository
    from app.repositories.request_state import RequestStateRepository

    response = client.post(
        "/api/v1/development-requests/requests/",
        json={
            "request_type_id": 1,
            "functional_category_id": 1,
            "priority_id": 1,
            "description": "Request with full deployment",
            "assigned_developer_id": dev_user.id,
        },
        headers=admin_headers,
    )
    request = response.json()

    repo = DevelopmentRequestRepository(db_session)
    state_repo = RequestStateRepository(db_session)
    closed_state = state_repo.get(3)

    req = repo.get(request["id"])
    req.request_state_id = closed_state.id
    req.request_close_date = datetime.utcnow()

    line1 = RequestReleasePlanLine(
        request_id=request["id"],
        release_plan_date=datetime.utcnow(),
        release_plan_status="Deployed to Production"
    )
    line2 = RequestReleasePlanLine(
        request_id=request["id"],
        release_plan_date=datetime.utcnow(),
        release_plan_status="Deployed to Production"
    )
    db_session.add_all([line1, line2])
    db_session.commit()

    return request


# =============================================================================
# CATEGORY 1: RBAC MATRIX & SECURITY BOUNDARIES
# =============================================================================

class TestRBACMatrixSecurityBoundaries:
    """Edge Case Tests for RBAC Matrix and Security Boundaries"""

    def test_1_1_sneaky_developer_priority_change(self, client, dev_headers, dev_user, open_request):
        """R3 tries to change Priority on Open ticket - should be rejected"""
        response = client.patch(
            f"/api/v1/development-requests/requests/{open_request['id']}",
            json={"priority_id": 2},
            headers=dev_headers,
        )
        assert response.status_code == 403
        assert "Unauthorized to edit fields" in response.json()["detail"]

    def test_1_2_closed_room_pm_cannot_edit(self, client, pm_headers, closed_request):
        """R2 (PM) tries to PATCH Closed ticket - should be rejected"""
        response = client.patch(
            f"/api/v1/development-requests/requests/{closed_request['id']}",
            json={"description": "New description"},
            headers=pm_headers,
        )
        assert response.status_code == 403

    def test_1_3_line_item_lockout_closed_ticket(self, client, dev_headers, closed_request):
        """R3 tries to POST module line to Closed ticket - should be rejected"""
        response = client.post(
            f"/api/v1/development-requests/requests/{closed_request['id']}/modules",
            json={
                "module_technical_name": "hr_payroll",
                "module_version": "17.0.1.5",
            },
            headers=dev_headers,
        )
        assert response.status_code == 403
        assert "closed requests" in response.json()["detail"].lower()

    def test_1_4_admin_can_edit_closed_ticket(self, client, admin_headers, closed_request):
        """R1 (Admin) can edit Closed ticket - should succeed"""
        response = client.patch(
            f"/api/v1/development-requests/requests/{closed_request['id']}",
            json={"comments": "Admin comment on closed ticket"},
            headers=admin_headers,
        )
        assert response.status_code == 200

    def test_1_5_developer_can_add_module_in_progress(self, client, dev_headers, in_progress_request):
        """R3 can add module lines in In Progress state - should succeed"""
        response = client.post(
            f"/api/v1/development-requests/requests/{in_progress_request['id']}/modules",
            json={
                "module_technical_name": "hr_payroll",
                "module_version": "17.0.1.5",
            },
            headers=dev_headers,
        )
        assert response.status_code == 200


# =============================================================================
# CATEGORY 2: STATE TRANSITIONS & BUSINESS LOGIC
# =============================================================================

class TestStateTransitionsBusinessLogic:
    """Edge Case Tests for State Transitions and Business Logic"""

    def test_2_1_non_dev_guardrail(self, client, admin_headers):
        """Non-Development type cannot transition to Testing/UAT states"""
        response = client.post(
            "/api/v1/development-requests/requests/",
            json={
                "request_type_id": 2,
                "functional_category_id": 1,
                "priority_id": 1,
                "description": "Documentation request",
                "request_state_id": 4,
            },
            headers=admin_headers,
        )
        assert response.status_code == 400
        assert "Non Development" in response.json()["detail"]

    def test_2_2_missing_developer(self, client, admin_headers):
        """Development type requires assigned developer"""
        response = client.post(
            "/api/v1/development-requests/requests/",
            json={
                "request_type_id": 1,
                "functional_category_id": 1,
                "priority_id": 1,
                "description": "Bug fix without developer",
            },
            headers=admin_headers,
        )
        assert response.status_code == 400
        assert "Assigned Developer is required" in response.json()["detail"]

    def test_2_3_reopen_without_comment(self, client, admin_headers, closed_request):
        """Reopen without mandatory comment - should return 422"""
        response = client.post(
            f"/api/v1/development-requests/requests/{closed_request['id']}/reopen",
            json={},
            headers=admin_headers,
        )
        assert response.status_code == 422

    def test_2_4_reopen_with_comment(self, client, admin_headers, closed_request, db_session):
        """Reopen with comment - should succeed, iteration++, close_date=null"""
        from app.repositories.development_request import DevelopmentRequestRepository

        initial_counter = db_session.query(RequestReleasePlanLine).filter(
            RequestReleasePlanLine.request_id == closed_request["id"]
        ).count()

        response = client.post(
            f"/api/v1/development-requests/requests/{closed_request['id']}/reopen",
            json={"comment": "Reopening for more work"},
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["iteration_counter"] == 2
        assert data["request_close_date"] is None
        assert "Reopened by" in data["comments"]


# =============================================================================
# CATEGORY 3: RELEASE PLAN & VERSION INTEGRITY
# =============================================================================

class TestReleasePlanVersionIntegrity:
    """Edge Case Tests for Release Plan and Version Integrity"""

    def test_3_1_partial_deployment_reopen(self, client, admin_headers, request_with_partial_deployment):
        """One deployed, one pending - reopen should succeed"""
        response = client.post(
            f"/api/v1/development-requests/requests/{request_with_partial_deployment['id']}/reopen",
            json={"comment": "Reopening partial deployment"},
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["iteration_counter"] == 2
        assert data["request_close_date"] is None

    def test_3_2_full_deployment_block(self, client, admin_headers, request_with_full_deployment):
        """All deployed - reopen should be blocked"""
        response = client.post(
            f"/api/v1/development-requests/requests/{request_with_full_deployment['id']}/reopen",
            json={"comment": "Try to reopen"},
            headers=admin_headers,
        )
        assert response.status_code == 400
        assert "deployed to production" in response.json()["detail"].lower()

    def test_3_3_ghost_module_version(self, client, admin_headers, open_request):
        """Non-existent version should be rejected"""
        response = client.post(
            f"/api/v1/development-requests/requests/{open_request['id']}/modules",
            json={
                "module_technical_name": "hr_payroll",
                "module_version": "99.0.0.0",
            },
            headers=admin_headers,
        )
        assert response.status_code == 400
        assert "version" in response.json()["detail"].lower()


# =============================================================================
# CATEGORY 4: DATABASE ANOMALIES
# =============================================================================

class TestDatabaseAnomalies:
    """Edge Case Tests for Database Anomalies"""

    def test_4_1_soft_delete_orphan(self, client, admin_headers, db_session):
        """Historical ticket with soft-deleted category should still return"""
        from app.models.development_request import DevelopmentRequest
        from app.repositories.development_request import DevelopmentRequestRepository

        inactive_cat = db_session.query(FunctionalCategory).filter(FunctionalCategory.id == 2).first()
        assert inactive_cat.is_active is False

        inactive_cat_req = DevelopmentRequest(
            request_number="REQ-TEST-001",
            request_type_id=1,
            functional_category_id=2,
            request_state_id=1,
            priority_id=1,
            description="Request with soft-deleted category",
            assigned_developer_id=3,
        )
        db_session.add(inactive_cat_req)
        db_session.commit()

        repo = DevelopmentRequestRepository(db_session)
        request = repo.get_with_relations(inactive_cat_req.id)

        assert request.functional_category is not None
        assert request.functional_category.name == "HR - Employee"

    def test_4_2_circular_parent(self, client, admin_headers, dev_user, db_session):
        """A->B then B->A should be rejected"""
        resp_a = client.post(
            "/api/v1/development-requests/requests/",
            json={
                "request_type_id": 1,
                "functional_category_id": 1,
                "priority_id": 1,
                "description": "Request A",
                "assigned_developer_id": dev_user.id,
            },
            headers=admin_headers,
        )
        req_a_id = resp_a.json()["id"]

        resp_b = client.post(
            "/api/v1/development-requests/requests/",
            json={
                "request_type_id": 1,
                "functional_category_id": 1,
                "priority_id": 1,
                "description": "Request B",
                "assigned_developer_id": dev_user.id,
            },
            headers=admin_headers,
        )
        req_b_id = resp_b.json()["id"]

        client.patch(
            f"/api/v1/development-requests/requests/{req_b_id}",
            json={"parent_request_id": req_a_id},
            headers=admin_headers,
        )

        response = client.patch(
            f"/api/v1/development-requests/requests/{req_a_id}",
            json={"parent_request_id": req_b_id},
            headers=admin_headers,
        )
        assert response.status_code == 400
        assert "circular" in response.json()["detail"].lower()

    def test_4_3_self_reference_parent(self, client, admin_headers, open_request):
        """Cannot set own ID as parent"""
        response = client.patch(
            f"/api/v1/development-requests/requests/{open_request['id']}",
            json={"parent_request_id": open_request["id"]},
            headers=admin_headers,
        )
        assert response.status_code == 400
        assert "own parent" in response.json()["detail"].lower()

    def test_4_4_module_line_delete_from_closed(self, client, dev_headers, in_progress_request):
        """Developer can delete module line in In Progress"""
        add_response = client.post(
            f"/api/v1/development-requests/requests/{in_progress_request['id']}/modules",
            json={
                "module_technical_name": "hr_payroll",
                "module_version": "17.0.1.5",
            },
            headers=dev_headers,
        )
        assert add_response.status_code == 200
        line_id = add_response.json()["id"]

        delete_response = client.delete(
            f"/api/v1/development-requests/requests/{in_progress_request['id']}/modules/{line_id}",
            headers=dev_headers,
        )
        assert delete_response.status_code == 204


# =============================================================================
# EXISTING TESTS (preserved for regression)
# =============================================================================

class TestControlParametersEndpoint:
    def test_list_control_parameters_requires_auth(self, client):
        response = client.get("/api/v1/development-requests/control-parameters/")
        assert response.status_code == 401

    def test_list_control_parameters(self, client, admin_headers):
        response = client.get(
            "/api/v1/development-requests/control-parameters/",
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "request_types" in data
        assert "request_states" in data
        assert "functional_categories" in data
        assert "priorities" in data


class TestDevelopmentRequestEndpoints:
    def test_create_request_requires_auth(self, client):
        response = client.post(
            "/api/v1/development-requests/requests/",
            json={
                "request_type_id": 1,
                "functional_category_id": 1,
                "priority_id": 1,
                "description": "Test request",
                "assigned_developer_id": 2,
            },
        )
        assert response.status_code == 401

    def test_create_development_request_requires_developer(self, client, admin_headers):
        response = client.post(
            "/api/v1/development-requests/requests/",
            json={
                "request_type_id": 1,
                "functional_category_id": 1,
                "priority_id": 1,
                "description": "Test request",
            },
            headers=admin_headers,
        )
        assert response.status_code == 400
        assert "Assigned Developer is required" in response.json()["detail"]

    def test_create_request_success(self, client, admin_headers, dev_user):
        response = client.post(
            "/api/v1/development-requests/requests/",
            json={
                "request_type_id": 1,
                "functional_category_id": 1,
                "priority_id": 1,
                "description": "Test request",
                "assigned_developer_id": dev_user.id,
            },
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "request_number" in data
        assert data["request_number"].startswith("REQ-")
        assert data["description"] == "Test request"
        assert "permissions" in data

    def test_list_requests(self, client, admin_headers, dev_user):
        client.post(
            "/api/v1/development-requests/requests/",
            json={
                "request_type_id": 1,
                "functional_category_id": 1,
                "priority_id": 1,
                "description": "Test request",
                "assigned_developer_id": dev_user.id,
            },
            headers=admin_headers,
        )
        response = client.get(
            "/api/v1/development-requests/requests/",
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_request_with_permissions(self, client, admin_headers, dev_user):
        create_response = client.post(
            "/api/v1/development-requests/requests/",
            json={
                "request_type_id": 1,
                "functional_category_id": 1,
                "priority_id": 1,
                "description": "Test request",
                "assigned_developer_id": dev_user.id,
            },
            headers=admin_headers,
        )
        request_id = create_response.json()["id"]

        response = client.get(
            f"/api/v1/development-requests/requests/{request_id}",
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "permissions" in data
        assert data["permissions"]["can_edit_priority"] is True
        assert data["permissions"]["can_edit_state"] is True

    def test_developer_permissions_in_open_state(self, client, admin_headers, dev_headers, dev_user):
        create_response = client.post(
            "/api/v1/development-requests/requests/",
            json={
                "request_type_id": 1,
                "functional_category_id": 1,
                "priority_id": 1,
                "description": "Test request",
                "assigned_developer_id": dev_user.id,
            },
            headers=admin_headers,
        )
        request_id = create_response.json()["id"]

        response = client.get(
            f"/api/v1/development-requests/requests/{request_id}",
            headers=dev_headers,
        )
        data = response.json()
        assert data["permissions"]["can_edit_priority"] is False
        assert data["permissions"]["can_edit_state"] is False
        assert data["permissions"]["current_role_level"] == 3

    def test_update_request_respects_security_matrix(self, client, admin_headers, dev_headers, dev_user):
        create_response = client.post(
            "/api/v1/development-requests/requests/",
            json={
                "request_type_id": 1,
                "functional_category_id": 1,
                "priority_id": 1,
                "description": "Test request",
                "assigned_developer_id": dev_user.id,
            },
            headers=admin_headers,
        )
        request_id = create_response.json()["id"]

        response = client.patch(
            f"/api/v1/development-requests/requests/{request_id}",
            json={"priority_id": 2},
            headers=dev_headers,
        )
        assert response.status_code == 403
        assert "Unauthorized to edit fields" in response.json()["detail"]

    def test_admin_can_update_request(self, client, admin_headers, dev_user):
        create_response = client.post(
            "/api/v1/development-requests/requests/",
            json={
                "request_type_id": 1,
                "functional_category_id": 1,
                "priority_id": 1,
                "description": "Test request",
                "assigned_developer_id": dev_user.id,
            },
            headers=admin_headers,
        )
        request_id = create_response.json()["id"]

        response = client.patch(
            f"/api/v1/development-requests/requests/{request_id}",
            json={"comments": "Updated by admin"},
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert response.json()["comments"] == "Updated by admin"

    def test_reopen_request_not_found(self, client, admin_headers):
        response = client.post(
            "/api/v1/development-requests/requests/999/reopen",
            json={"comment": "Reopen test"},
            headers=admin_headers,
        )
        assert response.status_code == 404
