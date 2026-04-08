from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.saved_view import SavedView


class SavedViewRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, view_id: int) -> Optional[SavedView]:
        return self.db.query(SavedView).filter(SavedView.id == view_id).first()

    def get_for_user(self, user_id: int) -> List[SavedView]:
        """Return views owned by the user plus all public views from any user."""
        return (
            self.db.query(SavedView)
            .filter(
                (SavedView.user_id == user_id) | (SavedView.is_public == True)
            )
            .order_by(SavedView.user_id == user_id, SavedView.name)
            .all()
        )

    def get_all(self) -> List[SavedView]:
        """Admin: all views."""
        return self.db.query(SavedView).order_by(SavedView.name).all()

    def create(self, view: SavedView) -> SavedView:
        self.db.add(view)
        self.db.commit()
        self.db.refresh(view)
        return view

    def update(self, view: SavedView) -> SavedView:
        self.db.commit()
        self.db.refresh(view)
        return view

    def delete(self, view_id: int) -> bool:
        view = self.get(view_id)
        if not view:
            return False
        self.db.delete(view)
        self.db.commit()
        return True
