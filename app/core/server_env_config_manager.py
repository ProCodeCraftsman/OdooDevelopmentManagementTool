import json
import os

CONFIG_FILE = "environments.json"

def load_config():
    if not os.path.exists(CONFIG_FILE):
        return {}
    with open(CONFIG_FILE, 'r') as f:
        return json.load(f)

def save_config(config):
    with open(CONFIG_FILE, 'w') as f:
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