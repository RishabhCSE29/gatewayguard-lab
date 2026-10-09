"""
Automated Test Case Generator and Test Runner for GatewayGuard Lab.
Dynamically derives comprehensive test cases from active policy definitions,
including role authorization matrices, rate limit boundary conditions,
wildcard expansions, unknown routes, and disabled rule verifications.
"""

from typing import List, Optional
import datetime
from app.models import (
    Policy,
    HttpMethod,
    Role,
    Decision,
    GeneratedTestCase,
    TestExecutionResult,
    TestSuiteRunReport,
    RequestSimulationInput,
)
from app.engine import simulate_request, normalize_path


def get_concrete_path_for_pattern(pattern: str) -> str:
    """Replaces wildcard and parameter placeholders with valid concrete test path values."""
    p = pattern
    if "{id}" in p:
        p = p.replace("{id}", "std_9872")
    if "{user_id}" in p:
        p = p.replace("{user_id}", "user_456")
    if "{course_id}" in p:
        p = p.replace("{course_id}", "cs101")
    # Replace any remaining {param}
    import re
    p = re.sub(r"\{[a-zA-Z0-9_]+\}", "test_param", p)

    if p.endswith("/*"):
        p = p[:-2] + "/test-endpoint"
    elif p.endswith("*"):
        p = p[:-1] + "test-endpoint"
    return p


def derive_expected_outcome_for_policy(
    policy: Optional[Policy],
    role: Role,
    method: HttpMethod,
    sim_count: int,
) -> tuple[Decision, int, str]:
    """
    Independently derives expected gateway decision and status code
    based purely on gateway specification rules.
    """
    if not policy or not policy.enabled:
        return (
            Decision.BLOCK,
            404,
            "Expected 404: No active/enabled policy is configured for this route and method.",
        )

    # Method check
    if policy.method != HttpMethod.ANY and policy.method != method:
        return (
            Decision.BLOCK,
            404,
            f"Expected 404: Policy '{policy.name}' only accepts '{policy.method.value}', but request is '{method.value}'.",
        )

    # Role check
    if role not in policy.allowed_roles:
        return (
            Decision.BLOCK,
            403,
            f"Expected 403: Role '{role.value}' is not authorized for policy '{policy.name}'. Allowed: {[r.value for r in policy.allowed_roles]}.",
        )

    # Rate limit check
    if sim_count > policy.request_limit:
        return (
            Decision.BLOCK,
            429,
            f"Expected 429: Simulated request count ({sim_count}) exceeds configured rate limit ({policy.request_limit}).",
        )

    return (
        Decision.ALLOW,
        200,
        f"Expected 200 ALLOW: Role '{role.value}' is authorized and request count ({sim_count}) is within limit ({policy.request_limit}).",
    )


