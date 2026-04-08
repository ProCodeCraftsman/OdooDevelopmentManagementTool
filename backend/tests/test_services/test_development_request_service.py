import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from app.services.development_request_service import DevelopmentRequestService


class MockRequestType:
    def __init__(self, id: int, category: str, name: str = "Mock Type"):
        self.id = id
        self.category = category
        self.name = name


class MockRequestState:
    def __init__(self, id: int, name: str):
        self.id = id
        self.name = name


class MockRole:
    def __init__(self, priority: int):
        self.priority = priority


class MockUser:
    def __init__(self, role_priority: int):
        self.role = MockRole(role_priority)
        self.username = "testuser"


class TestIntraParameterValidation:
    def test_disallowed_state_type_combination_is_rejected(self):
        service = DevelopmentRequestService(MagicMock())
        service.request_type_repo = MagicMock()
        service.request_type_repo.get.return_value = MockRequestType(1, "Non-development")
        service.request_state_repo = MagicMock()
        service.request_state_repo.get.return_value = MockRequestState(
            5, "Ready - QA Signoff"
        )
        service.rule_repo = MagicMock()
        service.rule_repo.seed_default_rules.return_value = None
        service.rule_repo.is_allowed.return_value = False

        with pytest.raises(HTTPException) as exc_info:
            service.validate_intra_parameter_rules(
                {"request_type_id": 1, "request_state_id": 5}
            )

        assert exc_info.value.status_code == 400
        assert "not allowed" in str(exc_info.value.detail)

    def test_allowed_state_type_combination_passes(self):
        service = DevelopmentRequestService(MagicMock())
        service.request_type_repo = MagicMock()
        service.request_type_repo.get.return_value = MockRequestType(1, "Non-development")
        service.request_state_repo = MagicMock()
        service.request_state_repo.get.return_value = MockRequestState(
            6, "Ready - Business Validation"
        )
        service.rule_repo = MagicMock()
        service.rule_repo.seed_default_rules.return_value = None
        service.rule_repo.is_allowed.return_value = True

        service.validate_intra_parameter_rules(
            {"request_type_id": 1, "request_state_id": 6}
        )

    def test_development_type_requires_developer_assignment(self):
        service = DevelopmentRequestService(MagicMock())
        service.request_type_repo = MagicMock()
        service.request_type_repo.get.return_value = MockRequestType(1, "Development")

        with pytest.raises(HTTPException) as exc_info:
            service.validate_intra_parameter_rules({"request_type_id": 1})

        assert exc_info.value.status_code == 400
        assert "Assigned Developer is required" in str(exc_info.value.detail)

    def test_development_type_allows_with_developer_assignment(self):
        service = DevelopmentRequestService(MagicMock())
        service.request_type_repo = MagicMock()
        service.request_type_repo.get.return_value = MockRequestType(1, "Development")
        service.request_state_repo = MagicMock()
        service.request_state_repo.get.return_value = MockRequestState(1, "Draft - Under Review")
        service.rule_repo = MagicMock()
        service.rule_repo.seed_default_rules.return_value = None
        service.rule_repo.is_allowed.return_value = True

        service.validate_intra_parameter_rules(
            {"request_type_id": 1, "request_state_id": 1, "assigned_developer_id": 5}
        )

    def test_development_type_raises_for_invalid_request_type(self):
        service = DevelopmentRequestService(MagicMock())
        service.request_type_repo = MagicMock()
        service.request_type_repo.get.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            service.validate_intra_parameter_rules({"request_type_id": 999})

        assert exc_info.value.status_code == 400


class TestReopenValidation:
    def test_reopen_blocked_when_all_release_plans_deployed(self):
        service = DevelopmentRequestService(MagicMock())
        service.release_plan_repo = MagicMock()
        service.release_plan_repo.all_deployed_to_production.return_value = True

        with pytest.raises(HTTPException) as exc_info:
            service.validate_reopen(1)

        assert exc_info.value.status_code == 400
        assert "deployed to production" in str(exc_info.value.detail).lower()

    def test_reopen_allowed_when_not_all_deployed(self):
        service = DevelopmentRequestService(MagicMock())
        service.release_plan_repo = MagicMock()
        service.release_plan_repo.all_deployed_to_production.return_value = False

        service.validate_reopen(1)


class TestModuleVersionValidation:
    def test_validate_module_version_returns_true_when_dev_env_not_found(self):
        service = DevelopmentRequestService(MagicMock())
        service.db = MagicMock()
        service.db.query.return_value.filter.return_value.first.return_value = None

        with patch.object(service.db, "query") as mock_query:
            mock_env = MagicMock()
            mock_env.name = "PROD"
            mock_query.return_value.filter.return_value.first.return_value = None

            result = service.validate_module_version("test_module", "1.0.0")
            assert result is True

    def test_validate_module_version_returns_false_for_invalid_version(self):
        service = DevelopmentRequestService(MagicMock())
        service.db = MagicMock()

        mock_env = MagicMock()
        mock_env.id = 1

        service.db.query.return_value.filter.return_value.first.return_value = mock_env
        service.db.query.return_value.join.return_value.filter.return_value.first.return_value = None

        result = service.validate_module_version("test_module", "invalid_version")
        assert result is False

    def test_validate_module_version_returns_true_for_valid_version(self):
        service = DevelopmentRequestService(MagicMock())
        service.db = MagicMock()

        mock_env = MagicMock()
        mock_env.id = 1

        mock_sync_record = MagicMock()
        service.db.query.return_value.join.return_value.filter.return_value.first.return_value = (
            mock_sync_record
        )
        service.db.query.return_value.filter.return_value.first.return_value = mock_env

        result = service.validate_module_version("test_module", "1.0.0")
        assert result is True
