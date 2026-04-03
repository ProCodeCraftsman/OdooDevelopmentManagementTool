from fastapi import FastAPI

app = FastAPI(
    title="Odoo Module Dependency & Version Auditor",
    description="A stateful, secure, and queryable release management engine",
    version="0.1.0",
)


@app.get("/")
def root():
    return {"message": "Odoo Auditor API", "status": "operational"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
