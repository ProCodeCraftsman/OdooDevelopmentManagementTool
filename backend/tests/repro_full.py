from app.core.database import SessionLocal, engine
from app.models.base import Base
from app.models.environment import Environment, EnvironmentCategory
from app.models.module import Module
from app.models.sync_record import SyncRecord
from app.models.comparison_report import ComparisonReport, ComparisonReportRow, VersionDriftEntry, ReportMetadata
from app.repositories.comparison_report import ComparisonReportRepository
from app.services.comparer import calculate_drift_action
from datetime import datetime

def repro_full():
    db = SessionLocal()
    try:
        # Clean up
        db.query(VersionDriftEntry).delete()
        db.query(ComparisonReportRow).delete()
        db.query(ComparisonReport).delete()
        db.query(SyncRecord).delete()
        db.query(Module).delete()
        db.query(Environment).delete()
        db.commit()

        # Create Envs
        dev = Environment(name="DEVELOPMENT", order=4, category=EnvironmentCategory.DEVELOPMENT, url="http://dev", db_name="dev", user="admin", encrypted_password=b"pass")
        test = Environment(name="TEST", order=3, category=EnvironmentCategory.STAGING, url="http://test", db_name="test", user="admin", encrypted_password=b"pass")
        staging = Environment(name="STAGING - DR", order=2, category=EnvironmentCategory.PRODUCTION, url="http://staging", db_name="staging", user="admin", encrypted_password=b"pass")
        db.add_all([dev, test, staging])
        db.commit()

        # Create Module
        mod = Module(name="test_module", shortdesc="Test Module")
        db.add(mod)
        db.commit()

        # Create Sync Records
        # Dev = 1.34, Test = 1.35, Staging = 1.33
        db.add(SyncRecord(module_id=mod.id, environment_id=dev.id, version_string="17.0.1.34", status="completed", created_at=datetime.utcnow()))
        db.add(SyncRecord(module_id=mod.id, environment_id=test.id, version_string="17.0.1.35", status="completed", created_at=datetime.utcnow()))
        db.add(SyncRecord(module_id=mod.id, environment_id=staging.id, version_string="17.0.1.33", status="completed", created_at=datetime.utcnow()))
        db.commit()

        # Run Report Generation logic
        environments = db.query(Environment).filter(Environment.is_active == True).order_by(Environment.order.desc()).all()
        env_names = [e.name for e in environments]
        
        repo = ComparisonReportRepository()
        report = repo.create_new_report(db)
        
        versions = {}
        for env in environments:
            record = db.query(SyncRecord).filter(SyncRecord.module_id == mod.id, SyncRecord.environment_id == env.id, SyncRecord.status == "completed").order_by(SyncRecord.created_at.desc()).first()
            versions[env.name] = {"version": record.version_string if record else "N/A"}

        drift_entries = []
        for i in range(len(env_names) - 1):
            src_env = env_names[i]
            dst_env = env_names[i+1]
            src_ver = versions[src_env]["version"]
            dst_ver = versions[dst_env]["version"]
            action, missing_env = calculate_drift_action(src_ver, dst_ver, src_env, dst_env)
            drift_entries.append({
                "technical_name": mod.name,
                "module_name": mod.shortdesc,
                "source_env": src_env,
                "source_version": src_ver,
                "dest_env": dst_env,
                "dest_version": dst_ver,
                "action": action,
                "missing_env": missing_env,
            })
        
        repo.bulk_insert_drift_entries(db, report.id, drift_entries)
        db.commit()

        # Check DB
        drifts = db.query(VersionDriftEntry).all()
        for d in drifts:
            print(f"Entry: {d.source_env}({d.source_version}) -> {d.dest_env}({d.dest_version}) => Action: {d.action}")

    finally:
        db.close()

if __name__ == "__main__":
    repro_full()
