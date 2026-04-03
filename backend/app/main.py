from fastapi import FastAPI
from app.api.v1 import api_router

app = FastAPI(
    title="Odoo Module Dependency & Version Auditor",
    description="A stateful, secure, and queryable release management engine",
    version="0.1.0",
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "Odoo Auditor API", "status": "operational"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
