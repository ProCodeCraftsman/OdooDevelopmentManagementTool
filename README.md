Odoo Module Dependency Analyzer

A professional, modular tool designed to fetch Odoo module data and perform an expanded dependency analysis across multiple environments simultaneously. It captures network fetch times and local processing times separately to monitor performance.
📁 Project Structure

    app/core/: Contains the core logic.

        odoo_xmlprc_config.py: The engine. Handles authentication, XML-RPC calls, and the Pandas merger logic.

        config_manager.py: The registry manager. Handles reading and writing server credentials in environments.json.

        get_env_module_data.py: The execution layer. Coordinates fetching and saving to the correct directory.

    data/env_data/: The destination for all generated CSV reports.

    environments.json: The central secure registry for all your Odoo server credentials.

    requirements.txt: Lists necessary libraries (pandas, python-dotenv).

🛠️ Initial Setup

    Create a Virtual Environment:
    Bash

    python3 -m venv venv

    Activate the Environment:

        Mac/Linux: source venv/bin/activate

        Windows: .\venv\Scripts\activate

    Install Dependencies:
    Bash

    pip install -r requirements.txt

    Configure Environments:
    The system no longer uses .env. Instead, populate your environments.json in the root folder with your server details:
    JSON

    {
      "DEVELOPMENT": {
        "url": "https://dev-url.com",
        "db": "DB_NAME",
        "user": "email@gpsrenewables.com",
        "pass": "your_api_key"
      }
    }

🚀 Execution

To run the extraction, always execute from the root directory using the module flag (-m). This ensures all internal paths and imports resolve correctly.

To run for ALL environments:
Bash

python3 -m app.core.get_env_module_data --env all

To run for a SPECIFIC environment:
Bash

python3 -m app.core.get_env_module_data --env DEVELOPMENT

🔑 Critical Information & Security

    [!IMPORTANT]
    API Key Security
    Never commit environments.json to version control (Git). This file contains plain-text credentials. Ensure it is listed in your .gitignore.

    Data Exports: All files are automatically saved to data/env_data/ with a timestamp (YYYYMMDD_HHMM) to prevent overwriting previous audits.

    Performance Tracking: The console output will show you Fetch Time (Odoo server latency) vs. Process Time (Pandas local overhead). This helps identify if a delay is due to the network or the amount of data.

    Dependency Expansion: The report uses a "Left Join" logic. If a module has 5 dependencies, you will see 5 rows for that module. If a module has 0 dependencies, it will show as 1 row with None values.

    Odoo 17 Compatibility: This tool is optimized for Odoo 17’s XML-RPC structure and handles One2Many dependency relationships efficiently.

⚙️ Managing Configurations

To add or remove environments via the Python terminal:
Python

from app.core import config_manager

# Add a new environment
config_manager.add_env("PRODUCTION", "https://odoo.com", "DB_NAME", "user", "pass")

# List current environments
print(config_manager.list_envs())