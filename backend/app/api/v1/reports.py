import csv
import io
import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.environment import Environment
from app.models.module import Module
from app.models.sync_record import SyncRecord
from app.models.user import User
from app.repositories.comparison_report import ComparisonReportRepository
from app.schemas.report import (
    DriftSummaryCounts,
    GenerateReportResponse,
    PaginatedDriftResponse,
    PaginatedReportResponse,
    PaginationMeta,
    ReportMetadataResponse,
    ReportRowResponse,
    VersionDriftEntryResponse,
)
from app.services.comparer import calculate_drift_action

router = APIRouter(prefix="/reports", tags=["Reports"])

_repo = ComparisonReportRepository()


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _parse_csv(value: Optional[str]) -> Optional[List[str]]:
    if not value:
        return None
    parts = [v.strip() for v in value.split(",") if v.strip()]
    return parts if parts else None


def _get_latest_sync_record(db: Session, module_id: int, env_id: int) -> Optional[SyncRecord]:
    return (
        db.query(SyncRecord)
        .filter(
            SyncRecord.module_id == module_id,
            SyncRecord.environment_id == env_id,
            SyncRecord.status == "completed",
        )
        .order_by(SyncRecord.created_at.desc())
        .first()
    )


def _build_version_info(record: Optional[SyncRecord]) -> Dict[str, Any]:
    if record:
        return {
            "version": record.version_string or "N/A",
            "state": record.state or "Missing Module",
            "last_sync": record.created_at.isoformat() if record.created_at else None,
        }
    return {"version": "N/A", "state": "Missing Module", "last_sync": None}


def _build_sliding_window_drift(
    module_technical_name: str,
    module_name: Optional[str],
    env_names: List[str],
    versions: Dict[str, Dict[str, Any]],
) -> Tuple[List[dict], Dict[str, int]]:
    """Compute all consecutive-pair drift entries and action_counts for one module.

    Environments in env_names are ordered DESC (highest order first = most dev → prod).
    "Not Installed" pairs (both N/A) are skipped and not written to the DB.
    """
    drift_entries: List[dict] = []
    action_counts: Dict[str, int] = {
        "Upgrade": 0,
        "Error (Downgrade)": 0,
        "Missing Module": 0,
        "Error (Missing in Source)": 0,
        "No Action": 0,
        "Error (Version Structure Mismatch)": 0,
    }

    for i in range(len(env_names) - 1):
        src_env = env_names[i]
        dst_env = env_names[i + 1]

        src_ver = versions.get(src_env, {}).get("version", "N/A")
        dst_ver = versions.get(dst_env, {}).get("version", "N/A")

        src_is_na = not src_ver or src_ver == "N/A"
        dst_is_na = not dst_ver or dst_ver == "N/A"

        # Skip "Not Installed" — both N/A, don't write to DB (decision 7)
        if src_is_na and dst_is_na:
            continue

        action, mismatch_reason = calculate_drift_action(src_ver, dst_ver, src_env, dst_env)
        action_counts[action] = action_counts.get(action, 0) + 1

        drift_entries.append({
            "technical_name": module_technical_name,
            "module_name": module_name,
            "source_env": src_env,
            "source_version": None if src_is_na else src_ver,
            "dest_env": dst_env,
            "dest_version": None if dst_is_na else dst_ver,
            "action": action,
            "mismatch_reason": mismatch_reason,
        })

    return drift_entries, action_counts


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=GenerateReportResponse)
def generate_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GenerateReportResponse:
    """Generate the comparison report. Creates ComparisonReport parent, bulk-inserts
    ComparisonReportRow + VersionDriftEntry (sliding window) in a single transaction."""
    meta = _repo.get_or_create_metadata(db)
    db.commit()

    meta = _repo.get_metadata(db)
    if meta and meta.is_generating:
        raise HTTPException(
            status_code=409,
            detail="Report generation is already in progress. Please wait.",
        )

    _repo.set_generating(db, True)
    db.commit()

    try:
        environments = (
            db.query(Environment)
            .filter(Environment.is_active == True)  # noqa: E712
            .order_by(Environment.order.desc())
            .all()
        )
        if not environments:
            raise HTTPException(status_code=404, detail="No active environments configured")

        modules = db.query(Module).all()
        env_names = [env.name for env in environments]

        # Create new parent report (CASCADE-deletes all old rows + drift entries)
        report = _repo.create_new_report(db)

        rows_to_insert: List[dict] = []
        all_drift_entries: List[dict] = []

        for module in modules:
            versions: Dict[str, Dict[str, Any]] = {}
            for env in environments:
                record = _get_latest_sync_record(db, module.id, env.id)
                versions[env.name] = _build_version_info(record)

            drift_entries, action_counts = _build_sliding_window_drift(
                module.name, module.shortdesc, env_names, versions
            )
            all_drift_entries.extend(drift_entries)

            rows_to_insert.append({
                "technical_name": module.name,
                "module_name": module.shortdesc,
                "version_data": versions,
                "action_counts": action_counts,
            })

        _repo.bulk_insert_rows(db, report.id, rows_to_insert)
        _repo.bulk_insert_drift_entries(db, report.id, all_drift_entries)
        _repo.update_metadata_after_generate(db)
        db.commit()

        return GenerateReportResponse(
            message="Report generated successfully",
            rows_generated=len(rows_to_insert),
            drift_entries_generated=len(all_drift_entries),
        )

    except HTTPException:
        _repo.set_generating(db, False)
        db.commit()
        raise
    except Exception as exc:
        _repo.set_generating(db, False)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc


