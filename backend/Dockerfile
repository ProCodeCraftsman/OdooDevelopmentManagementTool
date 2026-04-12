# =============================================================================
# Stage 1: Builder - Install build dependencies
# =============================================================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# =============================================================================
# Stage 2: Runner - Production image
# =============================================================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser

# Copy Python packages from builder stage
COPY --from=builder /root/.local /home/appuser/.local

# Copy application code
COPY --chown=appuser:appuser app/ ./app/
COPY --chown=appuser:appuser alembic/ ./alembic/
COPY --chown=appuser:appuser scripts/ ./scripts/
COPY --chown=appuser:appuser requirements.txt .
COPY --chown=appuser:appuser alembic.ini .

# Copy import data (development requests)
COPY --chown=appuser:appuser import_data/ ./import_data/

# Make entrypoint executable
RUN chmod +x scripts/init.sh

# Set PATH to include user-local bin
ENV PATH=/home/appuser/.local/bin:$PATH

# Switch to non-root user
USER appuser

EXPOSE 8000

ENTRYPOINT ["/app/scripts/init.sh"]