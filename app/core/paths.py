import os
from pathlib import Path

# Absolute path to the project root (Fecth_odoo_module_data_python)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Data Directories
DATA_DIR = BASE_DIR / "data"
ENV_DATA_DIR = DATA_DIR / "env_data"
MASTER_DIR = DATA_DIR / "module_master"
REPORT_DIR = DATA_DIR / "report"


# Files
LOG_FILE = ENV_DATA_DIR / "server_env_data_update_log.json"
MASTER_FILE = MASTER_DIR / "module_master.csv"
COMPARISON_REPORT = REPORT_DIR / "comparison_report.csv"
CONFIG_FILE=BASE_DIR / "environments.json"

def ensure_paths():
    """Utility to ensure all required directories exist."""
    for folder in [ENV_DATA_DIR, MASTER_DIR, REPORT_DIR]:
        folder.mkdir(parents=True, exist_ok=True)