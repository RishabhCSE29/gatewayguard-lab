"""
Data models and schemas for GatewayGuard Lab API Gateway Policy Testing Simulator.
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class HttpMethod(str, Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"
    ANY = "ANY"


class Role(str, Enum):
    ADMIN = "Admin"
    STUDENT = "Student"
    PUBLIC = "Public"


class Decision(str, Enum):
    ALLOW = "ALLOW"
    BLOCK = "BLOCK"


class ConflictSeverity(str, Enum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class ConflictType(str, Enum):
    SHADOWED_POLICY = "SHADOWED_POLICY"
    PUBLIC_EXPOSURE_RISK = "PUBLIC_EXPOSURE_RISK"
    AMBIGUOUS_DUPLICATE_RULE = "AMBIGUOUS_DUPLICATE_RULE"
    BROAD_WILDCARD_OVERLAP = "BROAD_WILDCARD_OVERLAP"
    MISSING_ROLE_RESTRICTION = "MISSING_ROLE_RESTRICTION"


class Policy(BaseModel):
    id: str = Field(..., description="Unique alphanumeric identifier for policy (e.g. pol_admin_system)")
    name: str = Field(..., min_length=1, max_length=100, description="Human readable name")
    path_pattern: str = Field(..., description="Route path pattern (e.g. /api/student/{id}, /api/admin/*)")
    method: HttpMethod = Field(default=HttpMethod.GET, description="HTTP Method or ANY")
    allowed_roles: List[Role] = Field(..., min_length=1, description="List of allowed simulated roles")
    destination_service: str = Field(..., min_length=1, description="Target backend microservice name")
    request_limit: int = Field(default=10, gt=0, description="Max allowed requests within the time window")
    time_window_seconds: int = Field(default=60, gt=0, description="Time window in seconds for rate limit")
    enabled: bool = Field(default=True, description="Whether policy is active")
    priority: int = Field(default=10, ge=1, le=1000, description="Deterministic priority (lower number = higher precedence)")
    description: Optional[str] = Field(default="", description="Policy description and purpose")

    @field_validator("path_pattern")
    def validate_path_pattern(cls, v: str) -> str:
        clean = v.strip()
        if not clean.startswith("/"):
            raise ValueError("Path pattern must start with a forward slash '/' (e.g. /api/users)")
        if " " in clean:
            raise ValueError("Path pattern cannot contain whitespace")
        return clean

    @field_validator("id")
    def validate_id(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Policy ID cannot be empty")
        return clean


class PolicyListUpdate(BaseModel):
    policies: List[Policy] = Field(..., description="Complete list of updated policies")


class RequestSimulationInput(BaseModel):
    path: str = Field(..., description="Simulated incoming request URL path")
    method: HttpMethod = Field(default=HttpMethod.GET, description="Simulated HTTP method")
    simulated_role: Role = Field(default=Role.PUBLIC, description="Simulated client role identity")
    simulated_request_count: int = Field(default=1, ge=1, description="Simulated number of requests within the window")
    time_window_seconds: Optional[int] = Field(default=None, ge=1, description="Simulated time window override (optional)")

    @field_validator("path")
    def validate_sim_path(cls, v: str) -> str:
        clean = v.strip()
        if not clean.startswith("/"):
            return "/" + clean
        return clean


class DecisionTraceStep(BaseModel):
    step_number: int
    step_name: str
    status: str  # "PASS", "FAIL", "SKIPPED", "INFO"
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)


class SimulationResult(BaseModel):
    decision: Decision
    status_code: int
    selected_policy_id: Optional[str] = None
    selected_policy_name: Optional[str] = None
    destination_service: Optional[str] = None
    matched_path_pattern: Optional[str] = None
    simulated_identity_disclaimer: str = (
        "Educational Simulation Notice: Simulated roles (Admin/Student/Public) represent policy test assertions, "
        "not cryptographic authentication tokens. This engine is a policy simulator, not a production gateway."
    )
    summary: str
    trace: List[DecisionTraceStep] = Field(default_factory=list)
    rate_limit_info: Optional[Dict[str, Any]] = None


class ConflictFinding(BaseModel):
    id: str
    severity: ConflictSeverity
    conflict_type: ConflictType
    title: str
    affected_policy_ids: List[str]
    affected_policy_names: List[str]
    explanation: str
    is_verified_issue: bool
    suggested_fix: str


class ConflictReport(BaseModel):
    total_conflicts: int
    error_count: int
    warning_count: int
    findings: List[ConflictFinding]


class GeneratedTestCase(BaseModel):
    test_id: str
    category: str
    name: str
    path: str
    method: HttpMethod
    simulated_role: Role
    simulated_request_count: int
    time_window_seconds: int
    expected_decision: Decision
    expected_status_code: int
    expected_policy_id: Optional[str] = None
    rationale: str


class TestExecutionResult(BaseModel):
    test_case: GeneratedTestCase
    actual_decision: Decision
    actual_status_code: int
    actual_policy_id: Optional[str] = None
    actual_service: Optional[str] = None
    passed: bool
    trace: List[DecisionTraceStep] = Field(default_factory=list)
    failure_reason: Optional[str] = None


class TestSuiteRunReport(BaseModel):
    total_tests: int
    passed_tests: int
    failed_tests: int
    pass_rate_percentage: float
    results: List[TestExecutionResult]
    timestamp: str


class Snapshot(BaseModel):
    id: str
    name: str
    timestamp: str
    description: str = ""
    policies: List[Policy]
    conflict_count: int = 0


class CreateSnapshotInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = ""


class ComparisonReport(BaseModel):
    baseline_snapshot_id: str
    baseline_snapshot_name: str
    baseline_timestamp: str
    baseline_pass_rate: float
    current_pass_rate: float
    total_tests_baseline: int
    total_tests_current: int
    new_failures: List[TestExecutionResult]
    resolved_failures: List[TestExecutionResult]
    decision_changes: List[Dict[str, Any]]
    introduced_conflicts: List[ConflictFinding]
    resolved_conflicts: List[ConflictFinding]
    policy_diff: Dict[str, Any]
    summary_message: str
