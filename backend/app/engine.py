"""
Deterministic Policy Engine for GatewayGuard Lab.
Implements route matching precedence, role-based authorization checks,
simulated rate limiting, and structured decision tracing.
"""

import re
from typing import List, Optional, Tuple, Dict, Any
from app.models import (
    Policy,
    HttpMethod,
    Role,
    Decision,
    RequestSimulationInput,
    SimulationResult,
    DecisionTraceStep,
)


def normalize_path(path: str) -> str:
    """Normalize path to always start with / and strip trailing / unless root."""
    p = path.strip()
    if not p.startswith("/"):
        p = "/" + p
    if len(p) > 1 and p.endswith("/"):
        p = p.rstrip("/")
    return p


def match_path_pattern(pattern: str, request_path: str) -> Tuple[bool, str, int, int]:
    """
    Evaluates whether request_path matches pattern.
    Returns:
        (is_match, match_type, literal_segments, pattern_length)
    match_type: 'EXACT', 'PARAMETRIC', 'WILDCARD', or 'NONE'
    """
    norm_pattern = normalize_path(pattern)
    norm_req = normalize_path(request_path)

    # 1. Exact Match Check
    if "{" not in norm_pattern and "*" not in norm_pattern:
        if norm_pattern == norm_req:
            literal_count = len([s for s in norm_pattern.split("/") if s])
            return True, "EXACT", literal_count, len(norm_pattern)
        return False, "NONE", 0, 0

    # 2. Parametric Match Check (e.g. /api/student/{id}/results)
    if "{" in norm_pattern and "*" not in norm_pattern:
        pattern_segments = [s for s in norm_pattern.split("/") if s]
        req_segments = [s for s in norm_req.split("/") if s]

        if len(pattern_segments) != len(req_segments):
            return False, "NONE", 0, 0

        literal_count = 0
        for p_seg, r_seg in zip(pattern_segments, req_segments):
            if p_seg.startswith("{") and p_seg.endswith("}"):
                # Parameter wildcard segment
                continue
            elif p_seg == r_seg:
                literal_count += 1
            else:
                return False, "NONE", 0, 0

        return True, "PARAMETRIC", literal_count, len(norm_pattern)

    # 3. Wildcard Match Check (e.g. /api/admin/* or /*)
    if "*" in norm_pattern:
        # Convert pattern to regex
        # Escape everything except * and {param}
        prefix = norm_pattern
        if norm_pattern.endswith("/*"):
            base_prefix = norm_pattern[:-2]
            if base_prefix == "":
                # /* matches everything
                literal_count = 0
                return True, "WILDCARD", literal_count, len(norm_pattern)
            elif norm_req == base_prefix or norm_req.startswith(base_prefix + "/"):
                literal_count = len([s for s in base_prefix.split("/") if s])
                return True, "WILDCARD", literal_count, len(norm_pattern)
            return False, "NONE", 0, 0
        elif norm_pattern.endswith("*"):
            base_prefix = norm_pattern[:-1]
            if norm_req.startswith(base_prefix):
                literal_count = len([s for s in base_prefix.split("/") if s])
                return True, "WILDCARD", literal_count, len(norm_pattern)
            return False, "NONE", 0, 0
        else:
            # Embedded wildcard
            regex_str = "^" + re.escape(norm_pattern).replace(r"\*", r".*") + "$"
            if re.match(regex_str, norm_req):
                literal_count = len([s for s in norm_pattern.split("/") if s and "*" not in s])
                return True, "WILDCARD", literal_count, len(norm_pattern)
            return False, "NONE", 0, 0

    return False, "NONE", 0, 0


def calculate_precedence_tuple(policy: Policy, request_path: str, req_method: HttpMethod) -> Tuple:
    """
    Computes a sorting tuple for candidate matching policies.
    Higher precedence tuples sort smaller when using min() or standard sort.
    Deterministic order:
    1. Match type ranking (EXACT=1, PARAMETRIC=2, SPECIFIC_WILDCARD=3, ROOT_WILDCARD=4)
    2. Literal segment count (more literal segments = higher precedence, inverted with negative)
    3. Method specificity (specific method=1, ANY=2)
    4. Policy priority (lower integer = higher priority)
    5. Length of pattern (longer = higher precedence, inverted with negative)
    6. Policy ID string tie-breaker
    """
    is_match, match_type, literal_segments, pattern_len = match_path_pattern(policy.path_pattern, request_path)

    if match_type == "EXACT":
        type_rank = 1
    elif match_type == "PARAMETRIC":
        type_rank = 2
    elif match_type == "WILDCARD":
        # Check if root wildcard
        norm = normalize_path(policy.path_pattern)
        if norm in ("/*", "*"):
            type_rank = 4
        else:
            type_rank = 3
    else:
        type_rank = 99

    method_rank = 1 if policy.method == req_method else 2

    return (
        type_rank,
        -literal_segments,
        method_rank,
        policy.priority,
        -pattern_len,
        policy.id,
    )


