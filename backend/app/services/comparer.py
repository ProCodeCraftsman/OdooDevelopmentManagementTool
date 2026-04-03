from typing import Optional, Tuple


INVALID_VERSIONS = {"", "None", "N/A", "Missing Module"}


def parse_semver(version_string: str) -> Optional[Tuple[int, ...]]:
    """Parse semantic version string into tuple for comparison.
    
    Args:
        version_string: Version string like '17.0.1.10'
        
    Returns:
        Tuple of integers (major, minor, patch, build) or None if invalid
    """
    if not version_string or version_string.strip() in INVALID_VERSIONS:
        return None
    
    try:
        parts = version_string.strip().split(".")
        return tuple(int(p) for p in parts)
    except (ValueError, AttributeError):
        return None


def parse_version_components(version_string: str) -> dict:
    """Parse version string into individual components for database storage.
    
    Args:
        version_string: Version string like '17.0.1.10'
        
    Returns:
        Dict with major, minor, patch, build keys
    """
    parsed = parse_semver(version_string)
    if parsed is None:
        return {"major": None, "minor": None, "patch": None, "build": None}
    
    return {
        "major": parsed[0] if len(parsed) > 0 else None,
        "minor": parsed[1] if len(parsed) > 1 else None,
        "patch": parsed[2] if len(parsed) > 2 else None,
        "build": parsed[3] if len(parsed) > 3 else None,
    }


def compare_versions(source: str, target: str) -> int:
    """Compare two version strings.
    
    Args:
        source: Source version string
        target: Target version string
        
    Returns:
        1 if source > target, -1 if source < target, 0 if equal
    """
    s_ver = parse_semver(source)
    t_ver = parse_semver(target)
    
    if s_ver is None and t_ver is None:
        return 0
    if s_ver is None:
        return -1
    if t_ver is None:
        return 1
    
    if s_ver > t_ver:
        return 1
    if s_ver < t_ver:
        return -1
    return 0


def calculate_release_action(source_version: str, target_version: str) -> str:
    """Calculate release action based on version comparison.
    
    Directional Release Logic:
    Source = Higher Order (e.g., Dev=4) | Target = Lower Order (e.g., Staging=3)
    
    Args:
        source_version: Version from higher-order environment
        target_version: Version from lower-order environment
        
    Returns:
        Action string: "Upgrade", "No Action", "Error (Downgrade)", "Missing Module", etc.
    """
    s_ver = parse_semver(source_version)
    t_ver = parse_semver(target_version)
    
    if s_ver is None and t_ver is not None:
        return "Error (Missing in Source)"
    
    if t_ver is None:
        return "Missing Module"
    
    if s_ver > t_ver:
        return "Upgrade"
    
    if s_ver == t_ver:
        return "No Action"
    
    if t_ver > s_ver:
        return "Error (Downgrade)"
    
    return "Unknown State"