def generate_test_suite_from_policies(policies: List[Policy]) -> List[GeneratedTestCase]:
    """
    Derives deterministic, reproducible test cases covering all configured policies
    and gateway boundary conditions.
    """
    test_cases: List[GeneratedTestCase] = []
    idx = 1

    # 1. Generate Role Authorization and Rate-Limit Boundary Tests for each policy
    for policy in policies:
        sample_path = get_concrete_path_for_pattern(policy.path_pattern)
        test_method = HttpMethod.GET if policy.method == HttpMethod.ANY else policy.method

        if not policy.enabled:
            # Test that disabled policy returns 404
            test_cases.append(
                GeneratedTestCase(
                    test_id=f"TC_{idx:03d}_DISABLED_{policy.id}",
                    category="DISABLED_POLICY",
                    name=f"Disabled Policy Block: {policy.name}",
                    path=sample_path,
                    method=test_method,
                    simulated_role=policy.allowed_roles[0],
                    simulated_request_count=1,
                    time_window_seconds=policy.time_window_seconds,
                    expected_decision=Decision.BLOCK,
                    expected_status_code=404,
                    expected_policy_id=None,
                    rationale=f"Policy '{policy.name}' is disabled; gateway must treat route as unmapped 404.",
                )
            )
            idx += 1
            continue

        # A. Authorized Role Tests (Happy Path)
        for auth_role in policy.allowed_roles:
            test_cases.append(
                GeneratedTestCase(
                    test_id=f"TC_{idx:03d}_AUTH_{policy.id}_{auth_role.value.upper()}",
                    category="ROLE_AUTHORIZATION",
                    name=f"Authorized Access: {policy.name} ({auth_role.value})",
                    path=sample_path,
                    method=test_method,
                    simulated_role=auth_role,
                    simulated_request_count=1,
                    time_window_seconds=policy.time_window_seconds,
                    expected_decision=Decision.ALLOW,
                    expected_status_code=200,
                    expected_policy_id=policy.id,
                    rationale=f"Role '{auth_role.value}' is in allowed roles for '{policy.name}'.",
                )
            )
            idx += 1

        # B. Unauthorized Role Tests (Negative Tests)
        all_roles = [Role.ADMIN, Role.STUDENT, Role.PUBLIC]
        unauthorized_roles = [r for r in all_roles if r not in policy.allowed_roles]
        for unauth_role in unauthorized_roles:
            test_cases.append(
                GeneratedTestCase(
                    test_id=f"TC_{idx:03d}_FORBIDDEN_{policy.id}_{unauth_role.value.upper()}",
                    category="ROLE_AUTHORIZATION",
                    name=f"Unauthorized Rejection: {policy.name} ({unauth_role.value})",
                    path=sample_path,
                    method=test_method,
                    simulated_role=unauth_role,
                    simulated_request_count=1,
                    time_window_seconds=policy.time_window_seconds,
                    expected_decision=Decision.BLOCK,
                    expected_status_code=403,
                    expected_policy_id=policy.id,
                    rationale=f"Role '{unauth_role.value}' is NOT in allowed roles for '{policy.name}'.",
                )
            )
            idx += 1

        # C. Rate Limit Boundary Tests
        primary_role = policy.allowed_roles[0]

        # Boundary 1: Exactly at limit -> ALLOW (200)
        test_cases.append(
            GeneratedTestCase(
                test_id=f"TC_{idx:03d}_RATELIMIT_AT_LIMIT_{policy.id}",
                category="RATE_LIMIT_BOUNDARY",
                name=f"Rate Limit Boundary: Exact Max ({policy.request_limit}/{policy.request_limit}) - {policy.name}",
                path=sample_path,
                method=test_method,
                simulated_role=primary_role,
                simulated_request_count=policy.request_limit,
                time_window_seconds=policy.time_window_seconds,
                expected_decision=Decision.ALLOW,
                expected_status_code=200,
                expected_policy_id=policy.id,
                rationale=f"Simulated count ({policy.request_limit}) is at exact capacity and must be ALLOWED.",
            )
        )
        idx += 1

        # Boundary 2: Over limit by 1 -> BLOCK (429)
        test_cases.append(
            GeneratedTestCase(
                test_id=f"TC_{idx:03d}_RATELIMIT_EXCEEDED_{policy.id}",
                category="RATE_LIMIT_BOUNDARY",
                name=f"Rate Limit Exceeded ({policy.request_limit + 1}/{policy.request_limit}) - {policy.name}",
                path=sample_path,
                method=test_method,
                simulated_role=primary_role,
                simulated_request_count=policy.request_limit + 1,
                time_window_seconds=policy.time_window_seconds,
                expected_decision=Decision.BLOCK,
                expected_status_code=429,
                expected_policy_id=policy.id,
                rationale=f"Simulated count ({policy.request_limit + 1}) exceeds policy limit ({policy.request_limit}) and must return 429.",
            )
        )
        idx += 1

        # D. Method Enforcement Negative Test (if not ANY)
        if policy.method != HttpMethod.ANY:
            mismatched_method = HttpMethod.POST if policy.method == HttpMethod.GET else HttpMethod.GET
            test_cases.append(
                GeneratedTestCase(
                    test_id=f"TC_{idx:03d}_METHOD_MISMATCH_{policy.id}",
                    category="METHOD_ENFORCEMENT",
                    name=f"Method Mismatch Rejection: {mismatched_method.value} on {policy.name}",
                    path=sample_path,
                    method=mismatched_method,
                    simulated_role=primary_role,
                    simulated_request_count=1,
                    time_window_seconds=policy.time_window_seconds,
                    expected_decision=Decision.BLOCK,
                    expected_status_code=404,
                    expected_policy_id=None,
                    rationale=f"Policy '{policy.name}' does not allow method '{mismatched_method.value}'.",
                )
            )
            idx += 1

    # 2. Unknown Unmapped Route Test
    test_cases.append(
        GeneratedTestCase(
            test_id=f"TC_{idx:03d}_UNKNOWN_ROUTE",
            category="ROUTE_RESOLUTION",
            name="Unknown Route Rejection: /api/unmapped/gateway-check",
            path="/api/unmapped/gateway-check",
            method=HttpMethod.GET,
            simulated_role=Role.PUBLIC,
            simulated_request_count=1,
            time_window_seconds=60,
            expected_decision=Decision.BLOCK,
            expected_status_code=404,
            expected_policy_id=None,
            rationale="Unmapped endpoint not registered in any policy must result in 404 Route Not Found.",
        )
    )
    idx += 1

    return test_cases


def run_test_suite(
    policies: List[Policy],
    custom_tests: Optional[List[GeneratedTestCase]] = None,
) -> TestSuiteRunReport:
    """
    Executes all generated or provided test cases through the real deterministic policy engine
    and compares actual outcomes with expected outcomes.
    """
    tests = custom_tests or generate_test_suite_from_policies(policies)
    results: List[TestExecutionResult] = []

    passed_count = 0
    failed_count = 0

    for tc in tests:
        sim_input = RequestSimulationInput(
            path=tc.path,
            method=tc.method,
            simulated_role=tc.simulated_role,
            simulated_request_count=tc.simulated_request_count,
            time_window_seconds=tc.time_window_seconds,
        )

        sim_result = simulate_request(policies, sim_input)

        decision_matches = sim_result.decision == tc.expected_decision
        status_matches = sim_result.status_code == tc.expected_status_code

        is_pass = decision_matches and status_matches
        failure_msg = None

        if not is_pass:
            reasons = []
            if not decision_matches:
                reasons.append(f"Decision mismatch: Expected {tc.expected_decision.value}, got {sim_result.decision.value}")
            if not status_matches:
                reasons.append(f"Status mismatch: Expected {tc.expected_status_code}, got {sim_result.status_code}")
            failure_msg = "; ".join(reasons)
            failed_count += 1
        else:
            passed_count += 1

        results.append(
            TestExecutionResult(
                test_case=tc,
                actual_decision=sim_result.decision,
                actual_status_code=sim_result.status_code,
                actual_policy_id=sim_result.selected_policy_id,
                actual_service=sim_result.destination_service,
                passed=is_pass,
                trace=sim_result.trace,
                failure_reason=failure_msg,
            )
        )

    total = len(results)
    pass_rate = round((passed_count / total * 100.0), 2) if total > 0 else 0.0

    return TestSuiteRunReport(
        total_tests=total,
        passed_tests=passed_count,
        failed_tests=failed_count,
        pass_rate_percentage=pass_rate,
        results=results,
        timestamp=datetime.datetime.utcnow().isoformat() + "Z",
    )