def find_matching_policy(
    policies: List[Policy], request_path: str, method: HttpMethod
) -> Tuple[Optional[Policy], List[Policy], bool, str]:
    """
    Finds the winning matching policy from an active list of policies.
    Returns:
        (winning_policy, all_matching_candidates, is_ambiguous, ambiguity_details)
    """
    norm_req_path = normalize_path(request_path)
    matching_candidates: List[Tuple[Policy, Tuple]] = []

    for policy in policies:
        if not policy.enabled:
            continue

        # Method check
        if policy.method != HttpMethod.ANY and policy.method != method:
            continue

        # Path check
        is_match, _, _, _ = match_path_pattern(policy.path_pattern, norm_req_path)
        if is_match:
            score = calculate_precedence_tuple(policy, norm_req_path, method)
            matching_candidates.append((policy, score))

    if not matching_candidates:
        return None, [], False, ""

    # Sort candidates by precedence score
    matching_candidates.sort(key=lambda x: x[1])

    top_candidate = matching_candidates[0][0]
    top_score = matching_candidates[0][1]

    # Check for ambiguous tie (identical type_rank, literal segments, method_rank, and priority)
    is_ambiguous = False
    ambiguity_msg = ""
    if len(matching_candidates) > 1:
        second_candidate = matching_candidates[1][0]
        second_score = matching_candidates[1][1]

        # Ignore the policy.id tie breaker when comparing true rule precedence:
        if top_score[:5] == second_score[:5] and top_candidate.id != second_candidate.id:
            is_ambiguous = True
            ambiguity_msg = (
                f"Ambiguous policy conflict: '{top_candidate.name}' ({top_candidate.id}) and "
                f"'{second_candidate.name}' ({second_candidate.id}) have identical match specificity, "
                f"method enforcement, and priority ({top_candidate.priority})."
            )

    all_matched_policies = [item[0] for item in matching_candidates]
    return top_candidate, all_matched_policies, is_ambiguous, ambiguity_msg