@router.get("/metadata", response_model=ReportMetadataResponse)
def get_metadata(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReportMetadataResponse:
    meta = _repo.get_or_create_metadata(db)
    db.commit()
    return meta


# ─── Comparison Summary (Tab 2) ───────────────────────────────────────────────

@router.get("/comparison", response_model=PaginatedReportResponse)
def get_comparison_report(
    page: int = Query(1, ge=1),
    limit: int = Query(15, ge=1, le=200),
    search: Optional[str] = Query(None),
    technical_names: Optional[str] = Query(None, description="Comma-separated module technical names"),
    sort_by: str = Query("technical_name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedReportResponse:
    tech_names_list = _parse_csv(technical_names)
    rows, total = _repo.get_paginated(
        db,
        page=page,
        limit=limit,
        search=search,
        technical_names=tech_names_list,
        sort_by=sort_by,
    )
    total_pages = max(1, math.ceil(total / limit))
    return PaginatedReportResponse(
        data=[ReportRowResponse.model_validate(r) for r in rows],
        pagination=PaginationMeta(
            total_records=total,
            total_pages=total_pages,
            current_page=page,
            limit=limit,
        ),
    )


@router.get("/comparison/filter-options")
def get_filter_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    tech_names = _repo.get_distinct_technical_names(db)
    return {"technical_name_options": tech_names}


@router.get("/comparison/export")
def export_comparison_report(
    search: Optional[str] = Query(None),
    technical_names: Optional[str] = Query(None),
    sort_by: str = Query("technical_name"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Return all matching comparison rows as JSON (no pagination) for client-side Excel export."""
    tech_names_list = _parse_csv(technical_names)
    rows = _repo.get_all_filtered(
        db,
        search=search,
        technical_names=tech_names_list,
        sort_by=sort_by,
    )
    if not rows:
        return []

    env_keys: List[str] = []
    for row in rows:
        if row.version_data:
            env_keys = list(row.version_data.keys())
            break

    result = []
    for row in rows:
        record: Dict[str, Any] = {
            "technical_name": row.technical_name,
            "module_name": row.module_name or "",
        }
        for env in env_keys:
            env_data = (row.version_data or {}).get(env, {})
            record[f"{env}_version"] = env_data.get("version", "N/A")
            record[f"{env}_state"] = env_data.get("state", "N/A")
        ac = row.action_counts or {}
        record["upgrades"] = ac.get("Upgrade", 0)
        record["downgrades"] = ac.get("Error (Downgrade)", 0)
        record["missing"] = ac.get("Missing Module", 0) + ac.get("Error (Missing in Source)", 0)
        result.append(record)

    return result


# ─── Version Drift (Tab 1) ────────────────────────────────────────────────────

@router.get("/drift", response_model=PaginatedDriftResponse)
def get_drift(
    page: int = Query(1, ge=1),
    limit: int = Query(15, ge=1, le=200),
    search: Optional[str] = Query(None),
    action_filter: Optional[str] = Query(None, description="Comma-separated actions"),
    sort_by: str = Query("technical_name"),
    include_no_action: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedDriftResponse:
    action_list = _parse_csv(action_filter)
    entries, total, summary = _repo.get_drift_paginated(
        db,
        page=page,
        limit=limit,
        search=search,
        action_filters=action_list,
        sort_by=sort_by,
        include_no_action=include_no_action,
    )
    total_pages = max(1, math.ceil(total / limit))
    return PaginatedDriftResponse(
        data=[VersionDriftEntryResponse.model_validate(e) for e in entries],
        pagination=PaginationMeta(
            total_records=total,
            total_pages=total_pages,
            current_page=page,
            limit=limit,
        ),
        summary=summary,
    )


@router.get("/drift/filter-options")
def get_drift_filter_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    actions = _repo.get_distinct_drift_actions(db)
    return {"action_options": actions}


@router.get("/drift/export")
def export_drift_csv(
    search: Optional[str] = Query(None),
    action_filter: Optional[str] = Query(None),
    sort_by: str = Query("technical_name"),
    include_no_action: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Stream drift entries as a downloadable CSV."""
    action_list = _parse_csv(action_filter)
    entries = _repo.get_drift_all_filtered(
        db,
        search=search,
        action_filters=action_list,
        sort_by=sort_by,
        include_no_action=include_no_action,
    )
    if not entries:
        raise HTTPException(status_code=404, detail="No drift data to export. Generate a report first.")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Technical Name", "Module Name",
        "Source Env", "Source Version",
        "Dest Env", "Dest Version",
        "Action", "Missing Env",
    ])
    for e in entries:
        writer.writerow([
            e.technical_name,
            e.module_name or "",
            e.source_env,
            e.source_version or "N/A",
            e.dest_env,
            e.dest_version or "N/A",
            e.action,
            e.missing_env or "",
        ])

    output.seek(0)
    filename = f"version_drift_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/drift/export-data")
def export_drift_data(
    search: Optional[str] = Query(None),
    action_filter: Optional[str] = Query(None),
    sort_by: str = Query("technical_name"),
    include_no_action: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Return all matching drift rows as JSON (no pagination) for client-side XLSX export."""
    action_list = _parse_csv(action_filter)
    entries = _repo.get_drift_all_filtered(
        db,
        search=search,
        action_filters=action_list,
        sort_by=sort_by,
        include_no_action=include_no_action,
    )
    return [
        {
            "technical_name": e.technical_name,
            "module_name": e.module_name or "",
            "source_env": e.source_env,
            "source_version": e.source_version or "N/A",
            "dest_env": e.dest_env,
            "dest_version": e.dest_version or "N/A",
            "action": e.action,
            "missing_env": e.missing_env or "",
        }
        for e in entries
    ]


# ─── Legacy CSV export ────────────────────────────────────────────────────────

@router.get("/export")
def export_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Stream the full comparison summary report as a CSV download."""
    rows = _repo.get_all(db)
    if not rows:
        raise HTTPException(status_code=404, detail="No report data to export. Generate a report first.")

    env_keys: List[str] = []
    for row in rows:
        if row.version_data:
            env_keys = list(row.version_data.keys())
            break

    output = io.StringIO()
    writer = csv.writer(output)
    header = ["Technical Name", "Module Name"]
    for env in env_keys:
        header += [f"{env} Version", f"{env} State"]
    header += ["Upgrades", "Downgrades", "Missing"]
    writer.writerow(header)

    for row in rows:
        record = [row.technical_name, row.module_name or ""]
        for env in env_keys:
            env_data = (row.version_data or {}).get(env, {})
            record.append(env_data.get("version", "N/A"))
            record.append(env_data.get("state", "N/A"))
        ac = row.action_counts or {}
        record.append(ac.get("Upgrade", 0))
        record.append(ac.get("Error (Downgrade)", 0))
        record.append(ac.get("Missing Module", 0) + ac.get("Error (Missing in Source)", 0))
        writer.writerow(record)

    output.seek(0)
    filename = f"comparison_report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
