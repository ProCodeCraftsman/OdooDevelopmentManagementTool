import json
import os
from app.core import paths

def load_config():
    if not os.path.exists(paths.CONFIG_FILE):
        return {}
    with open(paths.CONFIG_FILE, 'r') as f:
        return json.load(f)

def save_config(config):
    with open(paths.CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=4)

def add_env(order,environment_category,name, url, db, user, password):
    config = load_config()
    config[name] = {"order":order,"environment_category":environment_category,"url": url, "db": db, "user": user, "pass": password}
    save_config(config)
    print(f"✅ Environment '{name}' added/updated.")

def remove_env(name):
    config = load_config()
    if name in config:
        del config[name]
        save_config(config)
        print(f"🗑️ Environment '{name}' removed.")
    else:
        print(f"⚠️ Environment '{name}' not found.")

def list_envs():
    config = load_config()
    return list(config.keys())