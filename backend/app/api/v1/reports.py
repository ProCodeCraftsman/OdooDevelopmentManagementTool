from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.module import Module
from app.models.sync_record import SyncRecord
from app.models.environment import Environment
from app.schemas.report import ComparisonRow, ComparisonReport
from app.services.comparer import parse_semver, calculate_release_action

router = APIRouter(prefix="/reports", tags=["Reports"])


def get_latest_sync_record(db: Session, module_id: int, env_id: int) -> Optional[SyncRecord]:
    return db.query(SyncRecord).filter(
        SyncRecord.module_id == module_id,
        SyncRecord.environment_id == env_id,
        SyncRecord.status == "completed"
    ).order_by(SyncRecord.created_at.desc()).first()


def build_version_info(record: Optional[SyncRecord]) -> Dict[str, Any]:
    if record:
        return {
            "version_string": record.version_string or "N/A",
            "state": record.state or "Missing Module",
            "version_major": record.version_major,
            "version_minor": record.version_minor,
            "version_patch": record.version_patch,
            "version_build": record.version_build,
            "last_sync": record.created_at.isoformat() if record.created_at else None,
            "action": None,
        }
    return {
        "version_string": "N/A",
        "state": "Missing Module",
        "version_major": None,
        "version_minor": None,
        "version_patch": None,
        "version_build": None,
        "last_sync": None,
        "action": None,
    }


def calculate_row_action(
    env_names: List[str],
    versions: Dict[str, Dict[str, Any]],
    module_name: str
) -> Optional[str]:
    if len(env_names) < 2:
        return None
    
    first_env = env_names[0]
    first_version = versions.get(first_env, {}).get("version_string", "N/A")
    
    for i in range(1, len(env_names)):
        current_env = env_names[i]
        source_version = first_version
        target_version = versions.get(current_env, {}).get("version_string", "N/A")
        
        if source_version == "N/A" and target_version != "N/A":
            return f"{current_env}: Error (Missing in Source)"
        if target_version == "N/A":
            return f"{current_env}: Missing Module"
        
        action = calculate_release_action(source_version, target_version)
        if action != "No Action":
            return f"{current_env}: {action}"
    
    return None


@router.get("/comparison")
def get_comparison_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    environments = db.query(Environment).filter(
        Environment.is_active == True
    ).order_by(Environment.order.desc()).all()
    
    if not environments:
        raise HTTPException(status_code=404, detail="No environments configured")
    
    modules = db.query(Module).all()
    
    env_names = [env.name for env in environments]
    env_orders = {env.name: env.order for env in environments}
    
    rows = []
    summary = {
        "total_modules": len(modules),
        "environments": len(environments),
    }
    
    for module in modules:
        versions = {}
        for env in environments:
            record = get_latest_sync_record(db, module.id, env.id)
            versions[env.name] = build_version_info(record)
        
        row_action = calculate_row_action(env_names, versions, module.name)
        
        rows.append({
            "technical_name": module.name,
            "module_name": module.shortdesc,
            "versions": versions,
            "action": row_action,
        })
    
    import sys
    sys.stderr.write(f"DEBUG: env_orders type = {type(env_orders)}, value = {env_orders}\n")
    sys.stderr.flush()
    
    result = {
        "environments": env_names,
        "environment_orders": env_orders,
        "rows": rows,
        "summary": summary,
    }
    
    sys.stderr.write(f"DEBUG: result environment_orders = {result['environment_orders']}\n")
    sys.stderr.flush()
    
    return result
