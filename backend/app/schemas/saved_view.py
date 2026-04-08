from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class FilterToken(BaseModel):
    """A single active filter with both IDs (for API calls) and labels (for display)."""
    field: str  # e.g. "request_state_ids", "priority_ids"
    ids: List[str]
    labels: List[str]


class QueryState(BaseModel):
    """
    Serialisable representation of every query parameter in the list view.
    IDs are always authoritative; labels are cached display strings that remain
    valid even if the underlying name is later changed.
    """
    filters: List[FilterToken] = Field(default_factory=list)
    search: str = ""
    group_by: Optional[str] = None
    show_archived: bool = False


class SavedViewCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    is_public: bool = False
    query_state: QueryState


class SavedViewUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    is_public: Optional[bool] = None
    query_state: Optional[QueryState] = None


class SavedViewResponse(BaseModel):
    id: int
    user_id: int
    name: str
    is_public: bool
    query_state: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    owner_username: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_with_owner(cls, obj: Any) -> "SavedViewResponse":
        data = cls.model_validate(obj)
        if obj.user:
            data.owner_username = obj.user.username
        return data
