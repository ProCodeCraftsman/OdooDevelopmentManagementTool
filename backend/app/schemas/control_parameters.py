from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


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


class ControlParametersResponse(BaseModel):
    request_types: List[RequestTypeResponse]
    request_states: List[RequestStateResponse]
    functional_categories: List[FunctionalCategoryResponse]
    priorities: List[PriorityResponse]


class ControlParameterRuleBase(BaseModel):
    request_state_name: str
    allowed_type_categories: str = "ALL"
    allowed_priorities: str = "ALL"
    allowed_functional_categories: str = "ALL"
    is_active: bool = True


class ControlParameterRuleCreate(ControlParameterRuleBase):
    pass


class ControlParameterRuleUpdate(BaseModel):
    request_state_name: Optional[str] = None
    allowed_type_categories: Optional[str] = None
    allowed_priorities: Optional[str] = None
    allowed_functional_categories: Optional[str] = None
    is_active: Optional[bool] = None


class ControlParameterRuleResponse(ControlParameterRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ControlParameterRuleListResponse(BaseModel):
    rules: List[ControlParameterRuleResponse]
