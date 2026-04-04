import pytest
from app.services.comparer import (
    parse_semver,
    parse_version_components,
    compare_versions,
    calculate_release_action,
)


class TestParseSemver:
    def test_parse_standard_version(self):
        assert parse_semver("17.0.1.10") == (17, 0, 1, 10)

    def test_parse_three_part_version(self):
        assert parse_semver("1.2.3") == (1, 2, 3)

    def test_parse_two_part_version(self):
        assert parse_semver("1.2") == (1, 2)

    def test_parse_single_part_version(self):
        assert parse_semver("1") == (1,)

    def test_parse_empty_string_returns_none(self):
        assert parse_semver("") is None

    def test_parse_none_string_returns_none(self):
        assert parse_semver("None") is None

    def test_parse_na_string_returns_none(self):
        assert parse_semver("N/A") is None

    def test_parse_missing_module_returns_none(self):
        assert parse_semver("Missing Module") is None

    def test_parse_none_input_returns_none(self):
        assert parse_semver(None) is None

    def test_parse_invalid_format_returns_none(self):
        assert parse_semver("not-a-version") is None

    def test_parse_mixed_invalid_returns_none(self):
        assert parse_semver("17.0.1.invalid") is None

    def test_parse_whitespace_stripped(self):
        assert parse_semver("  1.2.3  ") == (1, 2, 3)


class TestParseVersionComponents:
    def test_parse_full_version(self):
        result = parse_version_components("17.0.1.10")
        assert result == {"major": 17, "minor": 0, "patch": 1, "build": 10}

    def test_parse_three_part_version(self):
        result = parse_version_components("1.2.3")
        assert result == {"major": 1, "minor": 2, "patch": 3, "build": None}

    def test_parse_two_part_version(self):
        result = parse_version_components("1.2")
        assert result == {"major": 1, "minor": 2, "patch": None, "build": None}

    def test_parse_invalid_version_returns_nulls(self):
        result = parse_version_components("invalid")
        assert result == {"major": None, "minor": None, "patch": None, "build": None}

    def test_parse_na_version_returns_nulls(self):
        result = parse_version_components("N/A")
        assert result == {"major": None, "minor": None, "patch": None, "build": None}


class TestCompareVersions:
    def test_equal_versions_returns_zero(self):
        assert compare_versions("1.2.3", "1.2.3") == 0

    def test_source_greater_returns_positive(self):
        assert compare_versions("1.2.4", "1.2.3") == 1

    def test_source_less_returns_negative(self):
        assert compare_versions("1.2.3", "1.2.4") == -1

    def test_major_difference(self):
        assert compare_versions("2.0.0", "1.9.9") == 1

    def test_minor_difference(self):
        assert compare_versions("1.3.0", "1.2.9") == 1

    def test_both_invalid_returns_zero(self):
        assert compare_versions("invalid", "also-invalid") == 0

    def test_source_invalid_target_valid_returns_negative(self):
        assert compare_versions("invalid", "1.2.3") == -1

    def test_source_valid_target_invalid_returns_positive(self):
        assert compare_versions("1.2.3", "invalid") == 1

    def test_na_versions(self):
        assert compare_versions("N/A", "N/A") == 0


class TestCalculateReleaseAction:
    def test_upgrade_needed(self):
        assert calculate_release_action("17.0.1.10", "17.0.1.9") == "Upgrade"

    def test_no_action_when_equal(self):
        assert calculate_release_action("17.0.1.10", "17.0.1.10") == "No Action"

    def test_downgrade_error(self):
        assert calculate_release_action("17.0.1.9", "17.0.1.10") == "Error (Downgrade)"

    def test_missing_in_target(self):
        assert calculate_release_action("17.0.1.10", "N/A") == "Missing Module"

    def test_missing_in_source(self):
        assert calculate_release_action("N/A", "17.0.1.10") == "Error (Missing in Source)"

    def test_both_missing(self):
        assert calculate_release_action("N/A", "N/A") == "Missing Module"

    def test_missing_module_string(self):
        assert calculate_release_action("17.0.1.10", "Missing Module") == "Missing Module"

    def test_significant_upgrade(self):
        assert calculate_release_action("18.0.0.0", "17.0.0.0") == "Upgrade"

    def test_minor_upgrade(self):
        assert calculate_release_action("17.1.0.0", "17.0.0.0") == "Upgrade"
