from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.development_request import RequestModuleLine
from app.repositories.base import BaseRepository


class RequestModuleLineRepository(BaseRepository[RequestModuleLine]):
    def __init__(self, db: Session):
        super().__init__(RequestModuleLine, db)

    def get_by_request_id(self, request_id: int) -> List[RequestModuleLine]:
        return (
            self.db.query(RequestModuleLine)
            .filter(RequestModuleLine.request_id == request_id)
            .all()
        )

    def get_by_id_and_request(self, line_id: int, request_id: int) -> Optional[RequestModuleLine]:
        return (
            self.db.query(RequestModuleLine)
            .filter(
                RequestModuleLine.id == line_id,
                RequestModuleLine.request_id == request_id
            )
            .first()
        )

    def create_for_request(self, request_id: int, **kwargs) -> RequestModuleLine:
        obj = RequestModuleLine(request_id=request_id, **kwargs)
        return self.create(obj)
