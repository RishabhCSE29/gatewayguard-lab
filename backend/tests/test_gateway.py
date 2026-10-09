"""
Comprehensive Pytest Test Suite for GatewayGuard Lab.
Verifies all 12 core requirements, edge cases, deterministic precedence,
conflict detection, automated test generation, snapshots, and regression comparisons.
"""

import pytest
from fastapi.testclient import TestClient
from app.models import (
    Policy,
    HttpMethod,
    Role,
    Decision,
    RequestSimulationInput,
    CreateSnapshotInput,
    ConflictSeverity,
    ConflictType,
)
from app.engine import simulate_request, find_matching_policy, match_path_pattern
from app.conflicts import analyze_policy_conflicts
from app.test_generation import generate_test_suite_from_policies, run_test_suite
from app.snapshots import create_snapshot, compare_baseline_with_current
from app.main import app


@pytest.fixture
def sample_policies():
    return [
        Policy(
            id="pol_admin_system",
            name="Admin System Operations",
            path_pattern="/api/admin/system",
            method=HttpMethod.ANY,
            allowed_roles=[Role.ADMIN],
            destination_service="admin-system-service",
            request_limit=5,
            time_window_seconds=60,
            enabled=True,
            priority=10,
        ),
        Policy(
            id="pol_admin_wildcard",
            name="Admin Wildcard Fallback",
            path_pattern="/api/admin/*",
            method=HttpMethod.ANY,
            allowed_roles=[Role.ADMIN],
            destination_service="admin-wildcard-service",
            request_limit=20,
            time_window_seconds=60,
            enabled=True,
            priority=20,
        ),
        Policy(
            id="pol_student_profile",
            name="Student Profile",
            path_pattern="/api/student/profile",
            method=HttpMethod.GET,
            allowed_roles=[Role.ADMIN, Role.STUDENT],
            destination_service="student-service",
            request_limit=10,
            time_window_seconds=60,
            enabled=True,
            priority=20,
        ),
        Policy(
            id="pol_student_results",
            name="Student Results",
            path_pattern="/api/student/{id}/results",
            method=HttpMethod.GET,
            allowed_roles=[Role.ADMIN, Role.STUDENT],
            destination_service="grades-service",
            request_limit=3,
            time_window_seconds=60,
            enabled=True,
            priority=25,
        ),
        Policy(
            id="pol_public_courses",
            name="Public Courses",
            path_pattern="/api/public/courses",
            method=HttpMethod.GET,
            allowed_roles=[Role.PUBLIC, Role.STUDENT, Role.ADMIN],
            destination_service="course-catalog-service",
            request_limit=50,
            time_window_seconds=60,
            enabled=True,
            priority=30,
        ),
        Policy(
            id="pol_disabled_feature",
            name="Disabled Experimental Feature",
            path_pattern="/api/experimental/beta",
            method=HttpMethod.GET,
            allowed_roles=[Role.ADMIN],
            destination_service="beta-service",
            request_limit=10,
            time_window_seconds=60,
            enabled=False,
            priority=10,
        ),
    ]


@pytest.fixture
def client():
    return TestClient(app)


# 1. Admin allowed on authorized admin route
def test_admin_allowed_on_authorized_route(sample_policies):
    sim_input = RequestSimulationInput(
        path="/api/admin/system",
        method=HttpMethod.GET,
        simulated_role=Role.ADMIN,
        simulated_request_count=1,
    )
    result = simulate_request(sample_policies, sim_input)
    assert result.decision == Decision.ALLOW
    assert result.status_code == 200
    assert result.selected_policy_id == "pol_admin_system"
    assert result.destination_service == "admin-system-service"
    assert any(step.step_name == "Role Authorization Enforcement" and step.status == "PASS" for step in result.trace)


# 2. Student blocked from restricted admin route (403 Forbidden)
def test_student_blocked_from_restricted_admin_route(sample_policies):
    sim_input = RequestSimulationInput(
        path="/api/admin/system",
        method=HttpMethod.GET,
        simulated_role=Role.STUDENT,
        simulated_request_count=1,
    )
    result = simulate_request(sample_policies, sim_input)
    assert result.decision == Decision.BLOCK
    assert result.status_code == 403
    assert result.selected_policy_id == "pol_admin_system"
    assert "Forbidden" in result.summary


# 3. Public role allowed on configured public route
def test_public_allowed_on_public_route(sample_policies):
    sim_input = RequestSimulationInput(
        path="/api/public/courses",
        method=HttpMethod.GET,
        simulated_role=Role.PUBLIC,
        simulated_request_count=1,
    )
    result = simulate_request(sample_policies, sim_input)
    assert result.decision == Decision.ALLOW
    assert result.status_code == 200
    assert result.selected_policy_id == "pol_public_courses"


