from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.dashboard import (
    DashboardDriftResponse,
    DashboardSummaryResponse,
    RequestAnalysisResponse,
)
from app.services.dashboard_service import (
    get_request_analysis as _get_request_analysis,
    get_summary as _get_summary,
    get_version_drift as _get_version_drift,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def summary_endpoint(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> DashboardSummaryResponse:
    """Aggregated KPIs, workload matrix, and chart data for the Command Center tab."""
    return _get_summary(db)


@router.get("/version-drift", response_model=DashboardDriftResponse)
def version_drift_endpoint(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> DashboardDriftResponse:
    """Aggregate drift counts from the latest report for the dashboard summary card."""
    return _get_version_drift(db)


@router.get("/request-analysis", response_model=RequestAnalysisResponse)
def request_analysis_endpoint(
    category_ids: Optional[str] = Query(
        None,
        description="Comma-separated list of functional category IDs to filter",
    ),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> RequestAnalysisResponse:
    """Radar chart data for development request analysis tab."""
    parsed_ids: list[int] | None = None
    if category_ids:
        try:
            parsed_ids = [int(x.strip()) for x in category_ids.split(",") if x.strip()]
        except ValueError:
            pass
    return _get_request_analysis(db, parsed_ids)
