import pytest


class TestEnvironmentEndpoints:
    def test_list_environments_empty(self, client, auth_headers):
        response = client.get("/api/v1/environments/", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_environments_requires_auth(self, client):
        response = client.get("/api/v1/environments/")
        assert response.status_code == 401

    def test_create_environment_success(self, client, admin_auth_headers):
        response = client.post(
            "/api/v1/environments/",
            headers=admin_auth_headers,
            json={
                "name": "TestEnv",
                "url": "https://test.example.com",
                "db_name": "test_db",
                "user": "admin",
                "password": "password123",
                "order": 1,
                "category": "development",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TestEnv"
        assert data["order"] == 1
        assert data["category"] == "development"

    def test_create_environment_duplicate_name(self, client, admin_auth_headers):
        client.post(
            "/api/v1/environments/",
            headers=admin_auth_headers,
            json={
                "name": "DuplicateEnv",
                "url": "https://test1.example.com",
                "db_name": "test_db",
                "user": "admin",
                "password": "password123",
            },
        )
        response = client.post(
            "/api/v1/environments/",
            headers=admin_auth_headers,
            json={
                "name": "DuplicateEnv",
                "url": "https://test2.example.com",
                "db_name": "test_db2",
                "user": "admin",
                "password": "password123",
            },
        )
        assert response.status_code == 400

    def test_get_environment_by_name(self, client, admin_auth_headers):
        client.post(
            "/api/v1/environments/",
            headers=admin_auth_headers,
            json={
                "name": "GetTest",
                "url": "https://test.example.com",
                "db_name": "test_db",
                "user": "admin",
                "password": "password123",
            },
        )
        response = client.get("/api/v1/environments/GetTest", headers=admin_auth_headers)
        assert response.status_code == 200
        assert response.json()["name"] == "GetTest"

    def test_get_environment_not_found(self, client, auth_headers):
        response = client.get("/api/v1/environments/Nonexistent", headers=auth_headers)
        assert response.status_code == 404

    def test_update_environment(self, client, admin_auth_headers):
        client.post(
            "/api/v1/environments/",
            headers=admin_auth_headers,
            json={
                "name": "UpdateTest",
                "url": "https://test.example.com",
                "db_name": "test_db",
                "user": "admin",
                "password": "password123",
                "order": 1,
            },
        )
        response = client.patch(
            "/api/v1/environments/UpdateTest",
            headers=admin_auth_headers,
            json={"order": 5, "category": "staging"},
        )
        assert response.status_code == 200
        assert response.json()["order"] == 5
        assert response.json()["category"] == "staging"

    def test_delete_environment(self, client, admin_auth_headers):
        client.post(
            "/api/v1/environments/",
            headers=admin_auth_headers,
            json={
                "name": "DeleteTest",
                "url": "https://test.example.com",
                "db_name": "test_db",
                "user": "admin",
                "password": "password123",
            },
        )
        response = client.delete("/api/v1/environments/DeleteTest", headers=admin_auth_headers)
        assert response.status_code == 204

        get_response = client.get("/api/v1/environments/DeleteTest", headers=admin_auth_headers)
        assert get_response.status_code == 404

    def test_create_environment_requires_admin(self, client, auth_headers):
        response = client.post(
            "/api/v1/environments/",
            headers=auth_headers,
            json={
                "name": "NonAdminEnv",
                "url": "https://test.example.com",
                "db_name": "test_db",
                "user": "admin",
                "password": "password123",
            },
        )
        assert response.status_code == 403