# 4. Unknown route returns 404
def test_unknown_route_returns_404(sample_policies):
    sim_input = RequestSimulationInput(
        path="/api/nonexistent/service/endpoint",
        method=HttpMethod.GET,
        simulated_role=Role.ADMIN,
        simulated_request_count=1,
    )
    result = simulate_request(sample_policies, sim_input)
    assert result.decision == Decision.BLOCK
    assert result.status_code == 404
    assert result.selected_policy_id is None
    assert "Route Not Found" in result.summary


# 5. Rate-limit boundary: at limit (200 ALLOW) and above limit (429 BLOCK)
def test_rate_limit_boundaries(sample_policies):
    # Policy pol_student_results has request_limit=3
    # Boundary 1: Exact limit (3) -> ALLOW
    at_limit_input = RequestSimulationInput(
        path="/api/student/std_101/results",
        method=HttpMethod.GET,
        simulated_role=Role.STUDENT,
        simulated_request_count=3,
    )
    res_at_limit = simulate_request(sample_policies, at_limit_input)
    assert res_at_limit.decision == Decision.ALLOW
    assert res_at_limit.status_code == 200

    # Boundary 2: Over limit by 1 (4) -> BLOCK 429
    over_limit_input = RequestSimulationInput(
        path="/api/student/std_101/results",
        method=HttpMethod.GET,
        simulated_role=Role.STUDENT,
        simulated_request_count=4,
    )
    res_over_limit = simulate_request(sample_policies, over_limit_input)
    assert res_over_limit.decision == Decision.BLOCK
    assert res_over_limit.status_code == 429
    assert res_over_limit.rate_limit_info["rate_limit_exceeded"] is True


# 6. Specific route precedence over broad wildcard
def test_specific_route_precedence_over_wildcard(sample_policies):
    # /api/admin/system matches both pol_admin_system (exact) and pol_admin_wildcard (/api/admin/*)
    sim_input = RequestSimulationInput(
        path="/api/admin/system",
        method=HttpMethod.GET,
        simulated_role=Role.ADMIN,
        simulated_request_count=1,
    )
    result = simulate_request(sample_policies, sim_input)
    assert result.selected_policy_id == "pol_admin_system"
    assert result.destination_service == "admin-system-service"

    # Any other admin endpoint falls back to wildcard
    sim_wildcard = RequestSimulationInput(
        path="/api/admin/database/backup",
        method=HttpMethod.GET,
        simulated_role=Role.ADMIN,
        simulated_request_count=1,
    )
    res_wildcard = simulate_request(sample_policies, sim_wildcard)
    assert res_wildcard.selected_policy_id == "pol_admin_wildcard"
    assert res_wildcard.destination_service == "admin-wildcard-service"


# 7. Method enforcement
def test_method_enforcement(sample_policies):
    # pol_student_profile allows GET only
    post_input = RequestSimulationInput(
        path="/api/student/profile",
        method=HttpMethod.POST,
        simulated_role=Role.STUDENT,
        simulated_request_count=1,
    )
    result = simulate_request(sample_policies, post_input)
    # POST does not match GET policy -> 404
    assert result.decision == Decision.BLOCK
    assert result.status_code == 404


# 8. Disabled policy behavior
def test_disabled_policy_returns_404(sample_policies):
    sim_input = RequestSimulationInput(
        path="/api/experimental/beta",
        method=HttpMethod.GET,
        simulated_role=Role.ADMIN,
        simulated_request_count=1,
    )
    result = simulate_request(sample_policies, sim_input)
    assert result.decision == Decision.BLOCK
    assert result.status_code == 404
    assert "DISABLED" in result.trace[0].message


# 9. Policy edits changing actual outcomes
def test_policy_edits_change_outcomes(sample_policies):
    # Before edit: Public blocked from student profile
    sim_input = RequestSimulationInput(
        path="/api/student/profile",
        method=HttpMethod.GET,
        simulated_role=Role.PUBLIC,
        simulated_request_count=1,
    )
    res_before = simulate_request(sample_policies, sim_input)
    assert res_before.decision == Decision.BLOCK
    assert res_before.status_code == 403

    # Edit policy: Add Public to allowed_roles
    modified_policies = [p.model_copy() for p in sample_policies]
    for p in modified_policies:
        if p.id == "pol_student_profile":
            p.allowed_roles = [Role.PUBLIC, Role.STUDENT, Role.ADMIN]

    res_after = simulate_request(modified_policies, sim_input)
    assert res_after.decision == Decision.ALLOW
    assert res_after.status_code == 200


