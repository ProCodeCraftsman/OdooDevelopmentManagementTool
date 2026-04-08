from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

DR_MACRO_TYPES = ("Development", "Non-development")
DR_MACRO_STATES = ("Draft", "In Progress", "Ready", "Done", "Cancelled")
RELEASE_PLAN_MACRO_STATES = (
    "Draft",
    "Planned",
    "Approved",
    "Executing",
    "Closed",
    "Failed",
)


class RequestTypeBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    is_active: bool = True
    display_order: int = 0


class RequestTypeCreate(RequestTypeBase):
    pass


class RequestTypeResponse(RequestTypeBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RequestStateBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    is_active: bool = True
    display_order: int = 0


class RequestStateCreate(RequestStateBase):
    pass


class RequestStateResponse(RequestStateBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FunctionalCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True
    display_order: int = 0


class FunctionalCategoryCreate(FunctionalCategoryBase):
    pass


class FunctionalCategoryResponse(FunctionalCategoryBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PriorityBase(BaseModel):
    name: str
    level: int
    is_active: bool = True
    display_order: int = 0


class PriorityCreate(PriorityBase):
    pass


class PriorityResponse(PriorityBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ControlParameterUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    display_order: Optional[int] = None


class ControlParametersResponse(BaseModel):
    request_types: List[RequestTypeResponse]
    request_states: List[RequestStateResponse]
    functional_categories: List[FunctionalCategoryResponse]
    priorities: List[PriorityResponse]
    state_type_rules: List["DevelopmentRequestStateTypeRuleResponse"] = []


class DevelopmentRequestStateTypeRuleBase(BaseModel):
    request_state_id: int
    request_type_id: int
    is_active: bool = True


class DevelopmentRequestStateTypeRuleCreate(DevelopmentRequestStateTypeRuleBase):
    pass


class DevelopmentRequestStateTypeRuleUpdate(BaseModel):
    request_state_id: Optional[int] = None
    request_type_id: Optional[int] = None
    is_active: Optional[bool] = None


class DevelopmentRequestStateTypeRuleResponse(DevelopmentRequestStateTypeRuleBase):
    id: int
    request_state_name: str
    request_state_category: str
    request_type_name: str
    request_type_category: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DevelopmentRequestStateTypeRuleListResponse(BaseModel):
    rules: List[DevelopmentRequestStateTypeRuleResponse]
