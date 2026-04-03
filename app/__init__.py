import os
from pathlib import Path

def initialize_project_structure():
    """
    Initializes the professional folder structure and required packages.
    Standard: Google Python Style Guide (Directory isolation).
    """
    # Define paths using pathlib for cross-platform compatibility
    base_dir = Path(__file__).parent
    folders = [
        base_dir / "data",
        base_dir / "app" / "core",
    ]

    print("🛠️  Initializing project structure...")

    for folder in folders:
        # Create directory and any missing parents
        folder.mkdir(parents=True, exist_ok=True)
        
        # Create __init__.py to make folders valid Python packages
        init_file = folder / "__init__.py"
        if not init_file.exists():
            init_file.touch()
            print(f"✅ Created package: {folder}")
        else:
            print(f"📂 Found existing folder: {folder}")

    # Set up a .gitignore if it doesn't exist
    gitignore = base_dir / ".gitignore"
    if not gitignore.exists():
        with open(gitignore, "w") as f:
            f.write(".env\nenvironments.json\ndata/*.csv\n__pycache__/\nvenv/\n")
        print("🔒 Created .gitignore (Protecting your credentials and data)")

    print("\n🚀 Setup complete. Move your logic into 'app/core/'.")

if __name__ == "__main__":
    initialize_project_structure()