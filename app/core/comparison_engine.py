import pandas as pd
import json
from datetime import datetime
# from app.core import config_manager
from app.core.paths import ENV_DATA_DIR, LOG_FILE, MASTER_FILE, COMPARISON_REPORT, ensure_paths

def parse_semver(v_str):
    """Numeric component-wise version comparison (17.0.0.1.9 < 17.0.0.1.10)."""
    if pd.isna(v_str) or v_str in ["None", "N/A", "Missing Module"]:
        return None
    try:
        return tuple(map(int, str(v_str).split('.')))
    except (ValueError, AttributeError):
        return (0,)

def calculate_action(source_v, target_v):
    """Release management logic Source (Higher Order) -> Target (Lower Order)."""
    s = parse_semver(source_v)
    t = parse_semver(target_v)

    if s is None and t is None: return "Missing Module"
    if s is None and t is not None: return "Error: Missing in Source"
    if t is None: return "Missing Module"
    
    if s > t: return "Upgrade"
    if s == t: return "No Action"
    if t > s: return "Error"
    return "Unknown"

def generate_comparison_report():
    """Generates the Master Comparison CSV using module_master as the spine."""
    ensure_paths()
    envs = config_manager.load_config()
    logs = {}
    if LOG_FILE.exists():
        with open(LOG_FILE, 'r') as f: logs = json.load(f)

    if not MASTER_FILE.exists():
        print("❌ Error: module_master.csv missing. Run a sync first.")
        return

    # 1. Initialize with Module Master
    report_df = pd.read_csv(MASTER_FILE)[['name', 'shortdesc']]
    report_df.rename(columns={'name': 'Technical Name', 'shortdesc': 'Module Name'}, inplace=True)

    # 2. Sort Envs by Order (Source [Highest] -> Target [Lowest])
    sorted_envs = sorted(envs.items(), key=lambda x: x[1].get('order', 99), reverse=True)
    
    prev_env_name = None
    for name, config in sorted_envs:
        env_file = ENV_DATA_DIR / f"report_{name}.csv"
        update_time = logs.get(name, {}).get('last_update', 'N/A')
        
        if env_file.exists():
            env_df = pd.read_csv(env_file)[['name', 'state', 'installed_version']]
            
            # Column naming convention
            status_col = f"{name} Status ({update_time})"
            ver_col = f"{name} Version"
            action_col = f"{name} Action"
            
            env_df.rename(columns={'state': status_col, 'installed_version': ver_col}, inplace=True)
            
            # Left merge onto master spine
            report_df = pd.merge(report_df, env_df, left_on='Technical Name', right_on='name', how='left')
            report_df.drop(columns=['name'], inplace=True)
            report_df[status_col] = report_df[status_col].fillna("Missing Module")
            report_df[ver_col] = report_df[ver_col].fillna("N/A")

            # 3. Action Logic: Compare Current (Target) to Previous (Source)
            if prev_env_name:
                prev_ver_col = f"{prev_env_name} Version"
                report_df[action_col] = report_df.apply(
                    lambda row: calculate_action(row[prev_ver_col], row[ver_col]), axis=1
                )
            else:
                report_df[action_col] = "Source (Highest)"
            
            prev_env_name = name
        else:
            print(f"⚠️ Warning: No data found for {name}")

    report_df.to_csv(COMPARISON_REPORT, index=False)
    print(f"🚀 Comparison Report Saved: {COMPARISON_REPORT}")

generate_comparison_report()