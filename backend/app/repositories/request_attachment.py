from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from app.models.development_request import RequestAttachment
from app.repositories.base import BaseRepository


class RequestAttachmentRepository(BaseRepository[RequestAttachment]):
    def __init__(self, db: Session):
        super().__init__(RequestAttachment, db)

    def get_by_request(self, request_id: int) -> List[RequestAttachment]:
        return (
            self.db.query(RequestAttachment)
            .options(joinedload(RequestAttachment.uploaded_by))
            .filter(RequestAttachment.request_id == request_id)
            .order_by(RequestAttachment.created_at.desc())
            .all()
        )

    def get_by_id_and_request(
        self, attachment_id: int, request_id: int
    ) -> Optional[RequestAttachment]:
        return (
            self.db.query(RequestAttachment)
            .filter(
                RequestAttachment.id == attachment_id,
                RequestAttachment.request_id == request_id,
            )
            .first()
        )
