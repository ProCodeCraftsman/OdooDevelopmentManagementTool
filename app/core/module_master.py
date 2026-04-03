import pandas as pd
from datetime import datetime
from pathlib import Path
from app.core import paths

# BASE_DIR = Path(__file__).resolve().parent.parent.parent
# MASTER_FILE = BASE_DIR / "data/module_master/module_master.csv"

def update_module_master(new_data_df: pd.DataFrame):
    """Checks for new modules and appends them to the master list."""
    # Ensure columns exist in incoming data
    incoming = new_data_df[['name', 'shortdesc']].drop_duplicates('name')
    
    if paths.MASTER_FILE.exists():
        master_df = pd.read_csv(paths.MASTER_FILE)
    else:
        master_df = pd.DataFrame(columns=['name', 'shortdesc', 'first_seen_date'])
        master_df.to_csv(paths.MASTER_FILE, index=False)

    # Find modules in incoming that are NOT in master
    new_modules = incoming[~incoming['name'].isin(master_df['name'])].copy()
    
    if not new_modules.empty:
        new_modules['first_seen_date'] = datetime.now().strftime("%Y-%m-%d")
        updated_master = pd.concat([master_df, new_modules], ignore_index=True)
        updated_master.to_csv(paths.MASTER_FILE, index=False)
        print(f"✨ Master Updated: Added {len(new_modules)} new modules.")
    else:
        print("ℹ️  No new modules found for master list.")