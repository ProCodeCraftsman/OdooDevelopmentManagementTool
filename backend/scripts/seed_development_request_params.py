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


def seed_control_parameters(force: bool = False):
    db = SessionLocal()
    try:
        if db.query(RequestType).count() > 0:
            if not force:
                print("Control parameters already seeded. Use --force to re-seed.")
                return
            # Truncate in dependency order before re-seeding
            for table in ("priorities", "functional_categories", "request_states", "request_types"):
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
                category="Non Development",
                description="Request involving master data updates",
                display_order=5,
            ),
            RequestType(
                name="Performance Issue",
                category="Non Development",
                description="Report of system performance degradation",
                display_order=6,
            ),
            RequestType(
                name="Transactional Data",
                category="Non Development",
                description="Request involving transactional data",
                display_order=7,
            ),
            RequestType(
                name="Configurations",
                category="Non Development",
                description="Request for system configurations",
                display_order=8,
            ),
        ]

        request_states = [
            RequestState(
                name="Open - Request under Review",
                category="Open",
                description="Request is under initial review",
                display_order=1,
            ),
            RequestState(
                name="Accepted - On Hold",
                category="Open",
                description="Request is accepted but currently on hold",
                display_order=2,
            ),
            RequestState(
                name="In Progress",
                category="In Progress",
                description="Work is actively in progress",
                display_order=3,
            ),
            RequestState(
                name="Dev Testing",
                category="In Progress",
                description="Testing in the development environment",
                display_order=4,
            ),
            RequestState(
                name="Closed - Development",
                category="In Progress",
                description="Development phase is closed, pending staging",
                display_order=5,
            ),
            RequestState(
                name="Deployed to Staging",
                category="In Progress",
                description="Deployed to the staging environment",
                display_order=6,
            ),
            RequestState(
                name="UAT - Initiated",
                category="In Progress",
                description="User Acceptance Testing has started",
                display_order=7,
            ),
            RequestState(
                name="UAT - Completed",
                category="In Progress",
                description="User Acceptance Testing is complete",
                display_order=8,
            ),
            RequestState(
                name="UAT - Failed",
                category="Closed",
                description="User Acceptance Testing failed",
                display_order=9,
            ),
            RequestState(
                name="Deployed to Production",
                category="Closed",
                description="Successfully deployed to the production environment",
                display_order=10,
            ),
            RequestState(
                name="Closed - Configuration",
                category="Closed",
                description="Configuration changes are completed and closed",
                display_order=11,
            ),
            RequestState(
                name="Cancelled",
                category="Cancelled",
                description="Request was cancelled",
                display_order=12,
            ),
            RequestState(
                name="Rejected",
                category="Cancelled",
                description="Request was rejected ",
                display_order=13,
            )
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
    parser = argparse.ArgumentParser(description="Seed control parameters")
    parser.add_argument("--force", action="store_true", help="Clear existing data and re-seed")
    args = parser.parse_args()
    seed_control_parameters(force=args.force)