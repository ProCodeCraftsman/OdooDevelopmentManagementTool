from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from app.models.development_request import RequestComment
from app.repositories.base import BaseRepository


class RequestCommentRepository(BaseRepository[RequestComment]):
    def __init__(self, db: Session):
        super().__init__(RequestComment, db)

    def get_top_level(self, request_id: int) -> List[RequestComment]:
        """Return root-level comments (no parent) with nested replies eager-loaded."""
        return (
            self.db.query(RequestComment)
            .options(
                joinedload(RequestComment.user),
                joinedload(RequestComment.replies).joinedload(RequestComment.user),
            )
            .filter(
                RequestComment.request_id == request_id,
                RequestComment.parent_comment_id.is_(None),
            )
            .order_by(RequestComment.created_at.asc())
            .all()
        )

    def get_by_id_and_request(
        self, comment_id: int, request_id: int
    ) -> Optional[RequestComment]:
        return (
            self.db.query(RequestComment)
            .filter(
                RequestComment.id == comment_id,
                RequestComment.request_id == request_id,
            )
            .first()
        )
