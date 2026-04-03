import json
import pandas as pd
from datetime import datetime
from app.core import paths, server_env_config_manager

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
    Directional Release Logic:
    Source = Higher Order (e.g., Dev=4) | Target = Current (e.g., Test=3)
    """
    s_val = parse_semver(source_v)
    t_val = parse_semver(target_v)

    # DEBUG: print(f"Comparing Source: {s_val} vs Target: {t_val}")

    # Case 1: Target has a version, but Source is N/A
    if s_val is None and t_val is not None:
        return "Error (Missing in Source)"
    
    # Case 2: Target is missing the module entirely
    if t_val is None:
        return "Missing Module"

    # Case 3: Both have versions - Perform Semantic Comparison
    if s_val > t_val:
        return "Upgrade"
    
    if s_val == t_val:
        return "No Action"
    
    if t_val > s_val:
        # Target is newer than Source (Regression/Manual change in Target)
        return "Error (Downgrade)"
    
    return "Unknown State"

def generate_comparison_report():
    paths.ensure_paths()
    envs = server_env_config_manager.load_config()
    
    # Load metadata for Status headers
    logs = {}
    if paths.LOG_FILE.exists():
        with open(paths.LOG_FILE, 'r') as f:
            logs = json.load(f)

    # Anchor the report to the Unique Module Master
    if not paths.MASTER_FILE.exists():
        print("❌ Sync required: module_master.csv not found.")
        return

    master_df = pd.read_csv(paths.MASTER_FILE)
    report_df = master_df[['name', 'shortdesc']].copy()
    report_df.rename(columns={'name': 'Technical Name', 'shortdesc': 'Module Name'}, inplace=True)

    # Sort environments: Source (High Order) to Target (Low Order)
    sorted_envs = sorted(envs.items(), key=lambda x: x[1].get('order', 0), reverse=True)
    
    prev_env_name = None

    for name, config in sorted_envs:
        env_file = paths.ENV_DATA_DIR / f"report_{name}.csv"
        last_update = logs.get(name, {}).get('last_update', 'N/A')
        
        if env_file.exists():
            # Load and deduplicate current environment data
            env_df = pd.read_csv(env_file)[['name', 'state', 'installed_version']].drop_duplicates('name')
            
            # Define Headers
            status_col = f"{name}_Status ({last_update})"
            ver_col = f"{name}_Version"
            action_col = f"{name}_Action"

            env_df.rename(columns={'state': status_col, 'installed_version': ver_col}, inplace=True)
            
            # Merge into master
            report_df = pd.merge(report_df, env_df, left_on='Technical Name', right_on='name', how='left')
            report_df.drop(columns=['name'], inplace=True)

            # Standardize missing data
            report_df[status_col] = report_df[status_col].fillna("Missing Module")
            report_df[ver_col] = report_df[ver_col].fillna("N/A")

            # --- Logic Change: Only add Action column if a 'Source' exists ---
            if prev_env_name:
                prev_ver_col = f"{prev_env_name}_Version"
                report_df[action_col] = report_df.apply(
                    lambda row: calculate_release_action(row[prev_ver_col], row[ver_col]), axis=1
                )
            else:
                # This is the Highest Order Environment (Source). 
                # Per instructions: Action column NOT required.
                pass 

            prev_env_name = name
        else:
            print(f"⚠️ Warning: Missing data for {name}. Ensure sync is successful.")

    # Save final report to the dedicated Report folder
    report_df.to_csv(paths.COMPARISON_REPORT, index=False)
    print(f"✅ Comparison Report Generated at: {paths.COMPARISON_REPORT}")

if __name__ == "__main__":
    generate_comparison_report()