"""
Deterministic Policy Conflict Detection Analyzer for GatewayGuard Lab.
Evaluates active policies for shadowing, ambiguous duplicate precedence,
accidental public exposure risks, and broad wildcard intercept hazards.
"""

from typing import List, Dict
from app.models import (
    Policy,
    HttpMethod,
    Role,
    ConflictSeverity,
    ConflictType,
    ConflictFinding,
    ConflictReport,
)
from app.engine import normalize_path, match_path_pattern


def methods_overlap(m1: HttpMethod, m2: HttpMethod) -> bool:
    """True if m1 and m2 share at least one HTTP method."""
    if m1 == HttpMethod.ANY or m2 == HttpMethod.ANY:
        return True
    return m1 == m2


def is_subpattern_of(child_pattern: str, parent_pattern: str) -> bool:
    """
    Returns True if parent_pattern is a wildcard or broader pattern that completely
    encloses child_pattern.
    """
    norm_child = normalize_path(child_pattern)
    norm_parent = normalize_path(parent_pattern)

    if norm_parent in ("/*", "*"):
        return norm_child != norm_parent

    if norm_parent.endswith("/*"):
        prefix = norm_parent[:-2]
        return norm_child.startswith(prefix + "/") or norm_child == prefix

    if norm_parent.endswith("*"):
        prefix = norm_parent[:-1]
        return norm_child.startswith(prefix)

    # If parent is exact or parametric, identical pattern is equal
    return norm_child == norm_parent


