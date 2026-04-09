from app.core.database import SessionLocal
from app.models.environment import Environment
from app.models.module import Module
from app.models.sync_record import SyncRecord
from app.services.comparer import calculate_drift_action

def repro():
    db = SessionLocal()
    try:
        environments = (
            db.query(Environment)
            .filter(Environment.is_active == True)
            .order_by(Environment.order.desc())
            .all()
        )
        env_names = [env.name for env in environments]
        print(f"Environments: {[(e.name, e.order) for e in environments]}")
        print(f"env_names: {env_names}")

        module = db.query(Module).filter(Module.name == 'zb_epc_budget').first()
        if not module:
            print("Module zb_epc_budget not found")
            return

        versions = {}
        for env in environments:
            record = (
                db.query(SyncRecord)
                .filter(
                    SyncRecord.module_id == module.id,
                    SyncRecord.environment_id == env.id,
                    SyncRecord.status == "completed",
                )
                .order_by(SyncRecord.created_at.desc())
                .first()
            )
            versions[env.name] = record.version_string if record else "N/A"
        
        print(f"Versions: {versions}")

        for i in range(len(env_names) - 1):
            src_env = env_names[i]
            dst_env = env_names[i + 1]
            src_ver = versions.get(src_env, "N/A")
            dst_ver = versions.get(dst_env, "N/A")
            
            action, missing_env = calculate_drift_action(src_ver, dst_ver, src_env, dst_env)
            print(f"Window {i}: {src_env}({src_ver}) -> {dst_env}({dst_ver}) => Action: {action}")

    finally:
        db.close()

if __name__ == "__main__":
    repro()
