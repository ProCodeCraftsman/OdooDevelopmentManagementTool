import pytest


class TestAuthEndpoints:
    def test_register_success(self, client):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "newpassword123",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@example.com"
        assert data["is_admin"] is False

    def test_register_admin(self, client):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "newadmin",
                "email": "newadmin@example.com",
                "password": "adminpassword123",
                "is_admin": True,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["is_admin"] is True

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

    def test_register_duplicate_email(self, client, sample_user):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "differentuser",
                "email": "test@example.com",
                "password": "password123",
            },
        )
        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]

    def test_login_success(self, client, sample_user):
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "testuser", "password": "testpassword123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, sample_user):
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "testuser", "password": "wrongpassword"},
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        response = client.post(
            "/api/v1/auth/token",
            json={"username": "nonexistent", "password": "password"},
        )
        assert response.status_code == 401

    def test_login_inactive_user(self, client, db_session):
        from app.repositories.user import UserRepository

        user_repo = UserRepository(db_session)
        user_repo.create_user(
            username="inactiveuser",
            email="inactive@example.com",
            password="password123",
            is_active=False,
        )

        response = client.post(
            "/api/v1/auth/token",
            json={"username": "inactiveuser", "password": "password123"},
        )
        assert response.status_code == 403
        assert "Inactive user" in response.json()["detail"]