def simulate_request(
    policies: List[Policy],
    sim_input: RequestSimulationInput,
) -> SimulationResult:
    """
    Executes a complete, deterministic gateway policy evaluation for a simulated request.
    Produces an ordered, verifiable decision trace and simulated response.
    """
    trace: List[DecisionTraceStep] = []
    step_num = 1
    norm_path = normalize_path(sim_input.path)

    # Step 1: Policy Match & Route Resolution
    winner, candidates, is_ambiguous, ambiguity_msg = find_matching_policy(
        policies, norm_path, sim_input.method
    )

    if is_ambiguous:
        trace.append(
            DecisionTraceStep(
                step_number=step_num,
                step_name="Route Matching & Precedence Resolution",
                status="FAIL",
                message=f"Ambiguous Precedence Conflict: {ambiguity_msg}",
                details={
                    "request_path": norm_path,
                    "request_method": sim_input.method,
                    "conflicting_candidates": [c.id for c in candidates[:2]],
                },
            )
        )
        return SimulationResult(
            decision=Decision.BLOCK,
            status_code=409,
            selected_policy_id=None,
            selected_policy_name=None,
            destination_service=None,
            matched_path_pattern=None,
            summary=f"Routing Blocked: {ambiguity_msg}",
            trace=trace,
        )

    if not winner:
        # Check if disabled policy exists for better educational explanation
        disabled_matches = [
            p
            for p in policies
            if not p.enabled
            and match_path_pattern(p.path_pattern, norm_path)[0]
            and (p.method == HttpMethod.ANY or p.method == sim_input.method)
        ]

        msg = f"No enabled policy matched route '{norm_path}' [{sim_input.method.value}]."
        if disabled_matches:
            msg += f" (Note: Policy '{disabled_matches[0].name}' matched but is currently DISABLED)."

        trace.append(
            DecisionTraceStep(
                step_number=step_num,
                step_name="Route Matching",
                status="FAIL",
                message=msg,
                details={
                    "request_path": norm_path,
                    "request_method": sim_input.method,
                    "enabled_policies_evaluated": len([p for p in policies if p.enabled]),
                },
            )
        )
        return SimulationResult(
            decision=Decision.BLOCK,
            status_code=404,
            selected_policy_id=None,
            selected_policy_name=None,
            destination_service=None,
            matched_path_pattern=None,
            summary=f"Route Not Found (404): {msg}",
            trace=trace,
        )

    trace.append(
        DecisionTraceStep(
            step_number=step_num,
            step_name="Route Matching & Policy Selection",
            status="PASS",
            message=f"Matched policy '{winner.name}' ({winner.id}) on pattern '{winner.path_pattern}' (Priority: {winner.priority}).",
            details={
                "matched_policy_id": winner.id,
                "matched_policy_name": winner.name,
                "pattern": winner.path_pattern,
                "method_rule": winner.method.value,
                "target_service": winner.destination_service,
                "other_candidates_count": len(candidates) - 1,
            },
        )
    )
    step_num += 1

    # Step 2: Role-Based Authorization Enforcement
    role_allowed = sim_input.simulated_role in winner.allowed_roles
    if not role_allowed:
        allowed_names = [r.value for r in winner.allowed_roles]
        trace.append(
            DecisionTraceStep(
                step_number=step_num,
                step_name="Role Authorization Enforcement",
                status="FAIL",
                message=(
                    f"Forbidden: Client role '{sim_input.simulated_role.value}' is NOT permitted. "
                    f"Required one of: {allowed_names}."
                ),
                details={
                    "simulated_role": sim_input.simulated_role.value,
                    "allowed_roles": allowed_names,
                    "policy_id": winner.id,
                },
            )
        )
        return SimulationResult(
            decision=Decision.BLOCK,
            status_code=403,
            selected_policy_id=winner.id,
            selected_policy_name=winner.name,
            destination_service=winner.destination_service,
            matched_path_pattern=winner.path_pattern,
            summary=(
                f"Access Forbidden (403): Role '{sim_input.simulated_role.value}' is not authorized "
                f"for policy '{winner.name}' ({winner.path_pattern})."
            ),
            trace=trace,
        )

    trace.append(
        DecisionTraceStep(
            step_number=step_num,
            step_name="Role Authorization Enforcement",
            status="PASS",
            message=f"Client role '{sim_input.simulated_role.value}' is authorized by policy '{winner.name}'.",
            details={
                "simulated_role": sim_input.simulated_role.value,
                "allowed_roles": [r.value for r in winner.allowed_roles],
            },
        )
    )
    step_num += 1

    # Step 3: Rate Limiting Simulation Check
    window = sim_input.time_window_seconds or winner.time_window_seconds
    limit = winner.request_limit
    sim_count = sim_input.simulated_request_count

    rate_limit_info = {
        "configured_limit": limit,
        "time_window_seconds": window,
        "simulated_request_count": sim_count,
        "rate_limit_exceeded": sim_count > limit,
        "remaining_capacity": max(0, limit - sim_count),
    }

    if sim_count > limit:
        trace.append(
            DecisionTraceStep(
                step_number=step_num,
                step_name="Rate Limit Simulation",
                status="FAIL",
                message=(
                    f"Rate limit exceeded: Simulated count ({sim_count}) exceeds limit "
                    f"({limit} requests per {window}s window)."
                ),
                details=rate_limit_info,
            )
        )
        return SimulationResult(
            decision=Decision.BLOCK,
            status_code=429,
            selected_policy_id=winner.id,
            selected_policy_name=winner.name,
            destination_service=winner.destination_service,
            matched_path_pattern=winner.path_pattern,
            summary=(
                f"Rate Limit Exceeded (429): Request count {sim_count} exceeds "
                f"policy limit {limit} req/{window}s."
            ),
            trace=trace,
            rate_limit_info=rate_limit_info,
        )

    trace.append(
        DecisionTraceStep(
            step_number=step_num,
            step_name="Rate Limit Simulation",
            status="PASS",
            message=(
                f"Request within quota: {sim_count} of {limit} simulated requests "
                f"within {window}s window ({limit - sim_count} remaining)."
            ),
            details=rate_limit_info,
        )
    )
    step_num += 1

    # Step 4: Destination Service Routing
    trace.append(
        DecisionTraceStep(
            step_number=step_num,
            step_name="Destination Service Proxy Dispatch",
            status="PASS",
            message=f"Request dispatched to downstream microservice: '{winner.destination_service}'.",
            details={
                "destination_service": winner.destination_service,
                "response_status": 200,
            },
        )
    )

    return SimulationResult(
        decision=Decision.ALLOW,
        status_code=200,
        selected_policy_id=winner.id,
        selected_policy_name=winner.name,
        destination_service=winner.destination_service,
        matched_path_pattern=winner.path_pattern,
        summary=(
            f"Request Allowed (200): Successfully authorized role '{sim_input.simulated_role.value}' "
            f"and routed to '{winner.destination_service}' via policy '{winner.name}'."
        ),
        trace=trace,
        rate_limit_info=rate_limit_info,
    )
