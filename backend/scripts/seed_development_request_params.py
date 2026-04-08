import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.control_parameters import (
    RequestType,
    RequestState,
    FunctionalCategory,
    Priority,
)
from app.models.development_request_state_type_rule import (
    DevelopmentRequestStateTypeRule,
)


def seed_control_parameters(force: bool = False):
    def should_allow_default_pair(request_state: RequestState, request_type: RequestType) -> bool:
        if request_type.category == "Development":
            return True

        state_name = (request_state.name or "").lower()
        if "qa" in state_name:
            return False
        if "development" in state_name:
            return False
        if "released" in state_name:
            return False

        return True

    db = SessionLocal()
    try:
        if db.query(RequestType).count() > 0:
            if not force:
                print("Control parameters already seeded. Use --force to re-seed.")
                return
            # Truncate in dependency order before re-seeding
            for table in (
                "development_request_state_type_rules",
                "priorities",
                "functional_categories",
                "request_states",
                "request_types",
            ):
                db.execute(text(f"DELETE FROM {table}"))
                db.execute(text(f"ALTER SEQUENCE {table}_id_seq RESTART WITH 1"))
            db.commit()
            print("Existing control parameters cleared. Re-seeding...")

        request_types = [
            RequestType(
                name="Feature Request",
                category="Development",
                description="Request for a new feature",
                display_order=1,
            ),
            RequestType(
                name="Bug Report",
                category="Development",
                description="Report of a bug or defect",
                display_order=2,
            ),
            RequestType(
                name="Report Generation",
                category="Development",
                description="Request related to reporting features",
                display_order=3,
            ),
            RequestType(
                name="UI/UX",
                category="Development",
                description="Request for user interface or experience changes",
                display_order=4,
            ),
            RequestType(
                name="Master Data",
                category="Non-development",
                description="Request involving master data updates",
                display_order=5,
            ),
            RequestType(
                name="Performance Issue",
                category="Non-development",
                description="Report of system performance degradation",
                display_order=6,
            ),
            RequestType(
                name="Transactional Data",
                category="Non-development",
                description="Request involving transactional data",
                display_order=7,
            ),
            RequestType(
                name="Configurations",
                category="Non-development",
                description="Request for system configurations",
                display_order=8,
            ),
        ]

        request_states = [
            RequestState(
                name="Draft - Under Review",
                category="Draft",
                description="Request is under initial review",
                display_order=1,
            ),
            RequestState(
                name="Draft - Accepted On Hold",
                category="Draft",
                description="Request is accepted but currently on hold",
                display_order=2,
            ),
            RequestState(
                name="In Progress - Development",
                category="In Progress",
                description="Work is actively in progress",
                display_order=3,
            ),
            RequestState(
                name="In Progress - Configuration",
                category="In Progress",
                description="Configuration or non-code work is actively in progress",
                display_order=4,
            ),
            RequestState(
                name="Ready - QA Signoff",
                category="Ready",
                description="Implementation is complete and waiting for QA or technical signoff",
                display_order=5,
            ),
            RequestState(
                name="Ready - Business Validation",
                category="Ready",
                description="Implementation is complete and waiting for business confirmation",
                display_order=6,
            ),
            RequestState(
                name="Done - Released",
                category="Done",
                description="Request completed and released",
                display_order=7,
            ),
            RequestState(
                name="Done - Configuration Applied",
                category="Done",
                description="Request completed through configuration or data handling",
                display_order=8,
            ),
            RequestState(
                name="Cancelled",
                category="Cancelled",
                description="Request was cancelled",
                display_order=9,
            ),
            RequestState(
                name="Cancelled - Rejected",
                category="Cancelled",
                description="Request was rejected during review or execution",
                display_order=10,
            ),
        ]

        functional_categories = [
            FunctionalCategory(name="Finance Modules", description="Finance related requests", display_order=1),
            FunctionalCategory(name="PO Module", description="Purchase Order module requests", display_order=2),
            FunctionalCategory(name="General Tasks", description="General unclassified tasks", display_order=3),
            FunctionalCategory(name="Budget Module", description="Budget module requests", display_order=4),
            FunctionalCategory(name="Payment Request (PRQ)", description="Payment request module requests", display_order=5),
            FunctionalCategory(name="Sales Module", description="Sales module requests", display_order=6),
            FunctionalCategory(name="Expense Module", description="Expense module requests", display_order=7),
            FunctionalCategory(name="PR Module", description="Purchase Requisition module requests", display_order=8),
            FunctionalCategory(name="Project Module", description="Project module requests", display_order=9),
            FunctionalCategory(name="Inventory Module", description="Inventory management requests", display_order=10),
            FunctionalCategory(name="HR - Employee Module", description="HR and employee module requests", display_order=11),
            FunctionalCategory(name="GST Module", description="GST and tax module requests", display_order=12),
        ]

        priorities = [
            Priority(name="Low", level=1, display_order=1),
            Priority(name="Medium", level=2, display_order=2),
            Priority(name="High", level=3, display_order=3),
            Priority(name="Urgent", level=4, display_order=4),
        ]

        for obj in request_types + request_states + functional_categories + priorities:
            db.add(obj)

        db.commit()
        db.refresh(request_types[0])
        db.refresh(request_states[0])

        seeded_rules = 0
        for request_state in request_states:
            for request_type in request_types:
                if should_allow_default_pair(request_state, request_type):
                    db.add(
                        DevelopmentRequestStateTypeRule(
                            request_state_id=request_state.id,
                            request_type_id=request_type.id,
                            is_active=True,
                        )
                    )
                    seeded_rules += 1

        db.commit()
        print(f"Seeded {len(request_types)} request types")
        print(f"Seeded {len(request_states)} request states")
        print(f"Seeded {len(functional_categories)} functional categories")
        print(f"Seeded {len(priorities)} priorities")
        print(f"Seeded {seeded_rules} DR state-type rules")
        print("Control parameters seeded successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding control parameters: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed control parameters")
    parser.add_argument("--force", action="store_true", help="Clear existing data and re-seed")
    args = parser.parse_args()
    seed_control_parameters(force=args.force)
