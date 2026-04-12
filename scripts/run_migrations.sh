#!/bin/bash
# =============================================================================
# Alembic Migration Runner Script
# =============================================================================
# Usage:
#   ./scripts/run_migrations.sh          # Run all pending migrations
#   ./scripts/run_migrations.sh -1      # Rollback one migration
#   ./scripts/run_migrations.sh seed   # Run seed scripts
# =============================================================================

set -e

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "[migration-runner] Starting..."

# Check DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    if [ -f .env ]; then
        echo "[migration-runner] Loading .env..."
        set -a
        source .env
        set +a
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo "[migration-runner] ERROR: DATABASE_URL not set"
    echo "[migration-runner] Set DATABASE_URL or ensure .env exists"
    exit 1
fi

echo "[migration-runner] DATABASE_URL set: ${DATABASE_URL%@*}@..."

CMD="${1:-upgrade}"

case "$CMD" in
    upgrade)
        echo "[migration-runner] Running migrations (upgrade)..."
        cd backend
        alembic upgrade head
        ;;
    downgrade|-1)
        echo "[migration-runner] Rolling back one migration..."
        cd backend
        alembic downgrade -1
        ;;
    seed)
        echo "[migration-runner] Running seed scripts..."
        cd backend
        python scripts/seed_roles.py
        python scripts/seed_development_request_params.py
        python scripts/seed_admin.py
        ;;
    reset)
        echo "[migration-runner] Resetting database (WARNING: destroys all data)..."
        read -p "Are you sure? Type 'yes' to confirm: " confirm
        if [ "$confirm" = "yes" ]; then
            cd backend
            alembic downgrade base
            alembic upgrade head
        else
            echo "[migration-runner] Cancelled"
        fi
        ;;
    *)
        echo "[migration-runner] Unknown command: $CMD"
        echo "[migration-runner] Usage: ./scripts/run_migrations.sh [upgrade|downgrade|seed|reset]"
        exit 1
        ;;
esac

echo "[migration-runner] Done!"