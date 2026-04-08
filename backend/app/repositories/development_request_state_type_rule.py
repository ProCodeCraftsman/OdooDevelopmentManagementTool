from typing import List, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.control_parameters import RequestState, RequestType
from app.models.development_request_state_type_rule import (
    DevelopmentRequestStateTypeRule,
)
from app.repositories.base import BaseRepository


class DevelopmentRequestStateTypeRuleRepository(
    BaseRepository[DevelopmentRequestStateTypeRule]
):
    def __init__(self, db: Session):
        super().__init__(DevelopmentRequestStateTypeRule, db)

    def get_all(self) -> List[DevelopmentRequestStateTypeRule]:
        return (
            self.db.query(DevelopmentRequestStateTypeRule)
            .options(
                joinedload(DevelopmentRequestStateTypeRule.request_state),
                joinedload(DevelopmentRequestStateTypeRule.request_type),
            )
            .order_by(
                DevelopmentRequestStateTypeRule.request_state_id,
                DevelopmentRequestStateTypeRule.request_type_id,
            )
            .all()
        )

    def get_active_for_state(
        self, request_state_id: int
    ) -> List[DevelopmentRequestStateTypeRule]:
        return (
            self.db.query(DevelopmentRequestStateTypeRule)
            .options(
                joinedload(DevelopmentRequestStateTypeRule.request_type),
                joinedload(DevelopmentRequestStateTypeRule.request_state),
            )
            .filter(
                DevelopmentRequestStateTypeRule.request_state_id == request_state_id,
                DevelopmentRequestStateTypeRule.is_active == True,
            )
            .all()
        )

    def is_allowed(self, request_state_id: int, request_type_id: int) -> bool:
        active_rules = self.get_active_for_state(request_state_id)
        if not active_rules:
            return True
        return any(rule.request_type_id == request_type_id for rule in active_rules)

    def get_by_pair(
        self, request_state_id: int, request_type_id: int
    ) -> Optional[DevelopmentRequestStateTypeRule]:
        return self.get_by(
            request_state_id=request_state_id,
            request_type_id=request_type_id,
        )

    def _should_allow_default_pair(
        self,
        state: RequestState,
        request_type: RequestType,
    ) -> bool:
        if request_type.category == "Development":
            return True

        state_name = (state.name or "").lower()
        if "qa" in state_name:
            return False
        if "development" in state_name:
            return False
        if "released" in state_name:
            return False

        return True

    def seed_default_rules(self) -> None:
        existing_count = self.db.query(DevelopmentRequestStateTypeRule).count()
        if existing_count:
            return

        states = (
            self.db.query(RequestState)
            .filter(RequestState.is_active == True)
            .all()
        )
        types = (
            self.db.query(RequestType)
            .filter(RequestType.is_active == True)
            .all()
        )

        for state in states:
            for request_type in types:
                if self._should_allow_default_pair(state, request_type):
                    self.db.add(
                        DevelopmentRequestStateTypeRule(
                            request_state_id=state.id,
                            request_type_id=request_type.id,
                            is_active=True,
                        )
                    )

        self.db.commit()
