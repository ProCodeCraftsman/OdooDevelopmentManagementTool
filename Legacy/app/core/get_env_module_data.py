import os
import time
import argparse
import pandas as pd
import json
from datetime import datetime
from pathlib import Path
from app.core import paths, config_manager
from app.core.odoo_xmlprc_config import OdooModuleReporter 
from app.core.module_master import update_module_master


def update_audit_log(env_name: str, metrics: dict):
    """Updates the central JSON log file with the latest run metadata."""
    log_data = {}
    
    # Load existing logs if the file exists
    if paths.LOG_FILE.exists():
        try:
            with open(paths.LOG_FILE, 'r') as f:
                log_data = json.load(f)
        except json.JSONDecodeError:
            log_data = {}

    # Update the record for this specific environment
    log_data[env_name] = metrics

    # Write back to the log file
    with open(paths.LOG_FILE, 'w') as f:
        json.dump(log_data, f, indent=4)

def execute_for_env(env_name):
    config = config_manager.load_config()
    data = config.get(env_name)
    
    if not data:
        print(f"❌ Error: Environment '{env_name}' not found in registry.")
        return

    # Ensure the data directory exists
    os.makedirs(paths.ENV_DATA_DIR, exist_ok=True)

    print(f"🚀 Processing: {env_name}...")
    reporter = OdooModuleReporter(env_name, data['url'], data['db'], data['user'], data['pass'])
    
    if reporter.connect():
        #timing operations
        t1 = time.perf_counter()
        m_raw, d_raw = reporter.fetch_raw_data()
        fetch_time = time.perf_counter() - t1
        
        t2 = time.perf_counter()
        df = reporter.process_report(m_raw, d_raw)
        process_time = time.perf_counter() - t2
        
        # Unique file per odoo server
        timestamp = datetime.now().strftime("%Y%m%d_%H%M")
        filename = f"report_{env_name}.csv"
        save_path = paths.ENV_DATA_DIR / filename
        df.to_csv(save_path, index=False)

        # 4. Update Audit Log for current environment module details update
        metrics = {
            "status": "Success",
            "last_update": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "rows_generated": len(df),
            "fetch_time_sec": round(fetch_time, 4),
            "process_time_sec": round(process_time, 4),
            "file_saved": str(save_path.relative_to(paths.BASE_DIR))
        }
        update_audit_log(env_name, metrics)
        #module master update for any new modules to add to master
        update_module_master(df)
        
        print(f"✅ Saved to {save_path}")
        print(f"Fetch Time:   {fetch_time:.4f}s")
        print(f"Process Time: {process_time:.4f}s")
        print(f"Total Rows Generated:  {len(df)}")
    else:
        print(f"❌ Failed to connect to {env_name}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Odoo Multi-Env Reporter")
    parser.add_argument("--env", help="Target environment name (or 'all')", default="all")
    args = parser.parse_args()

    available_envs = config_manager.list_envs()

    if args.env == "all":
        for target in available_envs:
            execute_for_env(target)
    else:
        execute_for_env(args.env)