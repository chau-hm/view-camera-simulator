import { lazy, Suspense } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { getSceneById } from "../scenes/definitions";
import { getPublicScenes } from "./publicScenes";
import type { SimulatorMode } from "../types/camera";

const SimulatorWorkspace = lazy(() =>
  import("../components/layout/SimulatorWorkspace").then((module) => ({ default: module.SimulatorWorkspace })),
);

export const HomePage = () => (
  <AppShell title="">
    <section className="hero">
      <div className="hero__content">
        <div className="eyebrow">Interactive View Camera Learning</div>
        <h1>See how a view camera changes the image before the shutter is pressed.</h1>
        <p>
          Move the camera, adjust focus and aperture, and compare the 3D scene with the image formed on the
          ground glass.
        </p>
        <div className="hero__actions">
          <Link className="btn btn--primary" to="/scenes">
            Explore the Simulator
          </Link>
          <a className="btn" href="#why">Learn Why</a>
        </div>
      </div>

      <div className="hero__visual" aria-hidden="true">
        <div className="preview-card">
          <div className="preview-card__title">Focus Fundamentals — Two Targets</div>
          <div className="preview-card__meta">Focus · Aperture · Depth of field</div>
        </div>
      </div>
    </section>

    <section id="why" className="content-section">
      <h2>Why use a view camera when Photoshop can correct perspective?</h2>
      <p>
        Photoshop can reshape an image after it has been captured, but it cannot replace every decision made at the
        camera. A view camera lets the photographer keep vertical lines straight, place the plane of focus and compose
        the final geometry before exposure—often with less cropping and fewer compromises.
      </p>
    </section>

    <section className="content-section">
      <h2>When is the camera simpler than post-processing?</h2>
      <p>
        For architecture, interiors, still life and product photography, a carefully applied rise, tilt or swing can
        solve perspective and focus in one exposure. The alternative may require perspective correction, heavy
        cropping, focus stacking and repeated retouching.
      </p>
    </section>

    <section className="content-section">
      <h2>Why do artists still use view cameras?</h2>
      <p>
        A view camera slows the process down. The upside-down image on the ground glass encourages careful looking,
        and every movement becomes a deliberate choice. Artists use it not only for image quality, but because the
        method changes how a photograph is seen and made.
      </p>
    </section>

    <section className="content-section">
      <h3>Start with focus</h3>
      <p>Use two targets at different distances to see how focus distance and aperture affect the ground-glass image.</p>
      <div className="content-section__actions">
        <Link className="btn btn--primary" to="/simulator/free/focus-fundamentals-two-targets">
          Open Focus Fundamentals
        </Link>
      </div>
    </section>
  </AppShell>
);

export const ScenesPage = () => {
  const scenes = getPublicScenes();
  return (
    <AppShell title="Scenes" useSiteShell>
      <p>Choose a scene to explore how focus, perspective and camera movements affect the image on the ground glass.</p>

      <div className="scene-grid">
        {scenes.map((s) => (
          <article key={s.id} className="scene-card">
            <h3>{s.name}</h3>
            <p>Compare two targets at different distances. Adjust focus and aperture to see how the plane of focus and depth of field change.</p>
            <div className="scene-card__meta">Focus · Aperture · Depth of field</div>
            <div className="scene-card__actions">
              <Link className="btn btn--primary" to={`/simulator/free/${s.id}`}>Open Scene</Link>
            </div>
          </article>
        ))}
      </div>

      <div className="content-note">Additional lessons for rise, tilt and swing are being rebuilt.</div>
    </AppShell>
  );
};


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
    <AppShell title="" fullBleed>
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
  <AppShell title="Task result" useSiteShell>
    <p>This route is reserved for final task summaries and debrief text.</p>
    <Link to="/">Back to home</Link>
  </AppShell>
);

export const NotFoundPage = () => (
  <AppShell title="Not found" useSiteShell>
    <p>Route not found. Please return to the homepage.</p>
    <div className="page-actions">
      <Link to="/">Back to Home</Link>
      <Link to="/scenes">Browse Scenes</Link>
    </div>
  </AppShell>
);
