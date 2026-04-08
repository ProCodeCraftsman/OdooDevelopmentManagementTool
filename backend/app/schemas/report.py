from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


# ─── Async report schemas (comparison summary tab) ───────────────────────────

class ReportMetadataResponse(BaseModel):
    id: int
    last_generated_at: Optional[datetime]
    is_generating: bool

    model_config = {"from_attributes": True}


class ReportRowResponse(BaseModel):
    id: int
    technical_name: str
    module_name: Optional[str]
    version_data: Optional[Dict[str, Any]]
    # Keyed by action string: {"Upgrade": N, "Error (Downgrade)": N, "Missing Module": N,
    #                          "Error (Missing in Source)": N, "No Action": N}
    action_counts: Optional[Dict[str, int]]

    model_config = {"from_attributes": True}


class PaginationMeta(BaseModel):
    total_records: int
    total_pages: int
    current_page: int
    limit: int


class PaginatedReportResponse(BaseModel):
    data: List[ReportRowResponse]
    pagination: PaginationMeta


class GenerateReportResponse(BaseModel):
    message: str
    rows_generated: int
    drift_entries_generated: int


# ─── Version drift entry schemas ─────────────────────────────────────────────

class VersionDriftEntryResponse(BaseModel):
    id: int
    technical_name: str
    module_name: Optional[str]
    source_env: str
    source_version: Optional[str]
    dest_env: str
    dest_version: Optional[str]
    action: str
    missing_env: Optional[str]

    model_config = {"from_attributes": True}


class DriftSummaryCounts(BaseModel):
    """Global counts for the drift tab summary cards (unaffected by active filters)."""
    total: int
    upgrades: int
    downgrades: int
    missing: int


class PaginatedDriftResponse(BaseModel):
    data: List[VersionDriftEntryResponse]
    pagination: PaginationMeta
    summary: DriftSummaryCounts
