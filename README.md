# 🛡️ GatewayGuard Lab
### Local Educational API Gateway Policy Testing Simulator & Conflict Analysis Engine

> **⚠️ Educational Simulation Notice**  
> GatewayGuard Lab is a local policy testing simulator designed for educational and conceptual verification. Simulated identities (`Admin`, `Student`, `Public`) represent deterministic test assertions rather than cryptographic credentials (e.g. signed JWTs, mTLS, or OAuth2 tokens). This engine is not a production-facing security gateway.

---

## 📌 Project Overview

**GatewayGuard Lab** is an interactive, full-stack testing laboratory designed to demonstrate how modern API Gateways evaluate routing rules, enforce role-based access control (RBAC), apply token-bucket/windowed rate limits, identify policy shadow/ambiguity conflicts, and guard against regressions using snapshot-based diff testing.

### Key Capabilities:
1. **Deterministic Precedence Engine**: Strict hierarchical route matching (`Exact` > `Parametric` > `Specific Wildcard` > `Root Wildcard` > `Priority Tier`).
2. **Interactive Request Simulator**: Test live simulated HTTP requests with custom roles, methods, paths, and burst request rates.
3. **Static Conflict Detection Analyzer**: Detects shadowed policies, ambiguous duplicate precedence, and accidental public exposure risks.
4. **Dynamic Test Lab**: Generates reproducible test matrices derived from the active policy configuration (happy path, forbidden roles, rate limit boundaries $N$ vs $N+1$, and method enforcement).
5. **Before/After Regression Lab**: Snapshot baseline policy sets and detect breaking regressions, fixed failures, and decision shifts.

---

## 🏗️ Architecture & Project Structure

```
GatewayGuard-Lab-Fresh/
├── README.md                      # Project documentation and demo guide
├── .gitignore                     # Git ignore rules for Python/Node/build
├── backend/                       # Python FastAPI Backend
│   ├── requirements.txt           # Python dependencies
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                # FastAPI REST API endpoints & CORS
│   │   ├── models.py              # Pydantic data schemas & validators
│   │   ├── engine.py              # Deterministic routing & simulation engine
│   │   ├── conflicts.py           # Static conflict analysis detector
│   │   ├── test_generation.py     # Dynamic test suite generator & runner
│   │   └── snapshots.py           # Snapshot persistence & regression diffing
│   ├── config/
│   │   └── sample_policies.json   # Safe defaults and demo misconfiguration presets
│   ├── data/                      # Local JSON persistence (active policies & snapshots)
│   └── tests/
│       ├── __init__.py
│       └── test_gateway.py        # Comprehensive 13-test Pytest suite
└── frontend/                      # React + Vite Dashboard
    ├── package.json               # Frontend dependencies & scripts
    ├── index.html                 # HTML entry point
    └── src/
        ├── main.jsx               # Application root
        ├── App.jsx                # State orchestration & tab views
        ├── api.js                 # HTTP client connecting to FastAPI backend
        ├── styles.css             # Dark navy developer design system
        └── components/
            ├── ArchitectureFlow.jsx   # Visual request pipeline diagram
            ├── Navbar.jsx             # Sidebar navigation with dynamic counters
            ├── Overview.jsx           # Metrics, pipeline, and quick simulator
            ├── PolicyEditor.jsx       # CRUD policy management & preset loader
            ├── RequestSimulator.jsx   # Live request execution & step traces
            ├── ConflictLab.jsx        # Static analysis conflict viewer & remediator
            ├── TestLab.jsx            # Dynamic test generator & pass/fail inspector
            └── ComparisonLab.jsx      # Baseline snapshot diffing & regression analyzer
```

---

## ⚙️ Prerequisites

- **Python**: Version 3.9 or higher
- **Node.js**: Version 18 or higher (tested on Node 20 / 24)
- **npm**: Version 9 or higher

---

## 🚀 Quick Setup & Startup Instructions

### 1. Backend Setup (FastAPI)

#### macOS / Linux:
```bash
# In the project root:
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Run Pytest verification:
PYTHONPATH=backend pytest backend/tests/ -v

# Start FastAPI Backend Server:
PYTHONPATH=backend uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

#### Windows (PowerShell):
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt

$env:PYTHONPATH="backend"
pytest backend\tests\ -v
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

*Backend runs at: **http://127.0.0.1:8000***  
*Swagger OpenAPI Documentation: **http://127.0.0.1:8000/docs***

---

### 2. Frontend Setup (React + Vite)

Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```

*Frontend runs at: **http://localhost:5173***

---

## 📖 Route Precedence & Policy Engine Semantics

When a request arrives (`METHOD`, `PATH`, `ROLE`, `COUNT`):
1. **Enabled Check**: Only active policies (`enabled: true`) participate in matching.
2. **Method Filter**: Policy matches if `policy.method == req.method` or `policy.method == ANY`.
3. **Path Matching Hierarchy**:
   - **Exact Match** (e.g. `/api/student/profile`) has highest precedence.
   - **Parametric Match** (e.g. `/api/student/{id}/results`) takes precedence over wildcards.
   - **Specific Wildcard** (e.g. `/api/admin/*`) takes precedence over broader wildcards.
   - **Root Wildcard** (e.g. `/*`) acts as lowest priority fallback.
4. **Tie-Breakers**:
   - Specific HTTP methods (e.g. `GET`) beat `ANY`.
   - Lower `priority` integer values represent higher precedence (e.g., Priority 10 beats Priority 20).
   - If two rules match identically on path, method, and priority, an **Ambiguity Conflict (409)** is flagged.
