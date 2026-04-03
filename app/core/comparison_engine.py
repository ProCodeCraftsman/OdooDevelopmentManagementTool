import pandas as pd
import json
from pathlib import Path
from packaging import version # Standard lib for semantic versioning

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data/env_data"
LOG_FILE = BASE_DIR / "data/env_data/update_log.json"
MASTER_FILE = BASE_DIR / "data/module_master/module_master.csv"


def parse_semver(v_str):
    """Converts Odoo version strings into comparable tuples (17.0.1.0.9 -> (17,0,1,0,9))."""
    if pd.isna(v_str) or v_str == "None" or v_str == "N/A":
        return None
    try:
        # Split by dots and convert each part to integer for numeric comparison
        return tuple(map(int, str(v_str).split('.')))
    except ValueError:
        return (0,) # Fallback for non-numeric versions

def calculate_action(source_v, target_v):
    """Strict Release Management Logic."""
    s = parse_semver(source_v)
    t = parse_semver(target_v)

    if s is None and t is None: return "Missing Module"
    if s is None and t is not None: return "Error: Missing in Source"
    if t is None: return "Missing Module" # Target is missing, but source has it
    
    if s > t: return "Upgrade"
    if s == t: return "No Action"
    if t > s: return "Error" # Downgrade/Regression
    return "Unknown"

def generate_comparison_report():
    """Generates the Master Comparison CSV across all environments."""
    from app.core import config_manager
    envs = config_manager.load_config()
    logs = {}
    if LOG_FILE.exists():
        with open(LOG_FILE, 'r') as f: logs = json.load(f)

    # 1. Start with the Module Master
    master_path = BASE_DIR / "data" / "module_master.csv"
    if not master_path.exists():
        print("❌ Error: module_master.csv not found. Sync data first.")
        return
    
    report_df = pd.read_csv(master_path)[['name', 'shortdesc']]
    report_df.rename(columns={'name': 'Technical Name', 'shortdesc': 'Module Name'}, inplace=True)

    # 2. Sort environments by order (Highest to Lowest)
    sorted_envs = sorted(envs.items(), key=lambda x: x[1].get('order', 99), reverse=True)
    
    # 3. Iteratively Merge Environment Data
    prev_env_name = None
    
    for name, config in sorted_envs:
        env_file = DATA_DIR / f"report_{name}.csv"
        last_update = logs.get(name, {}).get('last_update', 'Unknown Date')
        
        if env_file.exists():
            env_df = pd.read_csv(env_file)[['name', 'state', 'installed_version']].drop_duplicates('name')
            
            # Create environment-specific columns
            status_col = f"{name} Status ({last_update})"
            ver_col = f"{name} Version"
            action_col = f"{name} Action"
            
            env_df.rename(columns={
                'state': status_col,
                'installed_version': ver_col
            }, inplace=True)

            # Merge into master report
            report_df = pd.merge(report_df, env_df, left_on='Technical Name', right_on='name', how='left')
            report_df.drop(columns=['name'], inplace=True)
            report_df[status_col] = report_df[status_col].fillna("Missing Module")
            report_df[ver_col] = report_df[ver_col].fillna("N/A")

            # 4. Calculate Action relative to the PREVIOUS (higher order) environment
            if prev_env_name:
                prev_ver_col = f"{prev_env_name} Version"
                report_df[action_col] = report_df.apply(
                    lambda row: calculate_action(row[prev_ver_col], row[ver_col]), axis=1
                )
            else:
                # The highest order environment has no "source", so action is N/A or initial
                report_df[action_col] = "Source"

            prev_env_name = name
        else:
            print(f"⚠️ Warning: Missing data for {name}")

    # Save Report
    output_path = BASE_DIR / "data" / "comparison_report.csv"
    report_df.to_csv(output_path, index=False)
    print(f"🚀 Comparison Report generated at: {output_path}")