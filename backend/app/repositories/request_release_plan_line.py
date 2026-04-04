from typing import List
from sqlalchemy.orm import Session
from app.models.development_request import RequestReleasePlanLine
from app.repositories.base import BaseRepository


class RequestReleasePlanLineRepository(BaseRepository[RequestReleasePlanLine]):
    def __init__(self, db: Session):
        super().__init__(RequestReleasePlanLine, db)

    def get_by_request_id(self, request_id: int) -> List[RequestReleasePlanLine]:
        return (
            self.db.query(RequestReleasePlanLine)
            .filter(RequestReleasePlanLine.request_id == request_id)
            .all()
        )

    def create_for_request(self, request_id: int, **kwargs) -> RequestReleasePlanLine:
        obj = RequestReleasePlanLine(request_id=request_id, **kwargs)
        return self.create(obj)

    def all_deployed_to_production(self, request_id: int) -> bool:
        lines = self.get_by_request_id(request_id)
        if not lines:
            return False
        return all(line.release_plan_status == "Deployed to Production" for line in lines)
