#!/bin/bash
set -e

echo "[init] Starting database initialization..."

cd /app

# DATABASE_URL is passed from docker-compose.yml and read by app.core.config.get_settings()
echo "[init] Starting DB initialization..."

echo "[init] Running Alembic migrations..."

cd /app
alembic upgrade head || { echo "[init] Migration failed, exiting"; exit 1; }

# Seed data (idempotent - skip if already seeded)
echo "[init] Seeding roles..."
python scripts/seed_roles.py

echo "[init] Seeding control parameters..."
python scripts/seed_development_request_params.py

echo "[init] Seeding admin user..."
python scripts/seed_admin.py

# Import development requests from data folder (if exists)
if [ -f /app/import_data/import_ready.json ]; then
    echo "[init] Importing development requests..."
    cd /app
    python import_data/import_dr.py || echo "[init] WARNING: DR import failed, continuing..."
fi

echo "[init] Database initialization complete. Starting application..."

# Start uvicorn
exec uvicorn app.main:app --host 0.0.0.0 --port 8000