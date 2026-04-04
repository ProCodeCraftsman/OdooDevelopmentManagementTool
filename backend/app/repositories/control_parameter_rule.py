from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.control_parameter_rule import ControlParameterRule
from app.repositories.base import BaseRepository


class ControlParameterRuleRepository(BaseRepository[ControlParameterRule]):
    def __init__(self, db: Session):
        super().__init__(ControlParameterRule, db)

    def get_all(self) -> List[ControlParameterRule]:
        return self.db.query(ControlParameterRule).all()

    def get_active(self) -> List[ControlParameterRule]:
        return self.db.query(ControlParameterRule).filter(ControlParameterRule.is_active == True).all()

    def get_by_state(self, request_state_name: str) -> Optional[ControlParameterRule]:
        return (
            self.db.query(ControlParameterRule)
            .filter(ControlParameterRule.request_state_name == request_state_name)
            .first()
        )

    def create(self, rule: ControlParameterRule) -> ControlParameterRule:
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def update(self, rule: ControlParameterRule) -> ControlParameterRule:
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def delete(self, id: int) -> bool:
        rule = self.get(id)
        if rule:
            self.db.delete(rule)
            self.db.commit()
            return True
        return False

    def toggle_active(self, id: int) -> Optional[ControlParameterRule]:
        rule = self.get(id)
        if rule:
            rule.is_active = not rule.is_active
            self.db.commit()
            self.db.refresh(rule)
            return rule
        return None

    def seed_default_rules(self) -> None:
        """Seed default control parameter rules based on the rule matrix."""
        existing = self.get_all()
        if existing:
            return  # Already seeded

        default_rules = [
            {
                "request_state_name": "Open - Request under Review",
                "allowed_type_categories": "ALL",
                "allowed_priorities": "ALL",
                "allowed_functional_categories": "ALL",
            },
            {
                "request_state_name": "Accepted - On Hold",
                "allowed_type_categories": "ALL",
                "allowed_priorities": "ALL",
                "allowed_functional_categories": "ALL",
            },
            {
                "request_state_name": "In Progress",
                "allowed_type_categories": "ALL",
                "allowed_priorities": "ALL",
                "allowed_functional_categories": "ALL",
            },
            {
                "request_state_name": "Testing (Dev)",
                "allowed_type_categories": "Development",
                "allowed_priorities": "ALL",
                "allowed_functional_categories": "ALL",
            },
            {
                "request_state_name": "Closed - Development",
                "allowed_type_categories": "Development",
                "allowed_priorities": "ALL",
                "allowed_functional_categories": "ALL",
            },
            {
                "request_state_name": "Deployed to Staging",
                "allowed_type_categories": "Development",
                "allowed_priorities": "ALL",
                "allowed_functional_categories": "ALL",
            },
            {
                "request_state_name": "UAT - Initiated",
                "allowed_type_categories": "Development",
                "allowed_priorities": "ALL",
                "allowed_functional_categories": "ALL",
            },
            {
                "request_state_name": "UAT - Completed",
                "allowed_type_categories": "Development",
                "allowed_priorities": "ALL",
                "allowed_functional_categories": "ALL",
            },
            {
                "request_state_name": "UAT - Failed",
                "allowed_type_categories": "Development",
                "allowed_priorities": "ALL",
                "allowed_functional_categories": "ALL",
            },
            {
                "request_state_name": "Deployed to Production",
                "allowed_type_categories": "Development",
                "allowed_priorities": "ALL",
                "allowed_functional_categories": "ALL",
            },
            {
                "request_state_name": "Closed - Configuration",
                "allowed_type_categories": "Non Development",
                "allowed_priorities": "ALL",
                "allowed_functional_categories": "ALL",
            },
            {
                "request_state_name": "Rejected",
                "allowed_type_categories": "ALL",
                "allowed_priorities": "ALL",
                "allowed_functional_categories": "ALL",
            },
            {
                "request_state_name": "Cancelled",
                "allowed_type_categories": "ALL",
                "allowed_priorities": "ALL",
                "allowed_functional_categories": "ALL",
            },
        ]

        for rule_data in default_rules:
            rule = ControlParameterRule(**rule_data)
            self.db.add(rule)

        self.db.commit()