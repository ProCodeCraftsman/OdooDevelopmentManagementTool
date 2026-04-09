import pytest
from app.models.control_parameters import (
    FunctionalCategory,
    Priority,
    RequestState,
    RequestType,
)
from app.models.development_request import DevelopmentRequest
from app.models.user import User
from app.services.dashboard_service import get_request_analysis


class TestGetRequestAnalysis:
    def test_returns_empty_when_no_requests(self, db_session):
        result = get_request_analysis(db_session)

        assert result.functional_categories == []
        assert result.priorities == []
        assert len(result.macro_state_chart) == 4
        assert all(len(s.data) == 0 for s in result.macro_state_chart)
        assert len(result.priority_chart) == 4
        assert all(len(s.data) == 0 for s in result.priority_chart)

    def test_returns_chart_data_for_development_requests(
        self, db_session, sample_user
    ):
        request_type = RequestType(id=1, name="Dev Type", category="Development")
        db_session.add(request_type)

        functional_cat = FunctionalCategory(
            id=1, name="Finance", description="Finance module", is_active=True
        )
        db_session.add(functional_cat)

        priority = Priority(id=1, name="High", level=1, is_active=True)
        db_session.add(priority)

        state = RequestState(
            id=1, name="Draft", category="Draft", is_active=True
        )
        db_session.add(state)

        db_session.add(
            DevelopmentRequest(
                id=1,
                request_number="REQ-001",
                request_type_id=1,
                functional_category_id=1,
                priority_id=1,
                request_state_id=1,
                assigned_developer_id=sample_user.id,
                is_archived=False,
                description="Test description",
            )
        )
        db_session.commit()

        result = get_request_analysis(db_session)

        assert len(result.functional_categories) == 1
        assert result.functional_categories[0].name == "Finance"

        assert len(result.priorities) == 1
        assert result.priorities[0].name == "High"

        assert len(result.macro_state_chart) == 4
        assert result.macro_state_chart[0].name == "Draft"
        assert len(result.macro_state_chart[0].data) == 1
        assert result.macro_state_chart[0].data[0].category == "Finance"
        assert result.macro_state_chart[0].data[0].value == 1
        assert result.macro_state_chart[1].data[0].value == 0

    def test_filters_by_category_ids(self, db_session, sample_user):
        request_type = RequestType(id=1, name="Dev Type", category="Development")
        db_session.add(request_type)

        finance = FunctionalCategory(
            id=1, name="Finance", description="Finance module", is_active=True
        )
        hr = FunctionalCategory(
            id=2, name="HR", description="HR module", is_active=True
        )
        db_session.add(finance)
        db_session.add(hr)

        priority = Priority(id=1, name="High", level=1, is_active=True)
        db_session.add(priority)

        state = RequestState(
            id=1, name="Draft", category="Draft", is_active=True
        )
        db_session.add(state)

        db_session.add(
            DevelopmentRequest(
                id=1,
                request_number="REQ-001",
                request_type_id=1,
                functional_category_id=1,
                priority_id=1,
                request_state_id=1,
                assigned_developer_id=sample_user.id,
                is_archived=False,
                description="Finance request",
            )
        )
        db_session.add(
            DevelopmentRequest(
                id=2,
                request_number="REQ-002",
                request_type_id=1,
                functional_category_id=2,
                priority_id=1,
                request_state_id=1,
                assigned_developer_id=sample_user.id,
                is_archived=False,
                description="HR request",
            )
        )
        db_session.commit()

        result = get_request_analysis(db_session, category_ids=[1])

        assert len(result.functional_categories) == 1
        assert result.functional_categories[0].name == "Finance"

        macro_state_data = result.macro_state_chart[0].data
        assert len(macro_state_data) == 1
        assert macro_state_data[0].category == "Finance"

    def test_groups_requests_by_macro_state(self, db_session, sample_user):
        request_type = RequestType(id=1, name="Dev Type", category="Development")
        db_session.add(request_type)

        functional_cat = FunctionalCategory(
            id=1, name="Finance", is_active=True
        )
        db_session.add(functional_cat)

        priority = Priority(id=1, name="High", level=1, is_active=True)
        db_session.add(priority)

        draft = RequestState(id=1, name="Draft", category="Draft", is_active=True)
        in_progress = RequestState(
            id=2, name="In Review", category="In Progress", is_active=True
        )
        db_session.add(draft)
        db_session.add(in_progress)

        db_session.add(
            DevelopmentRequest(
                id=1,
                request_number="REQ-001",
                request_type_id=1,
                functional_category_id=1,
                priority_id=1,
                request_state_id=1,
                assigned_developer_id=sample_user.id,
                is_archived=False,
                description="Draft request",
            )
        )
        db_session.add(
            DevelopmentRequest(
                id=2,
                request_number="REQ-002",
                request_type_id=1,
                functional_category_id=1,
                priority_id=1,
                request_state_id=2,
                assigned_developer_id=sample_user.id,
                is_archived=False,
                description="In progress request",
            )
        )
        db_session.commit()

        result = get_request_analysis(db_session)

        macro_state_names = [chart.name for chart in result.macro_state_chart]
        assert "Draft" in macro_state_names
        assert "In Progress" in macro_state_names

    def test_includes_priority_breakdown(self, db_session, sample_user):
        request_type = RequestType(id=1, name="Dev Type", category="Development")
        db_session.add(request_type)

        functional_cat = FunctionalCategory(
            id=1, name="Finance", is_active=True
        )
        db_session.add(functional_cat)

        critical = Priority(id=1, name="Critical", level=1, is_active=True)
        high = Priority(id=2, name="High", level=2, is_active=True)
        db_session.add(critical)
        db_session.add(high)

        state = RequestState(
            id=1, name="Draft", category="Draft", is_active=True
        )
        db_session.add(state)

        db_session.add(
            DevelopmentRequest(
                id=1,
                request_number="REQ-001",
                request_type_id=1,
                functional_category_id=1,
                priority_id=1,
                request_state_id=1,
                assigned_developer_id=sample_user.id,
                is_archived=False,
                description="Critical request",
            )
        )
        db_session.add(
            DevelopmentRequest(
                id=2,
                request_number="REQ-002",
                request_type_id=1,
                functional_category_id=1,
                priority_id=2,
                request_state_id=1,
                assigned_developer_id=sample_user.id,
                is_archived=False,
                description="High request",
            )
        )
        db_session.commit()

        result = get_request_analysis(db_session)

        data_point = result.macro_state_chart[0].data[0]
        assert data_point.value == 2
        priority_names = [pb.name for pb in data_point.priority_breakdown]
        assert "Critical" in priority_names
        assert "High" in priority_names

        critical_pb = next(
            pb for pb in data_point.priority_breakdown if pb.name == "Critical"
        )
        assert critical_pb.count == 1
