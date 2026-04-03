from typing import List
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

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/comparison", response_model=ComparisonReport)
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
    
    rows = []
    summary = {
        "total_modules": len(modules),
        "environments": len(environments),
    }
    
    for module in modules:
        versions = {}
        for env in environments:
            records = db.query(SyncRecord).join(Environment).filter(
                SyncRecord.module_id == module.id,
                Environment.id == env.id,
                SyncRecord.status == "completed"
            ).order_by(SyncRecord.created_at.desc()).first()
            
            if records:
                versions[env.name] = {
                    "version_string": records.version_string,
                    "state": records.state,
                    "version_major": records.version_major,
                    "version_minor": records.version_minor,
                    "version_patch": records.version_patch,
                    "version_build": records.version_build,
                }
            else:
                versions[env.name] = {
                    "version_string": "N/A",
                    "state": "Missing Module",
                    "version_major": None,
                    "version_minor": None,
                    "version_patch": None,
                    "version_build": None,
                }
        
        rows.append(ComparisonRow(
            technical_name=module.name,
            module_name=module.shortdesc,
            versions=versions,
            action=None,
        ))
    
    return ComparisonReport(
        environments=env_names,
        rows=rows,
        summary=summary,
    )
