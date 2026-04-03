from fastapi import APIRouter
from app.api.v1 import auth, environments, sync, reports

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(environments.router)
api_router.include_router(sync.router)
api_router.include_router(reports.router)
