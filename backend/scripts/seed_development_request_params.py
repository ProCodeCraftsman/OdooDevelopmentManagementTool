import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal
from app.models.control_parameters import (
    RequestType,
    RequestState,
    FunctionalCategory,
    Priority,
)


def seed_control_parameters():
    db = SessionLocal()
    try:
        if db.query(RequestType).count() > 0:
            print("Control parameters already seeded. Skipping...")
            return

        request_types = [
            RequestType(
                name="New Feature",
                category="Development",
                description="Request for implementing a new feature",
                display_order=1,
            ),
            RequestType(
                name="Bug Fix",
                category="Development",
                description="Request for fixing a bug",
                display_order=2,
            ),
            RequestType(
                name="Enhancement",
                category="Development",
                description="Request for enhancing existing functionality",
                display_order=3,
            ),
            RequestType(
                name="Technical Debt",
                category="Development",
                description="Request for refactoring or improving code quality",
                display_order=4,
            ),
            RequestType(
                name="Documentation Update",
                category="Non Development",
                description="Request for updating documentation",
                display_order=5,
            ),
            RequestType(
                name="Configuration Change",
                category="Non Development",
                description="Request for system configuration changes",
                display_order=6,
            ),
            RequestType(
                name="Data Migration",
                category="Non Development",
                description="Request for data migration tasks",
                display_order=7,
            ),
        ]

        request_states = [
            RequestState(
                name="Open - Under Review",
                category="Open",
                description="Request is under initial review",
                display_order=1,
            ),
            RequestState(
                name="Open - Accepted",
                category="Open",
                description="Request has been accepted and ready for assignment",
                display_order=2,
            ),
            RequestState(
                name="In Progress - Development",
                category="In Progress",
                description="Development work is in progress",
                display_order=3,
            ),
            RequestState(
                name="In Progress - Testing (Dev)",
                category="In Progress",
                description="Testing in development environment",
                display_order=4,
            ),
            RequestState(
                name="In Progress - Deployed to Staging",
                category="In Progress",
                description="Deployed to staging environment for testing",
                display_order=5,
            ),
            RequestState(
                name="In Progress - UAT",
                category="In Progress",
                description="User Acceptance Testing in progress",
                display_order=6,
            ),
            RequestState(
                name="Closed - Released",
                category="Closed",
                description="Request completed and released to production",
                display_order=7,
            ),
            RequestState(
                name="Closed - Rejected",
                category="Closed",
                description="Request was rejected",
                display_order=8,
            ),
            RequestState(
                name="Closed - Duplicate",
                category="Closed",
                description="Request was marked as duplicate",
                display_order=9,
            ),
        ]

        functional_categories = [
            FunctionalCategory(
                name="Sales",
                description="Sales module related requests",
                display_order=1,
            ),
            FunctionalCategory(
                name="Inventory",
                description="Inventory management requests",
                display_order=2,
            ),
            FunctionalCategory(
                name="Accounting",
                description="Accounting and finance requests",
                display_order=3,
            ),
            FunctionalCategory(
                name="HR",
                description="Human resources requests",
                display_order=4,
            ),
            FunctionalCategory(
                name="CRM",
                description="Customer relationship management requests",
                display_order=5,
            ),
            FunctionalCategory(
                name="Website",
                description="Website and e-commerce requests",
                display_order=6,
            ),
            FunctionalCategory(
                name="Infrastructure",
                description="Infrastructure and server related requests",
                display_order=7,
            ),
        ]

        priorities = [
            Priority(name="Low", level=1, display_order=1),
            Priority(name="Medium", level=2, display_order=2),
            Priority(name="High", level=3, display_order=3),
            Priority(name="Critical", level=4, display_order=4),
            Priority(name="Blocker", level=5, display_order=5),
        ]

        for obj in request_types + request_states + functional_categories + priorities:
            db.add(obj)

        db.commit()
        print(f"Seeded {len(request_types)} request types")
        print(f"Seeded {len(request_states)} request states")
        print(f"Seeded {len(functional_categories)} functional categories")
        print(f"Seeded {len(priorities)} priorities")
        print("Control parameters seeded successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding control parameters: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_control_parameters()
