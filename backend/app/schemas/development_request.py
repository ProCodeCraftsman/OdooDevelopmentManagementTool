from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Shared brief models
# ---------------------------------------------------------------------------

class UserBrief(BaseModel):
    id: int
    username: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class RequestTypeBrief(BaseModel):
    id: int
    name: str
    category: str

    model_config = ConfigDict(from_attributes=True)


class RequestStateBrief(BaseModel):
    id: int
    name: str
    category: str

    model_config = ConfigDict(from_attributes=True)


class FunctionalCategoryBrief(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class PriorityBrief(BaseModel):
    id: int
    name: str
    level: int

    model_config = ConfigDict(from_attributes=True)


class RelatedRequestBrief(BaseModel):
    id: int
    request_number: str
    title: str
    description: str

    model_config = ConfigDict(from_attributes=True)


class RequestSearchResult(BaseModel):
    id: int
    request_number: str
    title: str
    description: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Module lines
# ---------------------------------------------------------------------------

class RequestModuleLineBase(BaseModel):
    module_id: Optional[int] = None
    module_technical_name: str
    module_version: Optional[str] = None
    module_md5_sum: Optional[str] = None
    email_thread_zip: Optional[str] = None
    uat_status: Optional[str] = None
    uat_ticket: Optional[str] = None
    tec_note: Optional[str] = None


class RequestModuleLineCreate(RequestModuleLineBase):
    pass


class RequestModuleLineUpdate(BaseModel):
    module_version: Optional[str] = None
    module_md5_sum: Optional[str] = None
    email_thread_zip: Optional[str] = None
    uat_status: Optional[str] = None
    uat_ticket: Optional[str] = None
    tec_note: Optional[str] = None


class RequestModuleLineResponse(RequestModuleLineBase):
    id: int
    request_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DevelopmentRequestBrief(BaseModel):
    id: int
    request_number: str
    title: str
    request_state_id: int
    request_state: RequestStateBrief

    model_config = ConfigDict(from_attributes=True)


class RequestModuleLineWithRequest(RequestModuleLineResponse):
    request: DevelopmentRequestBrief


class PaginatedRequestModuleLineResponse(BaseModel):
    items: List[RequestModuleLineWithRequest]
    total: int
    page: int
    limit: int
    pages: int
    groups: Optional[List[GroupInfo]] = None


class BulkModuleLineCreate(BaseModel):
    lines: List[RequestModuleLineCreate]


class BulkModuleLineResponse(BaseModel):
    added: List[RequestModuleLineResponse]
    errors: List[str]


# ---------------------------------------------------------------------------
# Release plan lines (legacy stub kept for backward compat)
# ---------------------------------------------------------------------------

class RequestReleasePlanLineBase(BaseModel):
    release_plan_date: datetime
    release_plan_status: str


class RequestReleasePlanLineCreate(RequestReleasePlanLineBase):
    pass


class RequestReleasePlanLineResponse(RequestReleasePlanLineBase):
    id: int
    request_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Comments (threaded)
# ---------------------------------------------------------------------------

class RequestCommentCreate(BaseModel):
    content: str
    parent_comment_id: Optional[int] = None


class RequestCommentUpdate(BaseModel):
    content: str


class RequestCommentResponse(BaseModel):
    id: int
    request_id: int
    user_id: Optional[int]
    content: str
    parent_comment_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    user: Optional[UserBrief] = None
    replies: List["RequestCommentResponse"] = []

    model_config = ConfigDict(from_attributes=True)


# Allow self-reference
RequestCommentResponse.model_rebuild()


# ---------------------------------------------------------------------------
# Attachments
# ---------------------------------------------------------------------------

class RequestAttachmentResponse(BaseModel):
    id: int
    request_id: int
    original_name: str
    stored_name: str
    mime_type: str
    file_size: int
    uploaded_by_id: Optional[int]
    created_at: datetime
    uploaded_by: Optional[UserBrief] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

class AuditLogResponse(BaseModel):
    id: int
    record_id: int
    table_name: str
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    changed_by_id: Optional[int]
    changed_at: datetime
    changed_by: Optional[UserBrief] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Development request CRUD
# ---------------------------------------------------------------------------

class DevelopmentRequestBase(BaseModel):
    title: str
    request_type_id: int
    functional_category_id: int
    priority_id: int
    description: str
    comments: Optional[str] = None
    uat_request_id: Optional[str] = None
    assigned_developer_id: Optional[int] = None
    parent_request_id: Optional[int] = None


class DevelopmentRequestCreate(DevelopmentRequestBase):
    request_state_id: Optional[int] = None


class DevelopmentRequestUpdate(BaseModel):
    title: Optional[str] = None
    request_type_id: Optional[int] = None
    functional_category_id: Optional[int] = None
    priority_id: Optional[int] = None
    description: Optional[str] = None
    comments: Optional[str] = None
    uat_request_id: Optional[str] = None
    assigned_developer_id: Optional[int] = None
    request_state_id: Optional[int] = None
    parent_request_id: Optional[int] = None


class DevelopmentRequestListResponse(BaseModel):
    id: int
    request_number: str
    title: str
    request_type_id: int
    functional_category_id: int
    request_state_id: int
    priority_id: int
    description: str
    assigned_developer_id: Optional[int]
    request_date: datetime
    request_close_date: Optional[datetime]
    iteration_counter: int
    is_archived: bool = False

    request_type: RequestTypeBrief
    functional_category: FunctionalCategoryBrief
    request_state: RequestStateBrief
    priority: PriorityBrief
    assigned_developer: Optional[UserBrief] = None

    model_config = ConfigDict(from_attributes=True)


class GroupInfo(BaseModel):
    """Aggregated group metadata returned alongside items when group_by is active."""
    key: str   # Group value used for matching against items (e.g. "Open", "john")
    label: str  # Human-readable display label
    count: int  # Total items in this group across all pages


class PaginatedDevelopmentRequestListResponse(BaseModel):
    items: List[DevelopmentRequestListResponse]
    total: int
    page: int
    limit: int
    pages: int
    groups: Optional[List[GroupInfo]] = None  # Populated only when group_by is active


class DevelopmentRequestResponse(DevelopmentRequestListResponse):
    comments: Optional[str] = None
    uat_request_id: Optional[str] = None
    parent_request_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    created_by_id: Optional[int] = None
    updated_by_id: Optional[int] = None
    created_by: Optional[UserBrief] = None
    updated_by: Optional[UserBrief] = None

    # M2M related requests
    related_requests: List[RelatedRequestBrief] = []

    module_lines: List[RequestModuleLineResponse] = []
    release_plan_lines: List[RequestReleasePlanLineResponse] = []
    comments_thread: List[RequestCommentResponse] = []
    attachments: List[RequestAttachmentResponse] = []

    permissions: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Reopen
# ---------------------------------------------------------------------------

class ReopenRequest(BaseModel):
    comment: str


# ---------------------------------------------------------------------------
# Related requests M2M management
# ---------------------------------------------------------------------------

class RelatedRequestAdd(BaseModel):
    related_request_id: int


# ---------------------------------------------------------------------------
# Bulk operations
# ---------------------------------------------------------------------------

class BulkAssignRequest(BaseModel):
    ids: List[int]
    assigned_developer_id: int


class BulkArchiveRequest(BaseModel):
    ids: List[int]


class BulkOperationResponse(BaseModel):
    succeeded: List[int]
    failed: List[int]
    errors: Dict[str, str] = {}


# ---------------------------------------------------------------------------
# Reject (state transition with mandatory comment)
# ---------------------------------------------------------------------------

class RejectRequest(BaseModel):
    request_state_id: int
    comment: str
