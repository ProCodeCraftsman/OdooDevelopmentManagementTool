Odoo Module Dependency & Version Auditor

A professional release management tool designed to synchronize Odoo 17 module data across multiple environments and perform a Directional Version Comparison. This tool helps identify regressions, missing modules, and pending upgrades to ensure a smooth deployment lifecycle.
🚀 Key Features

    Multi-Env Sync: Simultaneous data extraction from Dev, Staging, DR, and Production.

    Evergreen Module Master: An append-only registry that tracks every unique technical name ever discovered.

    Semantic Versioning: Numeric component-wise comparison (e.g., 17.0.1.10 > 17.0.1.9).

    Release Management Actions: Automatically calculates actions (Upgrade, No Action, Error) based on environment hierarchy.

    Audit Logging: Tracks last_update timestamps and performance metrics in a centralized JSON log.

📁 Project Structure

Based on the current architecture:
Plaintext

Odoo Module Dependency Analyzer/
├── app/
│   └── core/
│       ├── odoo_xmlprc_config.py      # The XML-RPC & Pandas engine
│       ├── server_env_config_manager.py # Registry manager for environments.json
│       ├── get_env_module_data.py     # Main fetcher & sync execution layer
│       ├── module_master.py           # Logic for evergreen module tracking
│       ├── comparison_engine.py       # Cross-environment audit & action logic
│       └── paths.py                    # Centralized path & directory management
├── data/
│   ├── env_data/                      # Individual server CSVs & update_log.json
│   ├── module_master/                 # module_master.csv (The source of truth)
│   └── report/                        # Final comparison_report.csv
├── environments.json                  # Secure server credentials & order config
├── requirements.txt                   # pandas, python-dotenv
└── .gitignore                         # Protects credentials and local data

🛠️ Initial Setup
1. Environment Preparation
Bash

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

2. Configure environments.json

Populate your environments.json in the root folder. The order parameter determines the comparison direction (Higher Order → Lower Order).
JSON

{
  "DEVELOPMENT": {
    "order": 4,
    "url": "https://dev-odoo.com",
    "db": "DB_DEV",
    "user": "admin@company.com",
    "pass": "api-key"
  },
  "PRODUCTION": {
    "order": 1,
    "url": "https://prod-odoo.com",
    "db": "DB_PROD",
    "user": "admin@company.com",
    "pass": "api-key"
  }
}

🚀 Execution Workflow
Step 1: Sync Data

Fetches the latest state from Odoo and updates the Module Master.
Bash

# Sync all environments
python3 -m app.core.get_env_module_data --env all

# Sync specific environment
python3 -m app.core.get_env_module_data --env DEVELOPMENT

Step 2: Generate Comparison Report

Analyzes versions across the pipeline and assigns release actions.
Bash

python3 -m app.core.comparison_engine

Output saved to: data/report/comparison_report.csv
⚖️ Release Management Logic

The Action status is calculated by comparing a Source (Higher Order) to a Target (Next Lower Order):
Status	Condition
Upgrade	Source Version > Target Version (Ready for release)
No Action	Source Version == Target Version (Synced)
Error (Downgrade)	Target Version > Source Version (Regression/Manual Change)
Error (Missing in Source)	Module exists in Target but is missing in the Source environment
Missing Module	Module exists in Master but is missing in the Target environment
🔑 Security & Maintenance

    Credential Safety: environments.json contains sensitive API keys. Never commit this file to Git.

    Path Integrity: All file operations are handled by paths.py. Do not move files manually between data subfolders.

    Module Master: The module_master.csv is the anchor for the entire system. If you need to reset the tracker, delete this file and re-sync all environments.

    Performance: Performance metrics (Fetch vs. Process time) are recorded in data/env_data/server_env_data_update_log.json.