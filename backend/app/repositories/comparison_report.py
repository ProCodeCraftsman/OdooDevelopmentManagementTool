import math
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from sqlalchemy import delete, func, or_
from sqlalchemy.orm import Session

from app.models.comparison_report import (
    ComparisonReport,
    ComparisonReportRow,
    ReportMetadata,
    VersionDriftEntry,
)
from app.schemas.report import DriftSummaryCounts

# Action strings excluded from the drift table by default
_DEFAULT_EXCLUDED_ACTIONS = {"No Action"}


class ComparisonReportRepository:

    # ─── ReportMetadata (generation lock) ────────────────────────────────────

    def get_metadata(self, db: Session) -> Optional[ReportMetadata]:
        return db.query(ReportMetadata).first()

    def get_or_create_metadata(self, db: Session) -> ReportMetadata:
        meta = db.query(ReportMetadata).first()
        if not meta:
            meta = ReportMetadata(is_generating=False, last_generated_at=None)
            db.add(meta)
            db.flush()
        return meta

    def update_metadata_after_generate(self, db: Session) -> None:
        meta = self.get_or_create_metadata(db)
        meta.is_generating = False
        meta.last_generated_at = datetime.utcnow()
        db.flush()

    def set_generating(self, db: Session, value: bool) -> None:
        meta = self.get_or_create_metadata(db)
        meta.is_generating = value
        db.flush()

    # ─── ComparisonReport (parent entity) ────────────────────────────────────

    def create_new_report(self, db: Session) -> ComparisonReport:
        """Delete all old reports (CASCADE deletes rows + drift entries) and create a fresh one."""
        db.execute(delete(ComparisonReport))
        report = ComparisonReport(generated_at=datetime.utcnow())
        db.add(report)
        db.flush()
        return report

    def get_latest_report(self, db: Session) -> Optional[ComparisonReport]:
        return db.query(ComparisonReport).order_by(ComparisonReport.generated_at.desc()).first()

    # ─── ComparisonReportRow bulk ops ─────────────────────────────────────────

    def bulk_insert_rows(self, db: Session, report_id: int, rows: List[dict]) -> None:
        if not rows:
            return
        for row in rows:
            row["comparison_report_id"] = report_id
        db.bulk_insert_mappings(ComparisonReportRow, rows)
        db.flush()

    # ─── VersionDriftEntry bulk ops ───────────────────────────────────────────

    def bulk_insert_drift_entries(self, db: Session, report_id: int, entries: List[dict]) -> None:
        if not entries:
            return
        for entry in entries:
            entry["comparison_report_id"] = report_id
        db.bulk_insert_mappings(VersionDriftEntry, entries)
        db.flush()

    # ─── ComparisonReportRow queries ──────────────────────────────────────────

    def get_paginated(
        self,
        db: Session,
        page: int,
        limit: int,
        search: Optional[str],
        technical_names: Optional[List[str]],
        sort_by: str,
    ) -> Tuple[List[ComparisonReportRow], int]:
        query = db.query(ComparisonReportRow)

        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(
                    ComparisonReportRow.technical_name.ilike(pattern),
                    ComparisonReportRow.module_name.ilike(pattern),
                )
            )

        if technical_names:
            query = query.filter(ComparisonReportRow.technical_name.in_(technical_names))

        total = query.count()

        sort_col = {
            "technical_name": ComparisonReportRow.technical_name,
            "module_name": ComparisonReportRow.module_name,
        }.get(sort_by, ComparisonReportRow.technical_name)

        offset = (page - 1) * limit
        rows = query.order_by(sort_col).offset(offset).limit(limit).all()
        return rows, total

    def get_all_filtered(
        self,
        db: Session,
        search: Optional[str],
        technical_names: Optional[List[str]],
        sort_by: str,
    ) -> List[ComparisonReportRow]:
        query = db.query(ComparisonReportRow)

        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(
                    ComparisonReportRow.technical_name.ilike(pattern),
                    ComparisonReportRow.module_name.ilike(pattern),
                )
            )

        if technical_names:
            query = query.filter(ComparisonReportRow.technical_name.in_(technical_names))

        sort_col = {
            "technical_name": ComparisonReportRow.technical_name,
            "module_name": ComparisonReportRow.module_name,
        }.get(sort_by, ComparisonReportRow.technical_name)

        return query.order_by(sort_col).all()

    def get_all(self, db: Session) -> List[ComparisonReportRow]:
        return (
            db.query(ComparisonReportRow)
            .order_by(ComparisonReportRow.technical_name)
            .all()
        )

    def get_distinct_technical_names(self, db: Session) -> List[str]:
        results = (
            db.query(ComparisonReportRow.technical_name)
            .filter(ComparisonReportRow.technical_name.isnot(None))
            .distinct()
            .all()
        )
        return sorted(r[0] for r in results)

    # ─── VersionDriftEntry queries ────────────────────────────────────────────

    def get_drift_paginated(
        self,
        db: Session,
        page: int,
        limit: int,
        search: Optional[str],
        action_filters: Optional[List[str]],
        sort_by: str,
        include_no_action: bool = False,
    ) -> Tuple[List[VersionDriftEntry], int, DriftSummaryCounts]:
        report = self.get_latest_report(db)
        if not report:
            empty = DriftSummaryCounts(total=0, upgrades=0, downgrades=0, missing=0)
            return [], 0, empty

        # Summary counts are always global (latest report, no user filters)
        summary = self._compute_drift_summary(db, report.id)

        query = db.query(VersionDriftEntry).filter(
            VersionDriftEntry.comparison_report_id == report.id
        )

        if not include_no_action:
            query = query.filter(VersionDriftEntry.action.notin_(_DEFAULT_EXCLUDED_ACTIONS))

        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(
                    VersionDriftEntry.technical_name.ilike(pattern),
                    VersionDriftEntry.module_name.ilike(pattern),
                )
            )

        if action_filters:
            query = query.filter(VersionDriftEntry.action.in_(action_filters))

        total = query.count()

        sort_col = {
            "technical_name": VersionDriftEntry.technical_name,
            "module_name": VersionDriftEntry.module_name,
            "action": VersionDriftEntry.action,
            "source_env": VersionDriftEntry.source_env,
            "dest_env": VersionDriftEntry.dest_env,
        }.get(sort_by, VersionDriftEntry.technical_name)

        offset = (page - 1) * limit
        entries = query.order_by(sort_col, VersionDriftEntry.technical_name).offset(offset).limit(limit).all()
        return entries, total, summary

    def get_drift_all_filtered(
        self,
        db: Session,
        search: Optional[str],
        action_filters: Optional[List[str]],
        sort_by: str,
        include_no_action: bool = False,
    ) -> List[VersionDriftEntry]:
        report = self.get_latest_report(db)
        if not report:
            return []

        query = db.query(VersionDriftEntry).filter(
            VersionDriftEntry.comparison_report_id == report.id
        )

        if not include_no_action:
            query = query.filter(VersionDriftEntry.action.notin_(_DEFAULT_EXCLUDED_ACTIONS))

        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(
                    VersionDriftEntry.technical_name.ilike(pattern),
                    VersionDriftEntry.module_name.ilike(pattern),
                )
            )

        if action_filters:
            query = query.filter(VersionDriftEntry.action.in_(action_filters))

        sort_col = {
            "technical_name": VersionDriftEntry.technical_name,
            "module_name": VersionDriftEntry.module_name,
            "action": VersionDriftEntry.action,
            "source_env": VersionDriftEntry.source_env,
            "dest_env": VersionDriftEntry.dest_env,
        }.get(sort_by, VersionDriftEntry.technical_name)

        return query.order_by(sort_col, VersionDriftEntry.technical_name).all()

    def get_distinct_drift_actions(self, db: Session) -> List[str]:
        report = self.get_latest_report(db)
        if not report:
            return []
        results = (
            db.query(VersionDriftEntry.action)
            .filter(VersionDriftEntry.comparison_report_id == report.id)
            .distinct()
            .all()
        )
        return sorted(r[0] for r in results)

    def _compute_drift_summary(self, db: Session, report_id: int) -> DriftSummaryCounts:
        rows = (
            db.query(VersionDriftEntry.action, func.count(VersionDriftEntry.id).label("cnt"))
            .filter(
                VersionDriftEntry.comparison_report_id == report_id,
                VersionDriftEntry.action.notin_(_DEFAULT_EXCLUDED_ACTIONS),
            )
            .group_by(VersionDriftEntry.action)
            .all()
        )
        counts: Dict[str, int] = {r.action: r.cnt for r in rows}
        total = sum(counts.values())
        upgrades = counts.get("Upgrade", 0)
        downgrades = counts.get("Error (Downgrade)", 0)
        missing = counts.get("Missing Module", 0) + counts.get("Error (Missing in Source)", 0)
        return DriftSummaryCounts(total=total, upgrades=upgrades, downgrades=downgrades, missing=missing)

    def get_total_drift_count_for_dashboard(self, db: Session) -> Dict[str, int]:
        """Used by the dashboard summary endpoint."""
        report = self.get_latest_report(db)
        if not report:
            return {"total": 0, "upgrades": 0, "downgrades": 0, "missing": 0, "has_report": 0}
        summary = self._compute_drift_summary(db, report.id)
        return {
            "total": summary.total,
            "upgrades": summary.upgrades,
            "downgrades": summary.downgrades,
            "missing": summary.missing,
            "has_report": 1,
        }