5. **Role Authorization**: Client role (`Admin`, `Student`, `Public`) must be present in `allowed_roles` (otherwise `403 Forbidden`).
6. **Rate Limiting Simulation**: If `simulated_request_count > request_limit` within `time_window_seconds`, returns `429 Too Many Requests`.
7. **Downstream Dispatch**: If all checks pass, returns `200 OK` routed to `destination_service`.

---

## 🌐 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Gateway health check and engine metadata |
| `GET` | `/api/policies` | Retrieve all active gateway policies |
| `PUT` | `/api/policies` | Update and validate policy list |
| `POST` | `/api/policies/reset` | Reset to `'safe'` default or `'misconfigured'` demo |
| `POST` | `/api/simulate` | Execute request simulation through engine |
| `GET` | `/api/conflicts` | Run static conflict analysis |
| `POST` | `/api/tests/generate` | Dynamically generate test matrix |
| `POST` | `/api/tests/run` | Execute test suite against active policies |
| `GET` | `/api/snapshots` | List saved baseline snapshots |
| `POST` | `/api/snapshots` | Save current configuration as baseline |
| `DELETE` | `/api/snapshots/{id}` | Delete a baseline snapshot |
| `POST` | `/api/compare` | Run regression diff comparing baseline with current |

---

## 🎬 5-Minute Demonstration Walkthrough

Follow these steps for an interactive college presentation or evaluation:

### Step 1: Tour Overview & Architecture Pipeline (1 Min)
1. Open **http://localhost:5173** in your browser.
2. Note the live dashboard metrics (6 Active Policies, 0 Conflicts, 100% Pass Rate).
3. Review the **Interactive Architecture Pipeline** diagram demonstrating the 4-stage evaluation flow.

### Step 2: Live Request Simulator (1 Min)
1. Navigate to **Request Simulator**.
2. Click the quick preset **"Admin System (Authorized)"** -> Click **Simulate Request**.
   - Result: `200 ALLOW` -> Routed to `admin-system-service`.
3. Click preset **"Admin System (Unauthorized Student 403)"** -> Click **Simulate Request**.
   - Result: `403 BLOCK` -> Trace explains Role `Student` is not in allowed roles `['Admin']`.
4. Click preset **"Exam Results (Rate Limit Exceeded 429)"** (Simulated count = 10, Limit = 5).
   - Result: `429 BLOCK` -> Visual quota meter turns red.

### Step 3: Trigger Reproducible Policy Conflicts (1 Min)
1. Navigate to **Conflict Detection** lab. Note **0 Conflicts**.
2. Click **"Load Misconfigured Demo Scenario"**.
3. Observe **2 High-Severity Conflicts** appear immediately:
   - **Shadowed Policy**: Broad `/api/*` rule with Priority 5 intercepts restricted admin/student routes.
   - **Ambiguous Duplicate Rule**: Conflicting `/api/student/profile` rules with identical priority 20.
4. Click **"Apply Corrected Safe Defaults"** -> Observe all conflicts disappear!

### Step 4: Automated Test Generation & Execution (1 Min)
1. Navigate to **Automated Test Lab**.
2. Click **"Re-Generate Test Cases"** -> Observe ~16 distinct tests dynamically synthesized from active rules.
3. Click **"Run All Test Cases"** -> Inspect the 100% pass rate with expandable decision traces.

### Step 5: Before / After Regression Diff (1 Min)
1. Navigate to **Before / After Diff**.
2. Click **"Save Current as Baseline"** (e.g. `Safe Baseline v1`).
3. Switch to **Policy Editor** -> Disable `Student Profile Service` or change its role.
4. Return to **Before / After Diff** -> Select `Safe Baseline v1` -> Click **"Run Regression Comparison"**.
5. Observe the **1 New Regression Detected** alert, side-by-side pass rate drop, and the exact failing test highlighted in red.

---

## 🧪 Automated Pytest Test Suite

Run the backend unit and integration test suite:
```bash
source venv/bin/activate
PYTHONPATH=backend pytest backend/tests/ -v
```

### Verified Test Cases:
- `test_admin_allowed_on_authorized_route` (200 ALLOW)
- `test_student_blocked_from_restricted_admin_route` (403 BLOCK)
- `test_public_allowed_on_public_route` (200 ALLOW)
- `test_unknown_route_returns_404` (404 BLOCK)
- `test_rate_limit_boundaries` (Exact limit = 200, Limit + 1 = 429)
- `test_specific_route_precedence_over_wildcard` (Exact route wins over wildcard)
- `test_method_enforcement` (POST to GET-only returns 404)
- `test_disabled_policy_returns_404`
- `test_policy_edits_change_outcomes`
- `test_conflict_detection_and_remediation`
- `test_baseline_regression_detection`
- `test_invalid_policy_input_validation` (422 Unprocessable Entity)
- `test_api_endpoints_full_lifecycle` (Health, reset, simulate, conflicts, tests)

---

## 🛠️ Troubleshooting & FAQ

- **Backend Connection Error in UI**:  
  Ensure uvicorn is running: `source venv/bin/activate && PYTHONPATH=backend uvicorn app.main:app --port 8000`.
- **CORS Issues**:  
  FastAPI has `CORSMiddleware` configured with `allow_origins=["*"]` by default.
- **Port Conflict**:  
  If port 8000 is occupied, launch uvicorn on port 8001: `uvicorn app.main:app --port 8001` and update `.env` or `api.js`.
