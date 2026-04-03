import json
import pandas as pd
from datetime import datetime
from app.core import paths, config_manager

def parse_semver(v_str):
    """
    Numeric component-wise version comparison.
    Converts '17.0.1.10' -> (17, 0, 1, 10).
    """
    if pd.isna(v_str) or str(v_str).strip() in ["", "None", "N/A", "Missing Module"]:
        return None
    try:
        # Debugging: print(f"Parsing version: {v_str}") 
        return tuple(map(int, str(v_str).split('.')))
    except (ValueError, AttributeError):
        return (0,)

def calculate_release_action(source_v, target_v):
    """
    Strict Release Management Action Logic.
    Source: Higher Order (e.g., Dev=4) | Target: Next Lower Order (e.g., Test=3)
    """
    s_val = parse_semver(source_v)
    t_val = parse_semver(target_v)

    # 1. Missing in Source check (Highest priority error)
    if s_val is None and t_val is not None:
        return "Error: Missing in Source"
    
    # 2. Missing Module check (Current environment)
    if t_val is None:
        return "Missing Module"

    # 3. Semantic Comparison
    if s_val > t_val:
        return "Upgrade"
    if s_val == t_val:
        return "No Action"
    if t_val > s_val:
        return "Error" # Downgrade or Regression
    
    return "Unknown"

def generate_comparison_report():
    """Generates the Master Comparison Report using directional environment flow."""
    paths.ensure_paths()
    envs = config_manager.load_config()
    
    # Load update logs for 'Sync Date' headers
    logs = {}
    if paths.LOG_FILE.exists():
        with open(paths.LOG_FILE, 'r') as f:
            logs = json.load(f)

    # Validate Master File exists
    if not paths.MASTER_FILE.exists():
        print("❌ Error: module_master.csv missing. Run sync first.")
        return

    # STARTING POINT: Use Module Master for unique names only
    # This guarantees no historical modules are dropped
    master_df = pd.read_csv(paths.MASTER_FILE)
    report_df = master_df[['name', 'shortdesc']].copy()
    report_df.rename(columns={'name': 'Technical Name', 'shortdesc': 'Module Name'}, inplace=True)

    # SORT ENVIRONMENTS: By order parameter (Source to Target flow)
    # Highest Order (Dev: 4) -> (Test: 3) -> (Staging: 2) -> (Prod: 1)
    sorted_envs = sorted(envs.items(), key=lambda x: x[1].get('order', 0), reverse=True)
    
    prev_env_name = None

    for name, config in sorted_envs:
        env_file = paths.ENV_DATA_DIR / f"report_{name}.csv"
        last_update = logs.get(name, {}).get('last_update', 'N/A')
        
        # 1. Load and DEDUPLICATE current environment data
        if env_file.exists():
            env_raw = pd.read_csv(env_file)
            # Ensure unique module entries per file
            env_clean = env_raw[['name', 'state', 'installed_version']].drop_duplicates('name')
            
            # 2. Define dynamic column names with sync date in Status
            status_col = f"{name}_Status ({last_update})"
            ver_col = f"{name}_Version"
            action_col = f"{name}_Action"

            env_clean.rename(columns={
                'state': status_col,
                'installed_version': ver_col
            }, inplace=True)

            # 3. Merge environment data into Master Report
            report_df = pd.merge(report_df, env_clean, left_on='Technical Name', right_on='name', how='left')
            report_df.drop(columns=['name'], inplace=True)

            # 4. Fill Nulls for status/version
            report_df[status_col] = report_df[status_col].fillna("Missing Module")
            report_df[ver_col] = report_df[ver_col].fillna("N/A")

            # 5. ACTION LOGIC: Compare against the previous (Source) environment
            if prev_env_name:
                prev_ver_col = f"{prev_env_name}_Version"
                # Debugging: print(f"Comparing {prev_env_name} vs {name}")
                report_df[action_col] = report_df.apply(
                    lambda row: calculate_release_action(row[prev_ver_col], row[ver_col]), axis=1
                )
            else:
                # The Highest Order Environment (Source of all) has no comparison
                report_df[action_col] = "SOURCE"

            prev_env_name = name
        else:
            print(f"⚠️ Warning: Data file missing for {name}. Report may be incomplete.")

    # Final Save
    report_df.to_csv(paths.COMPARISON_REPORT, index=False)
    print(f"🚀 Master Comparison Report Generated: {paths.COMPARISON_REPORT}")

if __name__ == "__main__":
    generate_comparison_report()