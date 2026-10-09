"""
GatewayGuard Lab FastAPI Backend Application.
Provides RESTful APIs for Policy Management, Request Simulation,
Conflict Analysis, Automated Test Generation, Snapshots, and Regression Comparisons.
"""

import os
import json
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.models import (
    Policy,
    PolicyListUpdate,
    RequestSimulationInput,
    SimulationResult,
    ConflictReport,
    GeneratedTestCase,
    TestSuiteRunReport,
    Snapshot,
    CreateSnapshotInput,
    ComparisonReport,
)
from app.engine import simulate_request
from app.conflicts import analyze_policy_conflicts
from app.test_generation import generate_test_suite_from_policies, run_test_suite
from app.snapshots import (
    load_snapshots,
    create_snapshot,
    get_snapshot_by_id,
    delete_snapshot,
    compare_baseline_with_current,
)

SAMPLE_CONFIG_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "config", "sample_policies.json"
)
ACTIVE_POLICIES_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "active_policies.json"
)

app = FastAPI(
    title="GatewayGuard Lab API",
    description="Educational API Gateway Policy Testing Simulator & Conflict Analysis Engine",
    version="1.0.0",
)

# Enable CORS for Vite frontend and local tools
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _load_sample_config() -> Dict[str, Any]:
    with open(SAMPLE_CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _get_active_policies() -> List[Policy]:
    """Loads active policies from disk if exists, else defaults to safe sample policies."""
    if os.path.exists(ACTIVE_POLICIES_FILE):
        try:
            with open(ACTIVE_POLICIES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [Policy(**item) for item in data]
        except Exception:
            pass

    config = _load_sample_config()
    return [Policy(**item) for item in config.get("safe_default_policies", [])]


def _save_active_policies(policies: List[Policy]) -> None:
    os.makedirs(os.path.dirname(ACTIVE_POLICIES_FILE), exist_ok=True)
    with open(ACTIVE_POLICIES_FILE, "w", encoding="utf-8") as f:
        json.dump([p.model_dump() for p in policies], f, indent=2)


class ResetPoliciesRequest(BaseModel):
    mode: str = "safe"  # "safe" or "misconfigured"


class CompareRequest(BaseModel):
    baseline_snapshot_id: str


@app.get("/api/health", tags=["System"])
def get_health():
    """System health check and engine metadata."""
    policies = _get_active_policies()
    return {
        "status": "online",
        "service": "GatewayGuard-Lab-Engine",
        "active_policies_count": len(policies),
        "disclaimer": (
            "Educational API Gateway Policy Testing Simulator. "
            "Simulated roles are not cryptographic authentication."
        ),
    }


@app.get("/api/policies", response_model=List[Policy], tags=["Policies"])
def get_policies():
    """Retrieves all active gateway policies."""
    return _get_active_policies()


@app.put("/api/policies", response_model=List[Policy], tags=["Policies"])
def update_policies(update: PolicyListUpdate):
    """Updates and validates the entire active policy list."""
    # Validate unique IDs
    ids = [p.id for p in update.policies]
    if len(ids) != len(set(ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate policy IDs detected in update list.",
        )
    _save_active_policies(update.policies)
    return update.policies


@app.post("/api/policies/reset", response_model=List[Policy], tags=["Policies"])
def reset_policies(req: ResetPoliciesRequest = ResetPoliciesRequest(mode="safe")):
    """
    Resets policies to either 'safe' default configuration or 'misconfigured' demo scenario.
    """
    config = _load_sample_config()
    if req.mode == "misconfigured":
        policies = [Policy(**item) for item in config.get("misconfigured_demo_policies", [])]
    else:
        policies = [Policy(**item) for item in config.get("safe_default_policies", [])]

    _save_active_policies(policies)
    return policies


@app.post("/api/simulate", response_model=SimulationResult, tags=["Simulation"])
def run_simulation(sim_input: RequestSimulationInput):
    """
    Simulates an incoming HTTP request through the deterministic policy engine.
    Returns routing decision, authorization status, rate limit status, and step trace.
    """
    policies = _get_active_policies()
    return simulate_request(policies, sim_input)


@app.get("/api/conflicts", response_model=ConflictReport, tags=["Conflicts"])
def get_conflicts():
    """
    Analyzes active policies for shadowing, ambiguity, and public exposure conflicts.
    """
    policies = _get_active_policies()
    return analyze_policy_conflicts(policies)


@app.post("/api/tests/generate", response_model=List[GeneratedTestCase], tags=["Test Lab"])
def generate_tests():
    """
    Derives automated test cases dynamically from the active policy configuration.
    """
    policies = _get_active_policies()
    return generate_test_suite_from_policies(policies)


class RunTestsRequest(BaseModel):
    tests: Optional[List[GeneratedTestCase]] = None


@app.post("/api/tests/run", response_model=TestSuiteRunReport, tags=["Test Lab"])
def run_tests(req: RunTestsRequest = RunTestsRequest()):
    """
    Executes generated or provided test cases through the real policy engine.
    """
    policies = _get_active_policies()
    return run_test_suite(policies, req.tests)


@app.get("/api/snapshots", response_model=List[Snapshot], tags=["Snapshots"])
def get_snapshots():
    """Returns all saved baseline snapshots."""
    return load_snapshots()


@app.post("/api/snapshots", response_model=Snapshot, tags=["Snapshots"])
def save_snapshot(input_data: CreateSnapshotInput):
    """Saves the current active policy configuration as a named baseline snapshot."""
    policies = _get_active_policies()
    return create_snapshot(input_data, policies)


@app.get("/api/snapshots/{snapshot_id}", response_model=Snapshot, tags=["Snapshots"])
def get_snapshot(snapshot_id: str):
    """Retrieves a single baseline snapshot by ID."""
    snapshot = get_snapshot_by_id(snapshot_id)
    if not snapshot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Snapshot with ID '{snapshot_id}' not found.",
        )
    return snapshot


@app.delete("/api/snapshots/{snapshot_id}", tags=["Snapshots"])
def delete_snapshot_endpoint(snapshot_id: str):
    """Deletes a saved baseline snapshot."""
    success = delete_snapshot(snapshot_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Snapshot with ID '{snapshot_id}' not found.",
        )
    return {"message": f"Snapshot '{snapshot_id}' deleted successfully."}


@app.post("/api/compare", response_model=ComparisonReport, tags=["Regression Lab"])
def compare_with_baseline(req: CompareRequest):
    """
    Runs regression analysis comparing a saved baseline snapshot with current active policies.
    """
    baseline = get_snapshot_by_id(req.baseline_snapshot_id)
    if not baseline:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Baseline snapshot with ID '{req.baseline_snapshot_id}' not found.",
        )
    current_policies = _get_active_policies()
    return compare_baseline_with_current(baseline, current_policies)
