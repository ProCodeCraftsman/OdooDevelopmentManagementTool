from app.core.database import SessionLocal
from app.models.environment import Environment
from app.models.module import Module
from app.models.sync_record import SyncRecord
from app.repositories.comparison_report import ComparisonReportRepository
from app.services.comparer import calculate_drift_action
from typing import List, Dict, Any, Tuple

_repo = ComparisonReportRepository()

def _get_latest_sync_record(db, module_id: int, env_id: int):
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

def _build_version_info(record):
    if record:
        return {
            "version": record.version_string or "N/A",
            "state": record.state or "Missing Module",
            "last_sync": record.created_at.isoformat() if record.created_at else None,
        }
    return {"version": "N/A", "state": "Missing Module", "last_sync": None}

def _build_sliding_window_drift(
    module_technical_name: str,
    module_name: str,
    env_names: List[str],
    versions: Dict[str, Dict[str, Any]],
) -> Tuple[List[dict], Dict[str, int]]:
    drift_entries: List[dict] = []
    action_counts: Dict[str, int] = {
        "Upgrade": 0,
        "Error (Downgrade)": 0,
        "Missing Module": 0,
        "Error (Missing in Source)": 0,
        "No Action": 0,
    }

    for i in range(len(env_names) - 1):
        src_env = env_names[i]
        dst_env = env_names[i + 1]

        src_ver = versions.get(src_env, {}).get("version", "N/A")
        dst_ver = versions.get(dst_env, {}).get("version", "N/A")

        src_is_na = not src_ver or src_ver == "N/A"
        dst_is_na = not dst_ver or dst_ver == "N/A"

        if src_is_na and dst_is_na:
            continue

        action, missing_env = calculate_drift_action(src_ver, dst_ver, src_env, dst_env)
        action_counts[action] = action_counts.get(action, 0) + 1

        drift_entries.append({
            "technical_name": module_technical_name,
            "module_name": module_name,
            "source_env": src_env,
            "source_version": None if src_is_na else src_ver,
            "dest_env": dst_env,
            "dest_version": None if dst_is_na else dst_ver,
            "action": action,
            "missing_env": missing_env,
        })

    return drift_entries, action_counts

def regenerate():
    db = SessionLocal()
    try:
        environments = (
            db.query(Environment)
            .filter(Environment.is_active == True)
            .order_by(Environment.order.desc())
            .all()
        )
        modules = db.query(Module).all()
        env_names = [env.name for env in environments]

        report = _repo.create_new_report(db)
        rows_to_insert = []
        all_drift_entries = []

        for module in modules:
            versions = {}
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
        print("Report regenerated successfully")

    finally:
        db.close()

if __name__ == "__main__":
    regenerate()