def analyze_policy_conflicts(policies: List[Policy]) -> ConflictReport:
    """
    Executes a comprehensive, deterministic conflict analysis across all policies.
    """
    findings: List[ConflictFinding] = []
    finding_counter = 1
    enabled_policies = [p for p in policies if p.enabled]
    policy_map: Dict[str, Policy] = {p.id: p for p in policies}

    # 1. Check for Duplicate / Ambiguous Precedence Conflicts
    for i in range(len(enabled_policies)):
        p1 = enabled_policies[i]
        for j in range(i + 1, len(enabled_policies)):
            p2 = enabled_policies[j]

            # Identical normalized path pattern and overlapping method
            if (
                normalize_path(p1.path_pattern) == normalize_path(p2.path_pattern)
                and methods_overlap(p1.method, p2.method)
            ):
                if p1.priority == p2.priority:
                    # Verified Ambiguity Conflict
                    findings.append(
                        ConflictFinding(
                            id=f"conf_ambig_{finding_counter}",
                            severity=ConflictSeverity.ERROR,
                            conflict_type=ConflictType.AMBIGUOUS_DUPLICATE_RULE,
                            title=f"Ambiguous Duplicate Rule Precedence between '{p1.name}' and '{p2.name}'",
                            affected_policy_ids=[p1.id, p2.id],
                            affected_policy_names=[p1.name, p2.name],
                            explanation=(
                                f"Both policies define identical path pattern '{p1.path_pattern}' "
                                f"with overlapping methods ({p1.method.value} vs {p2.method.value}) "
                                f"and equal priority ({p1.priority}). The gateway cannot determine "
                                "a safe deterministic winner without an explicit priority difference."
                            ),
                            is_verified_issue=True,
                            suggested_fix=(
                                f"Assign distinct priority values to distinguish precedence, or "
                                f"consolidate the roles/destinations into a single unified policy."
                            ),
                        )
                    )
                    finding_counter += 1

    # 2. Check for Shadowed Policies (Higher priority broad rule intercepts specific rule)
    for p_specific in enabled_policies:
        for p_broad in enabled_policies:
            if p_specific.id == p_broad.id:
                continue

            # Check if p_broad encloses p_specific and has higher priority (lower integer)
            if (
                is_subpattern_of(p_specific.path_pattern, p_broad.path_pattern)
                and normalize_path(p_specific.path_pattern) != normalize_path(p_broad.path_pattern)
                and methods_overlap(p_specific.method, p_broad.method)
            ):
                # If broad rule has lower priority integer (higher precedence) than specific rule,
                # or if broad rule's priority is lower than or equal to specific rule:
                if p_broad.priority <= p_specific.priority:
                    findings.append(
                        ConflictFinding(
                            id=f"conf_shadow_{finding_counter}",
                            severity=ConflictSeverity.ERROR,
                            conflict_type=ConflictType.SHADOWED_POLICY,
                            title=f"Policy '{p_specific.name}' is Shadowed by Broad Policy '{p_broad.name}'",
                            affected_policy_ids=[p_broad.id, p_specific.id],
                            affected_policy_names=[p_broad.name, p_specific.name],
                            explanation=(
                                f"Broad policy '{p_broad.name}' on pattern '{p_broad.path_pattern}' "
                                f"has priority {p_broad.priority}, which overrides or shadows specific "
                                f"policy '{p_specific.name}' on pattern '{p_specific.path_pattern}' "
                                f"(priority {p_specific.priority}). Requests intended for "
                                f"'{p_specific.destination_service}' may be incorrectly intercepted "
                                f"by '{p_broad.destination_service}'."
                            ),
                            is_verified_issue=True,
                            suggested_fix=(
                                f"Increase priority of '{p_specific.name}' (e.g. set priority to {max(1, p_broad.priority - 5)}) "
                                f"or narrow the wildcard scope of '{p_broad.name}'."
                            ),
                        )
                    )
                    finding_counter += 1

    # 3. Check for Public Exposure Risks on Sensitive Routes
    for p in enabled_policies:
        if Role.PUBLIC in p.allowed_roles:
            norm_pat = normalize_path(p.path_pattern)

            # Check if broad public wildcard captures sensitive areas
            if norm_pat in ("/*", "/api/*", "/api"):
                # See if there exist admin/student policies within this scope
                restricted_children = [
                    other
                    for other in enabled_policies
                    if other.id != p.id
                    and (Role.ADMIN in other.allowed_roles or Role.STUDENT in other.allowed_roles)
                    and Role.PUBLIC not in other.allowed_roles
                    and is_subpattern_of(other.path_pattern, p.path_pattern)
                ]

                if restricted_children:
                    child_names = ", ".join([f"'{c.name}'" for c in restricted_children[:3]])
                    findings.append(
                        ConflictFinding(
                            id=f"conf_pub_exp_{finding_counter}",
                            severity=ConflictSeverity.ERROR if p.priority <= 15 else ConflictSeverity.WARNING,
                            conflict_type=ConflictType.PUBLIC_EXPOSURE_RISK,
                            title=f"Public Exposure Risk: Catch-All Policy '{p.name}' covers Restricted Routes",
                            affected_policy_ids=[p.id] + [c.id for c in restricted_children],
                            affected_policy_names=[p.name] + [c.name for c in restricted_children],
                            explanation=(
                                f"Policy '{p.name}' grants Public role access to broad path pattern "
                                f"'{p.path_pattern}'. Restricted private services ({child_names}) "
                                "could be inadvertently exposed if precedence rules are altered."
                            ),
                            is_verified_issue=p.priority <= min(c.priority for c in restricted_children),
                            suggested_fix=(
                                f"Restrict '{p.name}' to safe public prefixes like '/api/public/*' "
                                "and remove Public role from broad wildcard scopes."
                            ),
                        )
                    )
                    finding_counter += 1

            # Check if admin path explicitly allows Public
            elif "admin" in norm_pat.lower():
                findings.append(
                    ConflictFinding(
                        id=f"conf_pub_admin_{finding_counter}",
                        severity=ConflictSeverity.ERROR,
                        conflict_type=ConflictType.PUBLIC_EXPOSURE_RISK,
                        title=f"Direct Public Exposure: Policy '{p.name}' allows Public on Admin route",
                        affected_policy_ids=[p.id],
                        affected_policy_names=[p.name],
                        explanation=(
                            f"Policy '{p.name}' on admin path '{p.path_pattern}' includes 'Public' "
                            "in allowed roles. This contradicts standard zero-trust role segregation."
                        ),
                        is_verified_issue=True,
                        suggested_fix=f"Remove 'Public' from allowed roles on policy '{p.name}'.",
                    )
                )
                finding_counter += 1

    # 4. Check for Broad Wildcard Intercept Warnings
    for p in enabled_policies:
        norm_pat = normalize_path(p.path_pattern)
        if norm_pat in ("/*", "*"):
            findings.append(
                ConflictFinding(
                    id=f"conf_root_wild_{finding_counter}",
                    severity=ConflictSeverity.WARNING,
                    conflict_type=ConflictType.BROAD_WILDCARD_OVERLAP,
                    title=f"Root Wildcard Intercept in Policy '{p.name}'",
                    affected_policy_ids=[p.id],
                    affected_policy_names=[p.name],
                    explanation=(
                        f"Policy '{p.name}' uses root wildcard '{p.path_pattern}'. While useful as a fallback, "
                        "it will capture all unmapped routes and may mask 404 Route Not Found errors."
                    ),
                    is_verified_issue=False,
                    suggested_fix="Ensure this rule has the lowest priority (e.g. priority 900+) to only act as a default fallback.",
                )
            )
            finding_counter += 1

    err_count = sum(1 for f in findings if f.severity == ConflictSeverity.ERROR)
    warn_count = sum(1 for f in findings if f.severity == ConflictSeverity.WARNING)

    return ConflictReport(
        total_conflicts=len(findings),
        error_count=err_count,
        warning_count=warn_count,
        findings=findings,
    )