# 10. Misconfigured sample creates reproducible conflict and correction removes it
def test_conflict_detection_and_remediation():
    # Misconfigured setup with a rogue public catch-all and duplicate rule
    misconfigured_policies = [
        Policy(
            id="pol_admin_secret",
            name="Admin Secret",
            path_pattern="/api/admin/secret",
            method=HttpMethod.GET,
            allowed_roles=[Role.ADMIN],
            destination_service="admin-secret-service",
            request_limit=10,
            time_window_seconds=60,
            enabled=True,
            priority=20,
        ),
        Policy(
            id="pol_bad_catchall",
            name="Bad Public Catchall",
            path_pattern="/api/*",
            method=HttpMethod.ANY,
            allowed_roles=[Role.PUBLIC],
            destination_service="public-service",
            request_limit=100,
            time_window_seconds=60,
            enabled=True,
            priority=5,  # Higher priority than specific rule -> shadows admin!
        ),
    ]

    report = analyze_policy_conflicts(misconfigured_policies)
    assert report.total_conflicts >= 1
    shadow_conflicts = [f for f in report.findings if f.conflict_type == ConflictType.SHADOWED_POLICY]
    assert len(shadow_conflicts) > 0
    assert "pol_admin_secret" in shadow_conflicts[0].affected_policy_ids

    # Remediate by fixing priority and restricting scope
    remediated_policies = [
        Policy(
            id="pol_admin_secret",
            name="Admin Secret",
            path_pattern="/api/admin/secret",
            method=HttpMethod.GET,
            allowed_roles=[Role.ADMIN],
            destination_service="admin-secret-service",
            request_limit=10,
            time_window_seconds=60,
            enabled=True,
            priority=10,
        ),
        Policy(
            id="pol_safe_public",
            name="Safe Public Catalog",
            path_pattern="/api/public/*",
            method=HttpMethod.GET,
            allowed_roles=[Role.PUBLIC],
            destination_service="public-service",
            request_limit=100,
            time_window_seconds=60,
            enabled=True,
            priority=50,
        ),
    ]

    remediated_report = analyze_policy_conflicts(remediated_policies)
    assert remediated_report.total_conflicts == 0


# 11. Baseline comparison detects deliberately introduced regression
def test_baseline_regression_detection(sample_policies):
    # Create baseline snapshot
    baseline_snapshot = create_snapshot(
        CreateSnapshotInput(name="Baseline v1", description="Initial working policies"),
        sample_policies,
    )

    # Deliberately introduce regression: disable student profile and drop admin limit to 0 (invalidated) or lower limit
    regressed_policies = [p.model_copy() for p in sample_policies]
    for p in regressed_policies:
        if p.id == "pol_student_profile":
            p.enabled = False  # Student profile will now return 404 instead of 200

    comparison = compare_baseline_with_current(baseline_snapshot, regressed_policies)
    assert len(comparison.new_failures) > 0
    assert any(
        f.test_case.expected_policy_id == "pol_student_profile" or "Student Profile" in f.test_case.name
        for f in comparison.new_failures
    )
    assert "REGRESSION" in comparison.summary_message.upper()


# 12. Invalid policy input returns validation error (Pydantic / FastAPI validation)
def test_invalid_policy_input_validation(client):
    # Path pattern missing leading slash
    invalid_policy_data = {
        "policies": [
            {
                "id": "pol_bad",
                "name": "Bad Pattern Policy",
                "path_pattern": "api/no-slash",
                "method": "GET",
                "allowed_roles": ["Admin"],
                "destination_service": "bad-service",
                "request_limit": 10,
                "time_window_seconds": 60,
                "enabled": True,
                "priority": 10,
            }
        ]
    }
    response = client.put("/api/policies", json=invalid_policy_data)
    assert response.status_code == 422  # Pydantic validation error

    # Negative request limit
    invalid_limit_data = {
        "policies": [
            {
                "id": "pol_bad",
                "name": "Negative Limit Policy",
                "path_pattern": "/api/test",
                "method": "GET",
                "allowed_roles": ["Admin"],
                "destination_service": "bad-service",
                "request_limit": -5,
                "time_window_seconds": 60,
                "enabled": True,
                "priority": 10,
            }
        ]
    }
    response2 = client.put("/api/policies", json=invalid_limit_data)
    assert response2.status_code == 422


# 13. REST API integration tests
def test_api_endpoints_full_lifecycle(client):
    # 1. Health check
    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "online"

    # 2. Reset policies to safe default
    res_reset = client.post("/api/policies/reset", json={"mode": "safe"})
    assert res_reset.status_code == 200
    policies = res_reset.json()
    assert len(policies) >= 4

    # 3. Simulate request via API
    res_sim = client.post(
        "/api/simulate",
        json={
            "path": "/api/admin/system",
            "method": "GET",
            "simulated_role": "Admin",
            "simulated_request_count": 1,
        },
    )
    assert res_sim.status_code == 200
    sim_data = res_sim.json()
    assert sim_data["decision"] == "ALLOW"
    assert sim_data["status_code"] == 200
    assert len(sim_data["trace"]) >= 3

    # 4. Conflict detection via API
    res_conflicts = client.get("/api/conflicts")
    assert res_conflicts.status_code == 200
    assert "findings" in res_conflicts.json()

    # 5. Generate and Run tests via API
    res_tests = client.post("/api/tests/generate")
    assert res_tests.status_code == 200
    generated = res_tests.json()
    assert len(generated) > 0

    res_run = client.post("/api/tests/run", json={"tests": generated})
    assert res_run.status_code == 200
    run_report = res_run.json()
    assert run_report["total_tests"] == len(generated)
    assert run_report["passed_tests"] > 0
