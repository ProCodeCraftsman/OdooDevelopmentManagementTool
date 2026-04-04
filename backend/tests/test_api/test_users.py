import pytest


class TestUserManagementEndpoints:
    """Test cases for User Management API endpoints - Functional & Technical"""

    def test_list_users_requires_admin(self, client, sample_user):
        """Functional: Non-admin users should be denied access"""
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "testuser", "password": "testpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get("/api/v1/users", headers=headers)
        
        assert response.status_code == 403
        assert "Not enough permissions" in response.json()["detail"]

    def test_list_users_as_admin(self, client, admin_user):
        """Functional: Admin users should be able to list all users"""
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get("/api/v1/users", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_get_user_by_id_as_admin(self, client, sample_user, admin_user):
        """Functional: Admin should be able to get user by ID"""
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get(f"/api/v1/users/{sample_user.id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert data["email"] == "test@example.com"

    def test_get_user_by_id_not_found(self, client, admin_user):
        """Functional: Should return 404 for non-existent user"""
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get("/api/v1/users/99999", headers=headers)
        
        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]

    def test_update_user_as_admin(self, client, sample_user, admin_user):
        """Functional: Admin should be able to update user details"""
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.patch(
            f"/api/v1/users/{sample_user.id}",
            headers=headers,
            json={
                "username": "updateduser",
                "is_active": False,
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "updateduser"
        assert data["is_active"] is False

    def test_update_user_set_role(self, client, db_session, admin_user):
        """Functional: Admin should be able to assign role to user"""
        from app.models.role import Role
        
        role = Role(name="Developer", priority=60)
        db_session.add(role)
        db_session.commit()
        
        from app.repositories.user import UserRepository
        user_repo = UserRepository(db_session)
        user = user_repo.create_user(
            username="newdev",
            email="dev@example.com",
            password="password123",
        )
        
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.patch(
            f"/api/v1/users/{user.id}",
            headers=headers,
            json={"role_id": role.id},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["role_id"] == role.id
        assert data["role"] is not None
        assert data["role"]["name"] == "Developer"

    def test_update_user_change_password(self, client, sample_user, admin_user):
        """Functional: Admin should be able to change user password"""
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.patch(
            f"/api/v1/users/{sample_user.id}",
            headers=headers,
            json={"password": "newpassword456"},
        )
        
        assert response.status_code == 200
        
        login_response = client.post(
            "/api/v1/auth/token",
            json={"username": "testuser", "password": "newpassword456"},
        )
        assert login_response.status_code == 200

    def test_update_user_duplicate_username(self, client, db_session, sample_user, admin_user):
        """Functional: Should fail when updating username to existing one"""
        from app.repositories.user import UserRepository
        user_repo = UserRepository(db_session)
        user_repo.create_user(
            username="user2",
            email="user2@example.com",
            password="password123",
        )
        
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.patch(
            f"/api/v1/users/{sample_user.id}",
            headers=headers,
            json={"username": "user2"},
        )
        
        assert response.status_code == 400
        assert "already taken" in response.json()["detail"]

    def test_update_user_duplicate_email(self, client, db_session, sample_user, admin_user):
        """Functional: Should fail when updating email to existing one"""
        from app.repositories.user import UserRepository
        user_repo = UserRepository(db_session)
        user_repo.create_user(
            username="user2",
            email="user2@example.com",
            password="password123",
        )
        
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.patch(
            f"/api/v1/users/{sample_user.id}",
            headers=headers,
            json={"email": "user2@example.com"},
        )
        
        assert response.status_code == 400
        assert "already taken" in response.json()["detail"]

    def test_delete_user_success(self, client, db_session, admin_user):
        """Functional: Admin should be able to delete user"""
        from app.repositories.user import UserRepository
        user_repo = UserRepository(db_session)
        user_to_delete = user_repo.create_user(
            username="todelete",
            email="todelete@example.com",
            password="password123",
        )
        
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.delete(f"/api/v1/users/{user_to_delete.id}", headers=headers)
        
        assert response.status_code == 204

    def test_delete_self_forbidden(self, client, admin_user):
        """Functional: Admin should not be able to delete themselves"""
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.delete(f"/api/v1/users/{admin_user.id}", headers=headers)
        
        assert response.status_code == 400
        assert "Cannot delete yourself" in response.json()["detail"]

    def test_delete_user_not_found(self, client, admin_user):
        """Functional: Should return 404 when deleting non-existent user"""
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.delete("/api/v1/users/99999", headers=headers)
        
        assert response.status_code == 404


class TestUserResponseSchema:
    """Technical tests for User response schema"""

    def test_user_response_includes_role(self, client, db_session, admin_user):
        """Technical: User response should include role information"""
        from app.models.role import Role
        
        role = Role(name="Tester", priority=50)
        db_session.add(role)
        db_session.commit()
        
        from app.repositories.user import UserRepository
        user_repo = UserRepository(db_session)
        user = user_repo.create_user(
            username="tester",
            email="tester@example.com",
            password="password123",
            role_id=role.id,
        )
        
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get(f"/api/v1/users/{user.id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "role_id" in data
        assert "role" in data
        assert data["role"]["name"] == "Tester"

    def test_user_response_without_role(self, client, sample_user, admin_user):
        """Technical: User without role should have null role"""
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get(f"/api/v1/users/{sample_user.id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "role_id" in data
        assert data["role_id"] is None
        assert data["role"] is None

    def test_user_response_fields(self, client, sample_user, admin_user):
        """Technical: Verify all expected fields are present"""
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "admin", "password": "adminpassword123"},
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = client.get(f"/api/v1/users/{sample_user.id}", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert "username" in data
        assert "email" in data
        assert "is_active" in data
        assert "is_admin" in data
        assert "role_id" in data
        
        assert isinstance(data["id"], int)
        assert isinstance(data["username"], str)
        assert isinstance(data["email"], str)
        assert isinstance(data["is_active"], bool)
        assert isinstance(data["is_admin"], bool)


class TestRegisterWithRole:
    """Test cases for user registration with roles"""

    def test_register_with_role(self, client, db_session):
        """Functional: New user should be able to register with role"""
        from app.models.role import Role
        
        role = Role(name="Developer", priority=60)
        db_session.add(role)
        db_session.commit()
        
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "newdeveloper",
                "email": "dev@example.com",
                "password": "password123",
                "role_id": role.id,
            },
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["role_id"] == role.id
        assert data["role"]["name"] == "Developer"

    def test_register_without_role(self, client):
        """Functional: User should be able to register without role"""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "norole",
                "email": "norole@example.com",
                "password": "password123",
            },
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["role_id"] is None
        assert data["role"] is None
