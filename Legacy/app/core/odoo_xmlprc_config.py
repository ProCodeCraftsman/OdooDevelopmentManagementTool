import os
import time
import ssl
import xmlrpc.client
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

class OdooModuleReporter:
    """Handles professional Odoo data extraction for multiple environments."""

    # Minimal Change: Pass credentials directly to the constructor
    def __init__(self, env_name: str, url: str, db: str, user: str, password: str):
        self.env_name = env_name
        self.url = url
        self.db = db
        self.username = user
        self.password = password
        self.uid: Optional[int] = None
        self._models: Optional[xmlrpc.client.ServerProxy] = None

    def _get_proxy(self, endpoint: str) -> xmlrpc.client.ServerProxy:
        context = ssl._create_unverified_context()
        return xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/{endpoint}", context=context)

    def connect(self) -> bool:
        try:
            common = self._get_proxy('common')
            self.uid = common.authenticate(self.db, self.username, self.password, {})
            if self.uid:
                self._models = self._get_proxy('object')
                return True
            return False
        except Exception as e:
            print(f"[{self.env_name}] Auth failure: {type(e).__name__}")
            return False

    def fetch_raw_data(self) -> tuple[List[Dict], List[Dict]]:
        if not self.uid or not self._models:
            raise ConnectionError("Not connected.")

        m_fields = ['id', 'name', 'shortdesc', 'installed_version', 'state']
        modules = self._models.execute_kw(self.db, self.uid, self.password, 'ir.module.module', 'search_read', [[]], {'fields': m_fields})

        d_fields = ['module_id', 'name']
        deps = self._models.execute_kw(self.db, self.uid, self.password, 'ir.module.module.dependency', 'search_read', [[]], {'fields': d_fields})

        return modules, deps

    def process_report(self, modules_raw: List[Dict], deps_raw: List[Dict]) -> pd.DataFrame:
        df_mod = pd.DataFrame(modules_raw)
        df_dep_link = pd.DataFrame(deps_raw)

        df_dep_link['parent_id'] = df_dep_link['module_id'].apply(lambda x: x[0] if isinstance(x, list) else x)
        df_dep_link = df_dep_link.rename(columns={'name': 'dependencies_name'})

        df_lookup = df_mod[['name', 'installed_version', 'state']].copy()
        df_lookup.columns = ['dependencies_name', 'dependencies_installed_version', 'dependencies_state']

        df_dep_detailed = pd.merge(df_dep_link[['parent_id', 'dependencies_name']], df_lookup, on='dependencies_name', how='left')

        df_final = pd.merge(df_mod, df_dep_detailed, left_on='id', right_on='parent_id', how='left')

        # New logic: Inject Environment and Date
        df_final['Environment'] = self.env_name
        df_final['Fetch Date'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        target_fields = [
            'Environment', 'Fetch Date', 'name', 'shortdesc', 
            'installed_version', 'state', 'dependencies_name', 
            'dependencies_installed_version', 'dependencies_state'
        ]
        
        return df_final[target_fields].fillna('None')

def main():
    # Define your environments here (Securely pulling from .env)
    environments = [
        {
            "name": os.getenv("DEV_NAME"),
            "url": os.getenv("DEV_URL"),
            "db": os.getenv("DEV_DB"),
            "user": os.getenv("DEV_USER"),
            "pass": os.getenv("DEV_PASS"),
        },
        {
            "name": os.getenv("STAGING_NAME"),
            "url": os.getenv("STAGING_URL"),
            "db": os.getenv("STAGING_DB"),
            "user": os.getenv("STAGING_USER"),
            "pass": os.getenv("STAGING_PASS"),
        },
        {
            "name": os.getenv("DR_NAME"),
            "url": os.getenv("DR_URL"),
            "db": os.getenv("DR_DB"),
            "user": os.getenv("DR_USER"),
            "pass": os.getenv("DR_PASS"),
        }
    ]

    all_reports = []

    for env in environments:
        # Skip if environment data is missing from .env
        if not all(env.values()):
            continue

        print(f"--- Processing: {env['name']} ---")
        reporter = OdooModuleReporter(env['name'], env['url'], env['db'], env['user'], env['pass'])
        
        if reporter.connect():
            # Timing the operations separately as requested
            t1 = time.perf_counter()
            m_raw, d_raw = reporter.fetch_raw_data()
            fetch_time = time.perf_counter() - t1

            t2 = time.perf_counter()
            df_env = reporter.process_report(m_raw, d_raw)
            process_time = time.perf_counter() - t2
            
            all_reports.append(df_env)
            print(f"✅ Success: {len(df_env)} rows captured.")
            print(f"Fetch Time:   {fetch_time:.4f}s")
            print(f"Process Time: {process_time:.4f}s")
            print(f"Total Rows Generated:  {len(df_env)}")
        else:
            print(f"❌ Failed to connect to {env['name']}")

    if all_reports:
        # Combine all environments into one master CSV
        final_master_df = pd.concat(all_reports, ignore_index=True)
        filename = f"master_odoo_report_{datetime.now().strftime('%Y%m%d')}.csv"
        final_master_df.to_csv(filename, index=False)
        print(f"\n🚀 Master Report Saved: {filename}")

if __name__ == "__main__":
    main()