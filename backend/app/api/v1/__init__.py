from fastapi import APIRouter
from app.api.v1 import auth, environments, sync, reports, roles, users, development_requests

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(environments.router)
api_router.include_router(sync.router)
api_router.include_router(reports.router)
api_router.include_router(roles.router)
api_router.include_router(users.router)
api_router.include_router(development_requests.router)
