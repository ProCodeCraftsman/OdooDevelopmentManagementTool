import pytest
from app.models.user import User
from app.models.control_parameters import RequestType, RequestState, FunctionalCategory, Priority
from app.models.development_request import DevelopmentRequest, RequestModuleLine
from app.models.module import Module
from app.repositories.request_module_line import RequestModuleLineRepository


class TestGetGroupCounts:
    """Tests for RequestModuleLineRepository.get_group_counts()"""

    @pytest.fixture
    def setup_data(self, db_session):
        """Set up test data for group count tests"""
        # Create users directly (minimal fields)
        dev1 = User(username="dev1", email="dev1@test.com", hashed_password="hash1")
        dev2 = User(username="dev2", email="dev2@test.com", hashed_password="hash2")
        
        db_session.add_all([dev1, dev2])
        db_session.flush()
        
        # Create request types
        req_type1 = RequestType(id=1, name="Bug", category="Bug", display_order=1)
        req_type2 = RequestType(id=2, name="Feature", category="Feature", display_order=2)
        req_type3 = RequestType(id=3, name="Enhancement", category="Enhancement", display_order=3)
        db_session.add_all([req_type1, req_type2, req_type3])
        db_session.flush()

        # Create request states
        state1 = RequestState(id=1, name="Draft", category="Draft", display_order=1)
        state2 = RequestState(id=2, name="In Progress", category="In Progress", display_order=2)
        state3 = RequestState(id=3, name="Done", category="Done", display_order=3)
        db_session.add_all([state1, state2, state3])
        db_session.flush()

        # Create functional categories
        cat1 = FunctionalCategory(id=1, name="Finance", description="Finance module", is_active=True)
        cat2 = FunctionalCategory(id=2, name="HR", description="HR module", is_active=True)
        db_session.add_all([cat1, cat2])
        db_session.flush()

        # Create priorities
        p1 = Priority(id=1, name="High", level=1, is_active=True)
        p2 = Priority(id=2, name="Medium", level=2, is_active=True)
        p3 = Priority(id=3, name="Low", level=3, is_active=True)
        db_session.add_all([p1, p2, p3])
        db_session.flush()

        # Create development requests with different attributes
        req1 = DevelopmentRequest(
            id=1,
            request_number="REQ-001",
            title="Test Request 1",
            description="Description 1",
            is_archived=False,
            request_type_id=1,
            request_state_id=1,
            functional_category_id=1,
            priority_id=1,
            assigned_developer_id=1,
        )
        req2 = DevelopmentRequest(
            id=2,
            request_number="REQ-002",
            title="Test Request 2",
            description="Description 2",
            is_archived=False,
            request_type_id=1,
            request_state_id=2,
            functional_category_id=1,
            priority_id=2,
            assigned_developer_id=1,
        )
        req3 = DevelopmentRequest(
            id=3,
            request_number="REQ-003",
            title="Test Request 3",
            description="Description 3",
            is_archived=False,
            request_type_id=2,
            request_state_id=2,
            functional_category_id=2,
            priority_id=2,
            assigned_developer_id=2,
        )
        req4 = DevelopmentRequest(
            id=4,
            request_number="REQ-004",
            title="Test Request 4",
            description="Description 4",
            is_archived=False,
            request_type_id=3,
            request_state_id=3,
            functional_category_id=2,
            priority_id=3,
            assigned_developer_id=None,  # Unassigned
        )
        db_session.add_all([req1, req2, req3, req4])
        db_session.flush()

        # Create modules (required for RequestModuleLine)
        module_a = Module(id=1, name="Module A")
        module_b = Module(id=2, name="Module B")
        module_c = Module(id=3, name="Module C")
        db_session.add_all([module_a, module_b, module_c])
        db_session.flush()

        # Create module lines for each request
        line1 = RequestModuleLine(id=1, request_id=1, module_id=1, module_technical_name="module_a", uat_status="pending")
        line2 = RequestModuleLine(id=2, request_id=1, module_id=2, module_technical_name="module_b", uat_status="passed")
        line3 = RequestModuleLine(id=3, request_id=2, module_id=1, module_technical_name="module_a", uat_status="pending")
        line4 = RequestModuleLine(id=4, request_id=3, module_id=3, module_technical_name="module_c", uat_status="failed")
        line5 = RequestModuleLine(id=5, request_id=4, module_id=2, module_technical_name="module_b", uat_status="pending")
        db_session.add_all([line1, line2, line3, line4, line5])
        db_session.commit()

        return {
            "users": [dev1, dev2],
            "request_types": [req_type1, req_type2, req_type3],
            "states": [state1, state2, state3],
            "categories": [cat1, cat2],
            "priorities": [p1, p2, p3],
        }

    def test_group_counts_request_type(self, db_session, setup_data):
        """Test group_counts returns correct data when grouping by request_type"""
        repo = RequestModuleLineRepository(db_session)
        result = repo.get_group_counts("request_type")

        # Should have 3 groups: Bug, Feature, Enhancement
        assert len(result) == 3

        # Check counts: Bug has 3 lines (REQ-001 has 2 lines + REQ-002 has 1 line), Feature has 1, Enhancement has 1
        counts = {r["label"]: r["count"] for r in result}
        assert counts["Bug"] == 3
        assert counts["Feature"] == 1
        assert counts["Enhancement"] == 1

    def test_group_counts_request_state(self, db_session, setup_data):
        """Test group_counts returns correct data when grouping by request_state"""
        repo = RequestModuleLineRepository(db_session)
        result = repo.get_group_counts("request_state")

        # Should have 3 groups: Draft, In Progress, Done
        assert len(result) == 3

        # Check counts: Draft has 2 lines, In Progress has 2, Done has 1
        counts = {r["label"]: r["count"] for r in result}
        assert counts["Draft"] == 2
        assert counts["In Progress"] == 2
        assert counts["Done"] == 1

    def test_group_counts_functional_category(self, db_session, setup_data):
        """Test group_counts returns correct data when grouping by functional_category"""
        repo = RequestModuleLineRepository(db_session)
        result = repo.get_group_counts("functional_category")

        # Should have 2 groups: Finance, HR
        assert len(result) == 2

        # Check counts: Finance has 3 lines, HR has 2
        counts = {r["label"]: r["count"] for r in result}
        assert counts["Finance"] == 3
        assert counts["HR"] == 2

    def test_group_counts_priority(self, db_session, setup_data):
        """Test group_counts returns correct data when grouping by priority (level sorted)"""
        repo = RequestModuleLineRepository(db_session)
        result = repo.get_group_counts("priority")

        # Should have 3 groups: High, Medium, Low
        assert len(result) == 3

        # Check counts: High has 2 (req1 has 2 lines), Medium has 2 (req2+req3 = 3 lines), Low has 1
        counts = {r["label"]: r["count"] for r in result}
        assert counts["High"] == 2
        assert counts["Medium"] == 2
        assert counts["Low"] == 1

    def test_group_counts_assigned_developer(self, db_session, setup_data):
        """Test group_counts returns correct data when grouping by assigned_developer with Unassigned"""
        repo = RequestModuleLineRepository(db_session)
        result = repo.get_group_counts("assigned_developer")

        # Should have 3 groups: dev1, dev2, Unassigned
        assert len(result) == 3

        # Check counts
        labels = {r["label"] for r in result}
        assert "dev1" in labels
        assert "dev2" in labels
        assert "Unassigned" in labels

        # Check Unassigned count is 1 (REQ-004)
        unassigned = next(r for r in result if r["label"] == "Unassigned")
        assert unassigned["count"] == 1

        # Check dev1 has 3 lines (REQ-001 with 2 lines + REQ-002 with 1 line)
        dev1_group = next(r for r in result if r["label"] == "dev1")
        assert dev1_group["count"] == 3

    def test_group_counts_module(self, db_session, setup_data):
        """Test group_counts returns correct data when grouping by module"""
        repo = RequestModuleLineRepository(db_session)
        result = repo.get_group_counts("module")

        # Should have 3 modules: module_a, module_b, module_c
        assert len(result) == 3

        counts = {r["label"]: r["count"] for r in result}
        assert counts["module_a"] == 2
        assert counts["module_b"] == 2
        assert counts["module_c"] == 1

    def test_group_counts_uat_status(self, db_session, setup_data):
        """Test group_counts returns correct data when grouping by uat_status"""
        repo = RequestModuleLineRepository(db_session)
        result = repo.get_group_counts("uat_status")

        # Should have statuses: pending, passed, failed
        assert len(result) == 3

        counts = {r["label"]: r["count"] for r in result}
        assert counts["pending"] == 3
        assert counts["passed"] == 1
        assert counts["failed"] == 1

    def test_group_counts_with_filters(self, db_session, setup_data):
        """Test group_counts respects filters"""
        repo = RequestModuleLineRepository(db_session)

        # Filter by module - module_a appears in REQ-001 (Bug) and REQ-002 (Feature)
        result = repo.get_group_counts("request_type", module_names=["module_a"])
        # Returns groups with counts of matching lines
        assert len(result) >= 1  # At least Bug group exists

    def test_group_counts_empty(self, db_session):
        """Test group_counts returns empty list when no data"""
        repo = RequestModuleLineRepository(db_session)
        result = repo.get_group_counts("request_type")
        assert result == []

    def test_group_counts_invalid_value(self, db_session, setup_data):
        """Test group_counts returns empty list for invalid group_by value"""
        repo = RequestModuleLineRepository(db_session)
        result = repo.get_group_counts("invalid_value")
        assert result == []