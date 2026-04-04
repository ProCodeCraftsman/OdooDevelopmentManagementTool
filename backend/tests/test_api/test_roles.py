import pytest


class TestRoleEndpoints:
    """Test cases for Role API endpoints - Functional & Technical"""

    def test_list_roles_returns_active_only(self, client, db_session):
        """Functional: Should return only active roles by default"""
        from app.models.role import Role
        from app.repositories.role import RoleRepository
        
        # Create active role
        role_repo = RoleRepository(db_session)
        role_repo.create_role(
            name="Active Role",
            description="An active role",
            priority=50,
        )
        
        # Create inactive role
        inactive_role = Role(
            name="Inactive Role",
            description="An inactive role",
            priority=40,
            is_active=False,
        )
        db_session.add(inactive_role)
        db_session.commit()
        
        response = client.get("/api/v1/roles")
        
        assert response.status_code == 200
        data = response.json()
        role_names = [r["name"] for r in data]
        assert "Active Role" in role_names
        assert "Inactive Role" not in role_names

    def test_list_all_roles_returns_both_active_and_inactive(self, client, db_session):
        """Functional: /all endpoint should return both active and inactive roles"""
        from app.models.role import Role
        
        # Create roles directly
        db_session.add(Role(name="Active", priority=50, is_active=True))
        db_session.add(Role(name="Inactive", priority=40, is_active=False))
        db_session.commit()
        
        response = client.get("/api/v1/roles/all")
        
        assert response.status_code == 200
        data = response.json()
        role_names = [r["name"] for r in data]
        assert "Active" in role_names
        assert "Inactive" in role_names

    def test_get_role_by_id_success(self, client, db_session):
        """Functional: Should return role when valid ID is provided"""
        from app.repositories.role import RoleRepository
        
        role_repo = RoleRepository(db_session)
        role = role_repo.create_role(
            name="Test Role",
            description="A test role",
            priority=75,
        )
        
        response = client.get(f"/api/v1/roles/{role.id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Role"
        assert data["description"] == "A test role"
        assert data["priority"] == 75
        assert data["is_active"] is True

    def test_get_role_by_id_not_found(self, client):
        """Functional: Should return 404 when role doesn't exist"""
        response = client.get("/api/v1/roles/99999")
        
        assert response.status_code == 404
        assert "Role not found" in response.json()["detail"]

    def test_create_role_success(self, client):
        """Functional: Should create role with valid data"""
        response = client.post(
            "/api/v1/roles",
            json={
                "name": "New Developer Role",
                "description": "Role for developers",
                "permissions": "modules:read,modules:write",
                "priority": 60,
            },
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Developer Role"
        assert data["description"] == "Role for developers"
        assert data["permissions"] == "modules:read,modules:write"
        assert data["priority"] == 60
        assert data["is_active"] is True
        assert "id" in data
        assert "created_at" in data

    def test_create_role_minimal_data(self, client):
        """Functional: Should create role with only required fields"""
        response = client.post(
            "/api/v1/roles",
            json={"name": "Minimal Role"},
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Minimal Role"
        assert data["description"] is None
        assert data["priority"] == 0

    def test_create_role_duplicate_name(self, client, db_session):
        """Functional: Should fail when creating role with existing name"""
        from app.repositories.role import RoleRepository
        
        role_repo = RoleRepository(db_session)
        role_repo.create_role(name="Existing Role")
        
        response = client.post(
            "/api/v1/roles",
            json={"name": "Existing Role"},
        )
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_update_role_success(self, client, db_session):
        """Functional: Should update role fields"""
        from app.repositories.role import RoleRepository
        
        role_repo = RoleRepository(db_session)
        role = role_repo.create_role(name="Old Name", priority=10)
        
        response = client.patch(
            f"/api/v1/roles/{role.id}",
            json={
                "name": "Updated Name",
                "priority": 90,
                "is_active": False,
            },
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["priority"] == 90
        assert data["is_active"] is False

    def test_update_role_partial(self, client, db_session):
        """Functional: Should update only provided fields"""
        from app.repositories.role import RoleRepository
        
        role_repo = RoleRepository(db_session)
        role = role_repo.create_role(
            name="Original",
            description="Original desc",
            priority=50,
        )
        
        response = client.patch(
            f"/api/v1/roles/{role.id}",
            json={"priority": 80},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Original"
        assert data["description"] == "Original desc"
        assert data["priority"] == 80

    def test_update_role_not_found(self, client):
        """Functional: Should return 404 when updating non-existent role"""
        response = client.patch(
            "/api/v1/roles/99999",
            json={"name": "New Name"},
        )
        
        assert response.status_code == 404

    def test_update_role_duplicate_name(self, client, db_session):
        """Functional: Should fail when updating to existing role name"""
        from app.repositories.role import RoleRepository
        
        role_repo = RoleRepository(db_session)
        role1 = role_repo.create_role(name="Role One")
        role2 = role_repo.create_role(name="Role Two")
        
        response = client.patch(
            f"/api/v1/roles/{role1.id}",
            json={"name": "Role Two"},
        )
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_delete_role_success(self, client, db_session):
        """Functional: Should delete existing role"""
        from app.repositories.role import RoleRepository
        
        role_repo = RoleRepository(db_session)
        role = role_repo.create_role(name="To Delete")
        
        response = client.delete(f"/api/v1/roles/{role.id}")
        
        assert response.status_code == 204
        
        # Verify deletion
        get_response = client.get(f"/api/v1/roles/{role.id}")
        assert get_response.status_code == 404

    def test_delete_role_not_found(self, client):
        """Functional: Should return 404 when deleting non-existent role"""
        response = client.delete("/api/v1/roles/99999")
        
        assert response.status_code == 404

    def test_role_response_schema(self, client):
        """Technical: Verify response contains all required fields"""
        response = client.post(
            "/api/v1/roles",
            json={"name": "Schema Test", "priority": 50},
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Verify schema fields
        assert "id" in data
        assert "name" in data
        assert "description" in data
        assert "permissions" in data
        assert "priority" in data
        assert "is_active" in data
        assert "created_at" in data
        assert "updated_at" in data
        
        # Verify types
        assert isinstance(data["id"], int)
        assert isinstance(data["name"], str)
        assert isinstance(data["priority"], int)
        assert isinstance(data["is_active"], bool)

    def test_roles_ordered_by_priority(self, client, db_session):
        """Technical: Roles should be ordered by priority descending"""
        from app.repositories.role import RoleRepository
        
        role_repo = RoleRepository(db_session)
        role_repo.create_role(name="Low Priority", priority=10)
        role_repo.create_role(name="High Priority", priority=100)
        role_repo.create_role(name="Medium Priority", priority=50)
        
        response = client.get("/api/v1/roles")
        
        assert response.status_code == 200
        data = response.json()
        priorities = [r["priority"] for r in data]
        assert priorities == sorted(priorities, reverse=True)


class TestRolePermissions:
    """Test cases for role permissions functionality"""

    def test_role_permissions_stored_as_text(self, client, db_session):
        """Technical: Permissions should be stored and retrieved correctly"""
        permissions = "modules:read,modules:write,environments:read"
        
        response = client.post(
            "/api/v1/roles",
            json={
                "name": "Perm Test",
                "permissions": permissions,
            },
        )
        
        assert response.status_code == 201
        assert response.json()["permissions"] == permissions

    def test_role_permissions_null_handling(self, client):
        """Technical: Null permissions should be handled"""
        response = client.post(
            "/api/v1/roles",
            json={"name": "No Permissions"},
        )
        
        assert response.status_code == 201
        assert response.json()["permissions"] is None

    def test_role_priority_bounds(self, client):
        """Technical: Priority should accept valid integer values"""
        # Test with zero
        response = client.post(
            "/api/v1/roles",
            json={"name": "Zero Priority", "priority": 0},
        )
        assert response.status_code == 201
        assert response.json()["priority"] == 0
        
        # Test with large value
        response = client.post(
            "/api/v1/roles",
            json={"name": "High Priority", "priority": 100},
        )
        assert response.status_code == 201
        assert response.json()["priority"] == 100
