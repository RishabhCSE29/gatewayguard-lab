"""
Baseline Snapshot Management and Regression Comparison for GatewayGuard Lab.
Provides local JSON-based persistence of snapshots and deterministic
before/after diffing of policy decisions, test pass rates, and conflict findings.
"""

import json
import os
import datetime
from typing import List, Optional, Dict, Any
from app.models import (
    Policy,
    Snapshot,
    CreateSnapshotInput,
    ComparisonReport,
    TestExecutionResult,
)
from app.conflicts import analyze_policy_conflicts
from app.test_generation import generate_test_suite_from_policies, run_test_suite

SNAPSHOTS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "snapshots.json")


def _ensure_data_dir():
    data_dir = os.path.dirname(SNAPSHOTS_FILE)
    if not os.path.exists(data_dir):
        os.makedirs(data_dir, exist_ok=True)


def load_snapshots() -> List[Snapshot]:
    """Loads saved snapshots from local storage."""
    _ensure_data_dir()
    if not os.path.exists(SNAPSHOTS_FILE):
        return []
    try:
        with open(SNAPSHOTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return [Snapshot(**item) for item in data]
    except Exception:
        return []


def save_snapshots_to_disk(snapshots: List[Snapshot]) -> None:
    """Saves snapshots list to local storage."""
    _ensure_data_dir()
    data = [s.model_dump() for s in snapshots]
    with open(SNAPSHOTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def create_snapshot(input_data: CreateSnapshotInput, current_policies: List[Policy]) -> Snapshot:
    """Creates and persists a new baseline snapshot."""
    snapshots = load_snapshots()
    conflict_report = analyze_policy_conflicts(current_policies)

    snapshot_id = f"snap_{int(datetime.datetime.utcnow().timestamp())}_{len(snapshots) + 1}"
    new_snapshot = Snapshot(
        id=snapshot_id,
        name=input_data.name,
        timestamp=datetime.datetime.utcnow().isoformat() + "Z",
        description=input_data.description or "",
        policies=[p.model_copy() for p in current_policies],
        conflict_count=conflict_report.total_conflicts,
    )

    snapshots.append(new_snapshot)
    save_snapshots_to_disk(snapshots)
    return new_snapshot


def get_snapshot_by_id(snapshot_id: str) -> Optional[Snapshot]:
    """Finds snapshot by ID."""
    snapshots = load_snapshots()
    for s in snapshots:
        if s.id == snapshot_id:
            return s
    return None


def delete_snapshot(snapshot_id: str) -> bool:
    """Deletes snapshot by ID."""
    snapshots = load_snapshots()
    initial_len = len(snapshots)
    filtered = [s for s in snapshots if s.id != snapshot_id]
    if len(filtered) < initial_len:
        save_snapshots_to_disk(filtered)
        return True
    return False


def compare_baseline_with_current(
    baseline_snapshot: Snapshot,
    current_policies: List[Policy],
) -> ComparisonReport:
    """
    Executes a comprehensive before/after regression analysis.
    Runs tests against baseline policies and current policies,
    identifying regressions, fixed failures, decision changes, and conflict deltas.
    """
    baseline_policies = baseline_snapshot.policies

    # 1. Conflict comparison
    baseline_conflicts = analyze_policy_conflicts(baseline_policies).findings
    current_conflicts = analyze_policy_conflicts(current_policies).findings

    baseline_conflict_ids = {c.id for c in baseline_conflicts}
    current_conflict_ids = {c.id for c in current_conflicts}

    # Find introduced / resolved
    # Use title/type matching if id changes
    baseline_titles = {f"{c.conflict_type.value}:{':'.join(sorted(c.affected_policy_ids))}" for c in baseline_conflicts}
    current_titles = {f"{c.conflict_type.value}:{':'.join(sorted(c.affected_policy_ids))}" for c in current_conflicts}

    introduced_conflicts = [
        c for c in current_conflicts
        if f"{c.conflict_type.value}:{':'.join(sorted(c.affected_policy_ids))}" not in baseline_titles
    ]
    resolved_conflicts = [
        c for c in baseline_conflicts
        if f"{c.conflict_type.value}:{':'.join(sorted(c.affected_policy_ids))}" not in current_titles
    ]

    # 2. Run test suites
    # Generate unified test suite covering both baseline and current policies
    baseline_tests = generate_test_suite_from_policies(baseline_policies)
    current_tests = generate_test_suite_from_policies(current_policies)

    baseline_report = run_test_suite(baseline_policies, baseline_tests)
    current_report = run_test_suite(current_policies, current_tests)

    # 3. Cross-evaluate baseline tests against current policies for regression detection
    cross_report_on_current = run_test_suite(current_policies, baseline_tests)

    baseline_results_map = {r.test_case.test_id: r for r in baseline_report.results}
    current_results_map = {r.test_case.test_id: r for r in cross_report_on_current.results}

    new_failures: List[TestExecutionResult] = []
    resolved_failures: List[TestExecutionResult] = []
    decision_changes: List[Dict[str, Any]] = []

    for test_id, base_res in baseline_results_map.items():
        curr_res = current_results_map.get(test_id)
        if not curr_res:
            continue

        # Regressions: Passed in baseline, but failed now
        if base_res.passed and not curr_res.passed:
            new_failures.append(curr_res)

        # Fixes: Failed in baseline, but passed now
        if not base_res.passed and curr_res.passed:
            resolved_failures.append(curr_res)

        # Decision changes: Status code or decision changed
        if (
            base_res.actual_decision != curr_res.actual_decision
            or base_res.actual_status_code != curr_res.actual_status_code
        ):
            decision_changes.append({
                "test_id": test_id,
                "test_name": base_res.test_case.name,
                "path": base_res.test_case.path,
                "method": base_res.test_case.method.value,
                "role": base_res.test_case.simulated_role.value,
                "baseline_decision": base_res.actual_decision.value,
                "baseline_status": base_res.actual_status_code,
                "current_decision": curr_res.actual_decision.value,
                "current_status": curr_res.actual_status_code,
            })

    # 4. Policy Diff calculation
    base_policy_map = {p.id: p for p in baseline_policies}
    curr_policy_map = {p.id: p for p in current_policies}

    added_policies = [p.id for p in current_policies if p.id not in base_policy_map]
    removed_policies = [p.id for p in baseline_policies if p.id not in curr_policy_map]
    modified_policies = []

    for pid, curr_p in curr_policy_map.items():
        if pid in base_policy_map:
            base_p = base_policy_map[pid]
            if curr_p.model_dump() != base_p.model_dump():
                modified_policies.append(pid)

    policy_diff = {
        "added_count": len(added_policies),
        "added_policy_ids": added_policies,
        "removed_count": len(removed_policies),
        "removed_policy_ids": removed_policies,
        "modified_count": len(modified_policies),
        "modified_policy_ids": modified_policies,
    }

    # Summary message
    summary_parts = []
    if new_failures:
        summary_parts.append(f"{len(new_failures)} NEW REGRESSION(S) DETECTED")
    if resolved_failures:
        summary_parts.append(f"{len(resolved_failures)} issue(s) resolved")
    if introduced_conflicts:
        summary_parts.append(f"{len(introduced_conflicts)} new conflict(s) introduced")
    if not summary_parts:
        summary_message = "No regressions detected between baseline and current configuration."
    else:
        summary_message = " | ".join(summary_parts)

    return ComparisonReport(
        baseline_snapshot_id=baseline_snapshot.id,
        baseline_snapshot_name=baseline_snapshot.name,
        baseline_timestamp=baseline_snapshot.timestamp,
        baseline_pass_rate=baseline_report.pass_rate_percentage,
        current_pass_rate=current_report.pass_rate_percentage,
        total_tests_baseline=baseline_report.total_tests,
        total_tests_current=current_report.total_tests,
        new_failures=new_failures,
        resolved_failures=resolved_failures,
        decision_changes=decision_changes,
        introduced_conflicts=introduced_conflicts,
        resolved_conflicts=resolved_conflicts,
        policy_diff=policy_diff,
        summary_message=summary_message,
    )
