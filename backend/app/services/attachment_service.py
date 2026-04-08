import uuid
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.development_request import RequestAttachment
from app.models.user import User
from app.repositories.request_attachment import RequestAttachmentRepository
from app.core.security_matrix import SecurityMatrixEngine, Permission

# Directory relative to the backend working directory
UPLOAD_BASE_DIR = Path("uploads")

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

ALLOWED_MIME_TYPES = {
    # Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    # Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    # Archives
    "application/zip",
    "application/x-zip-compressed",
    "application/x-zip",
}


def _request_upload_dir(request_id: int) -> Path:
    d = UPLOAD_BASE_DIR / str(request_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


class AttachmentService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = RequestAttachmentRepository(db)

    def list_attachments(self, request_id: int) -> List[RequestAttachment]:
        return self.repo.get_by_request(request_id)

    def upload(
        self,
        user: User,
        request_id: int,
        file: UploadFile,
    ) -> RequestAttachment:
        # Read content first to validate size
        content = file.file.read()

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum allowed size is 5 MB.",
            )

        mime_type = file.content_type or ""
        if mime_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"File type '{mime_type}' is not allowed. "
                    "Accepted: images (JPEG/PNG/GIF/WebP/BMP), PDF, Word, Excel, ZIP."
                ),
            )

        # Build stored filename: uuid + original extension
        original_name = file.filename or "upload"
        suffix = Path(original_name).suffix.lower()
        stored_name = f"{uuid.uuid4().hex}{suffix}"

        upload_dir = _request_upload_dir(request_id)
        file_path = upload_dir / stored_name

        file_path.write_bytes(content)

        attachment = RequestAttachment(
            request_id=request_id,
            original_name=original_name,
            stored_name=stored_name,
            mime_type=mime_type,
            file_size=len(content),
            storage_path=str(file_path),
            uploaded_by_id=user.id,
            created_at=datetime.utcnow(),
        )
        return self.repo.create(attachment)

    def delete(
        self,
        user: User,
        request_id: int,
        attachment_id: int,
    ) -> None:
        attachment = self.repo.get_by_id_and_request(attachment_id, request_id)
        if not attachment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment not found",
            )

        if attachment.uploaded_by_id != user.id and not SecurityMatrixEngine.has_permission(user, Permission.ATTACHMENTS_DELETE):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own attachments",
            )

        # Remove physical file (best-effort)
        file_path = Path(attachment.storage_path)
        if file_path.exists():
            file_path.unlink()

        self.db.delete(attachment)
        self.db.commit()

    def get_file_path(self, request_id: int, attachment_id: int) -> tuple[Path, RequestAttachment]:
        """Return (absolute_path, attachment_record) for the download endpoint."""
        attachment = self.repo.get_by_id_and_request(attachment_id, request_id)
        if not attachment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment not found",
            )

        file_path = Path(attachment.storage_path)
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment file not found on server",
            )

        return file_path, attachment
