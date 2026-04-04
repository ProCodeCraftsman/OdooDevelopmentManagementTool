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


class ControlParametersResponse(BaseModel):
    request_types: List[RequestTypeResponse]
    request_states: List[RequestStateResponse]
    functional_categories: List[FunctionalCategoryResponse]
    priorities: List[PriorityResponse]
