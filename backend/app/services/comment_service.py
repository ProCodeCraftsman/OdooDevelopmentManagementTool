from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.development_request import RequestComment
from app.models.user import User
from app.repositories.request_comment import RequestCommentRepository
from app.core.security_matrix import SecurityMatrixEngine, Permission


class CommentService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = RequestCommentRepository(db)

    def list_comments(self, request_id: int) -> List[RequestComment]:
        return self.repo.get_top_level(request_id)

    def add_comment(
        self,
        user: User,
        request_id: int,
        content: str,
        parent_comment_id: Optional[int] = None,
    ) -> RequestComment:
        if not content or not content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment content cannot be empty",
            )

        if parent_comment_id is not None:
            parent = self.repo.get_by_id_and_request(parent_comment_id, request_id)
            if not parent:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Parent comment not found on this request",
                )

        comment = RequestComment(
            request_id=request_id,
            user_id=user.id,
            content=content.strip(),
            parent_comment_id=parent_comment_id,
        )
        return self.repo.create(comment)

    def update_comment(
        self,
        user: User,
        request_id: int,
        comment_id: int,
        content: str,
    ) -> RequestComment:
        comment = self.repo.get_by_id_and_request(comment_id, request_id)
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Comment not found",
            )

        if comment.user_id != user.id and not SecurityMatrixEngine.has_permission(user, Permission.SYSTEM_MANAGE):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only edit your own comments",
            )

        if not content or not content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment content cannot be empty",
            )

        comment.content = content.strip()
        return self.repo.update(comment)

    def delete_comment(
        self,
        user: User,
        request_id: int,
        comment_id: int,
    ) -> None:
        comment = self.repo.get_by_id_and_request(comment_id, request_id)
        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Comment not found",
            )

        if comment.user_id != user.id and not SecurityMatrixEngine.has_permission(user, Permission.SYSTEM_MANAGE):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own comments",
            )

        self.db.delete(comment)
        self.db.commit()
