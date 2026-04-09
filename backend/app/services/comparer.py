from typing import Optional, Tuple


INVALID_VERSIONS = {"", "None", "N/A", "Missing Module"}


def parse_semver(version_string: Optional[str]) -> Optional[Tuple[int, ...]]:
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


def _normalize_tuple(t: Tuple[int, ...], length: int = 4) -> Tuple[int, ...]:
    """Pad tuple to fixed length for comparison."""
    if len(t) >= length:
        return t[:length]
    return t + (0,) * (length - len(t))


def _compare_tuples(a: Optional[Tuple[int, ...]], b: Optional[Tuple[int, ...]]) -> int:
    """Compare two version tuples safely."""
    if a is None and b is None:
        return 0
    if a is None:
        return -1
    if b is None:
        return 1
    
    max_len = max(len(a), len(b), 4)
    a_norm = _normalize_tuple(a, max_len)
    b_norm = _normalize_tuple(b, max_len)
    
    for i in range(max_len):
        if a_norm[i] > b_norm[i]:
            return 1
        elif a_norm[i] < b_norm[i]:
            return -1
    return 0


def calculate_drift_action(
    source_version: Optional[str],
    dest_version: Optional[str],
    source_env_name: str,
    dest_env_name: str,
) -> Tuple[str, Optional[str]]:
    """Compute (action, missing_env) for a single sliding-window pair.

    Action strings (categorical):
        "Upgrade", "Error (Downgrade)", "No Action",
        "Missing Module", "Error (Missing in Source)", "Error (Version Structure Mismatch)"
    mismatch_reason: the specific mismatch reason (e.g., "dot_count_mismatch"), or None.
    """
    src_is_na = not source_version or source_version.strip() in INVALID_VERSIONS
    dst_is_na = not dest_version or dest_version.strip() in INVALID_VERSIONS

    if src_is_na:
        return "Error (Missing in Source)", None

    if dst_is_na:
        return "Missing Module", None

    action, mismatch_reason = calculate_release_action(source_version, dest_version)
    return action, mismatch_reason


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
    
    return _compare_tuples(s_ver, t_ver)


def calculate_release_action(source_version: str, target_version: str) -> Tuple[str, Optional[str]]:
    """Calculate release action based on version comparison.
    
    Directional Release Logic:
    Source = Higher Order (e.g., Dev=4) | Target = Lower Order (e.g., Staging=3)
    Source version should be HIGHER than target - meaning target needs to upgrade to match source.
    
    Args:
        source_version: Version from higher-order environment
        target_version: Version from lower-order environment
        
    Returns:
        Tuple of (action_string, mismatch_reason):
        - ("Upgrade", None) - target needs to upgrade to match source
        - ("No Action", None) - versions are equal
        - ("Error (Downgrade)", None) - target version is higher than source (regression)
        - ("Error (Version Structure Mismatch)", "dot_count_mismatch") - version structures differ
        - ("Missing Module", None) - target doesn't have module
        - ("Error (Missing in Source)", None) - source doesn't have module
    """
    s_ver = parse_semver(source_version)
    t_ver = parse_semver(target_version)
    
    if s_ver is None and t_ver is not None:
        return "Error (Missing in Source)", None
    
    if s_ver is None and t_ver is None:
        return "No Action", None
    
    if t_ver is None:
        return "Missing Module", None
    
    if s_ver is None and t_ver is None:
        return "No Action", None
    
    if len(s_ver) != len(t_ver):
        return "Error (Version Structure Mismatch)", "dot_count_mismatch"
    
    comparison = _compare_tuples(s_ver, t_ver)
    
    if comparison > 0:
        return "Upgrade", None
    elif comparison < 0:
        return "Error (Downgrade)", None
    else:
        return "No Action", None
