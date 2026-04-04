from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict


class RequestModuleLineBase(BaseModel):
    module_id: Optional[int] = None
    module_technical_name: str
    module_version: Optional[str] = None
    module_md5_sum: Optional[str] = None
    email_thread_zip: Optional[str] = None


class RequestModuleLineCreate(RequestModuleLineBase):
    pass


class RequestModuleLineResponse(RequestModuleLineBase):
    id: int
    request_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


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


class DevelopmentRequestBase(BaseModel):
    request_type_id: int
    functional_category_id: int
    priority_id: int
    description: str
    comments: Optional[str] = None
    uat_request_id: Optional[str] = None
    assigned_developer_id: Optional[int] = None
    parent_request_id: Optional[int] = None
    related_request_id: Optional[int] = None


class DevelopmentRequestCreate(DevelopmentRequestBase):
    request_state_id: Optional[int] = None


class DevelopmentRequestUpdate(BaseModel):
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
    request_type_id: int
    functional_category_id: int
    request_state_id: int
    priority_id: int
    description: str
    assigned_developer_id: Optional[int]
    request_date: datetime
    request_close_date: Optional[datetime]
    iteration_counter: int

    request_type: RequestTypeBrief
    functional_category: FunctionalCategoryBrief
    request_state: RequestStateBrief
    priority: PriorityBrief
    assigned_developer: Optional[UserBrief]

    model_config = ConfigDict(from_attributes=True)


class DevelopmentRequestResponse(DevelopmentRequestListResponse):
    comments: Optional[str]
    uat_request_id: Optional[str]
    parent_request_id: Optional[int]
    related_request_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    module_lines: List[RequestModuleLineResponse]
    release_plan_lines: List[RequestReleasePlanLineResponse]
    permissions: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class ReopenRequest(BaseModel):
    comment: str
