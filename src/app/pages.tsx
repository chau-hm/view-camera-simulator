import { lazy, Suspense } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { getSceneById } from "../scenes/definitions";
import type { SimulatorMode } from "../types/camera";

const SimulatorWorkspace = lazy(() =>
  import("../components/layout/SimulatorWorkspace").then((module) => ({ default: module.SimulatorWorkspace })),
);

export const HomePage = () => (
  <AppShell title="View Camera Simulator">
    <p>Learn rise, tilt, and swing through synchronized 2D/3D and ground-glass views.</p>
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <Link to="/mode">Choose mode</Link>
      <Link data-testid="guided-entry" to="/simulator/guided/architecture-rise/task-rise-basics">
        Start guided mode
      </Link>
      <Link data-testid="free-entry" to="/simulator/free/architecture-rise">
        Start free mode
      </Link>
      <Link data-testid="debug-simple-dof" to="/simulator/free/debug-simple-dof">
        Debug: Simple DOF test
      </Link>
    </div>
  </AppShell>
);

export const ModeSelectionPage = () => {
  const navigate = useNavigate();
  return (
    <AppShell title="Select mode">
      <button type="button" onClick={() => navigate("/simulator/guided/architecture-rise/task-rise-basics")}>
        Guided mode
      </button>
      <button type="button" onClick={() => navigate("/simulator/free/architecture-rise")}>
        Free mode
      </button>
    </AppShell>
  );
};

export const SimulatorRoutePage = () => {
  const { mode, sceneId, taskId } = useParams<{
    mode: string;
    sceneId: string;
    taskId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const parsedMode: SimulatorMode = mode === "free" ? "free" : "guided";
  const resolvedSceneId = sceneId ?? "architecture-rise";

  if (!getSceneById(resolvedSceneId)) {
    return <Navigate to="/not-found" replace />;
  }

  return (
    <AppShell title="Simulator workspace">
      <Suspense fallback={<p>Loading simulator workspace…</p>}>
        <SimulatorWorkspace
          mode={parsedMode}
          sceneId={resolvedSceneId}
          taskId={taskId ?? null}
          simulateAssetFailure={searchParams.get("assetError") === "1"}
        />
      </Suspense>
    </AppShell>
  );
};

export const ResultPage = () => (
  <AppShell title="Task result">
    <p>This route is reserved for final task summaries and debrief text.</p>
    <Link to="/">Back to home</Link>
  </AppShell>
);

export const NotFoundPage = () => (
  <AppShell title="Not found">
    <p>Route not found. Please return to the homepage.</p>
    <Link to="/">Go home</Link>
  </AppShell>
);
