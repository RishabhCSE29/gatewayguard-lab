/**
 * API client module for GatewayGuard Lab.
 * Connects to the FastAPI backend with timeout and error handling.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api").replace(/\/+$/, "");
export const DOCS_URL = `${API_BASE_URL.replace(/\/api\/?$/, "")}/docs`;

async function request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || JSON.stringify(errorData);
      } catch (e) {
        // use default status message
      }
      throw new Error(errorMessage);
    }
    return await response.json();
  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error(`Unable to connect to GatewayGuard backend at ${API_BASE_URL}. Please ensure the backend server is running and accessible.`);
    }
    throw err;
  }
}

export const api = {
  // Health
  getHealth: () => request("/health"),

  // Policies
  getPolicies: () => request("/policies"),
  updatePolicies: (policies) =>
    request("/policies", {
      method: "PUT",
      body: JSON.stringify({ policies }),
    }),
  resetPolicies: (mode = "safe") =>
    request("/policies/reset", {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),

  // Simulator
  simulateRequest: (simulationInput) =>
    request("/simulate", {
      method: "POST",
      body: JSON.stringify(simulationInput),
    }),

  // Conflicts
  getConflicts: () => request("/conflicts"),

  // Test Lab
  generateTests: () =>
    request("/tests/generate", {
      method: "POST",
    }),
  runTests: (tests = null) =>
    request("/tests/run", {
      method: "POST",
      body: JSON.stringify({ tests }),
    }),

  // Snapshots & Regression
  getSnapshots: () => request("/snapshots"),
  createSnapshot: (name, description = "") =>
    request("/snapshots", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),
  deleteSnapshot: (snapshotId) =>
    request(`/snapshots/${snapshotId}`, {
      method: "DELETE",
    }),
  compareWithBaseline: (baselineSnapshotId) =>
    request("/compare", {
      method: "POST",
      body: JSON.stringify({ baseline_snapshot_id: baselineSnapshotId }),
    }),
};
