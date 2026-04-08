from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


# ─── ReleasePlanState (Control Parameter) ────────────────────────────────────

class ReleasePlanStateBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str  # Draft / Planned / Approved / Executing / Closed / Failed
    is_active: bool = True
    display_order: int = 0


class ReleasePlanStateCreate(ReleasePlanStateBase):
    pass


class ReleasePlanStateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class ReleasePlanStateResponse(ReleasePlanStateBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Brief references ────────────────────────────────────────────────────────

class EnvironmentBrief(BaseModel):
    id: int
    name: str
    order: int
    category: str

    model_config = ConfigDict(from_attributes=True)


class ReleasePlanStateBrief(BaseModel):
    id: int
    name: str
    category: str

    model_config = ConfigDict(from_attributes=True)


class UserBrief(BaseModel):
    id: int
    username: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class DevelopmentRequestBrief(BaseModel):
    id: int
    request_number: str
    description: str

    model_config = ConfigDict(from_attributes=True)


# ─── ReleasePlanLine ─────────────────────────────────────────────────────────

class ReleasePlanLineBase(BaseModel):
    development_request_id: Optional[int] = None
    module_id: Optional[int] = None
    module_technical_name: Optional[str] = None
    module_version: Optional[str] = None
    module_email: Optional[str] = None
    module_md5_hash: Optional[str] = None
    uat_ticket: Optional[str] = None
    uat_status: Optional[str] = None


class ReleasePlanLineCreate(ReleasePlanLineBase):
    pass


class ReleasePlanLineUpdate(BaseModel):
    development_request_id: Optional[int] = None
    module_id: Optional[int] = None
    module_technical_name: Optional[str] = None
    module_version: Optional[str] = None
    module_email: Optional[str] = None
    module_md5_hash: Optional[str] = None
    uat_ticket: Optional[str] = None
    uat_status: Optional[str] = None


class ReleasePlanLineResponse(ReleasePlanLineBase):
    id: int
    release_plan_id: int
    request_module_line_id: Optional[int] = None
    source_env_version: Optional[str] = None
    target_env_version: Optional[str] = None
    release_action: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    development_request: Optional[DevelopmentRequestBrief] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Eligible module line (for Add Modules wizard) ────────────────────────────

class EligibleModuleLineResponse(BaseModel):
    id: int  # RequestModuleLine.id
    module_id: Optional[int] = None
    module_technical_name: str
    module_version: Optional[str] = None
    module_md5_sum: Optional[str] = None
    uat_status: Optional[str] = None
    uat_ticket: Optional[str] = None
    source_env_version: Optional[str] = None
    target_env_version: Optional[str] = None
    drift_action: Optional[str] = None  # Upgrade / No Action / Missing Module / Error…
    is_eligible: bool
    disable_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class LinkModuleLinesRequest(BaseModel):
    module_line_ids: List[int]  # RequestModuleLine IDs to link


class LinkModuleLinesResponse(BaseModel):
    added: List[ReleasePlanLineResponse]
    skipped: List[str]
    errors: List[str]


# ─── Linked Release Plan entry (for DR detail view) ───────────────────────────

class LinkedReleasePlanEntry(BaseModel):
    release_plan_line_id: int
    module_technical_name: Optional[str] = None
    module_version: Optional[str] = None
    plan_id: int
    plan_number: str
    source_env_name: str
    target_env_name: str
    state_name: str
    state_category: str
    planned_deployment_date: Optional[datetime] = None
    actual_deployment_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ─── ReleasePlan ─────────────────────────────────────────────────────────────

class ReleasePlanBase(BaseModel):
    release_version: Optional[str] = None
    source_environment_id: int
    target_environment_id: int
    planned_deployment_date: Optional[datetime] = None
    release_notes: Optional[str] = None
    comments: Optional[str] = None
    approved_by_id: Optional[int] = None
    deployed_by_id: Optional[int] = None
    related_release_plan_id: Optional[int] = None


class ReleasePlanCreate(ReleasePlanBase):
    state_id: Optional[int] = None  # defaults to first "Draft" state


class ReleasePlanUpdate(BaseModel):
    release_version: Optional[str] = None
    source_environment_id: Optional[int] = None
    target_environment_id: Optional[int] = None
    state_id: Optional[int] = None
    planned_deployment_date: Optional[datetime] = None
    actual_deployment_date: Optional[datetime] = None
    release_notes: Optional[str] = None
    comments: Optional[str] = None
    approved_by_id: Optional[int] = None
    deployed_by_id: Optional[int] = None
    related_release_plan_id: Optional[int] = None


class ReleasePlanListResponse(BaseModel):
    id: int
    plan_number: str
    release_version: str
    source_environment_id: int
    target_environment_id: int
    state_id: int
    planned_deployment_date: Optional[datetime]
    actual_deployment_date: Optional[datetime]
    approved_by_id: Optional[int]
    deployed_by_id: Optional[int]
    is_snapshot_taken: bool
    created_at: datetime
    updated_at: datetime

    source_environment: EnvironmentBrief
    target_environment: EnvironmentBrief
    state: ReleasePlanStateBrief
    approved_by: Optional[UserBrief]
    deployed_by: Optional[UserBrief]

    model_config = ConfigDict(from_attributes=True)


class PaginatedReleasePlanListResponse(BaseModel):
    items: List[ReleasePlanListResponse]
    total: int
    page: int
    limit: int
    pages: int


class ReleasePlanResponse(ReleasePlanListResponse):
    release_notes: Optional[str]
    comments: Optional[str]
    related_release_plan_id: Optional[int]
    created_by_id: Optional[int]
    created_by: Optional[UserBrief]
    lines: List[ReleasePlanLineResponse]
    permissions: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Bulk line operations ─────────────────────────────────────────────────────

class BulkAddLinesRequest(BaseModel):
    """Add all module lines from a development request to the release plan."""
    development_request_id: int


class AddLinesFromRequestResponse(BaseModel):
    added: List[ReleasePlanLineResponse]
    skipped: List[str]
    errors: List[str]
