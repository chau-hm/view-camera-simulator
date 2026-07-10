import { lazy, Suspense, useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { getSceneById } from "../scenes/definitions";
import { getPublicSceneEntries } from "./publicScenes";
import type { SimulatorMode } from "../types/camera";

import { ViewCameraHeroIllustration } from "../components/marketing/ViewCameraHeroIllustration";
import { InfoCard } from "../components/marketing/InfoCard";
import { FocusCtaPanel } from "../components/marketing/FocusCtaPanel";
import { SceneCard } from "../components/marketing/SceneCard";

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

      <ViewCameraHeroIllustration />
    </section>

    <section id="why" className="landing-info-section" aria-label="Why use a view camera">
      <div className="landing-info-list">
        <InfoCard icon={<span className="material-symbols-outlined">architecture</span>} title={"Why use a view camera when Photoshop can correct perspective?"}>
          Photoshop can reshape an image after it has been captured, but it cannot replace every decision made at the camera. A view camera lets the photographer keep vertical lines straight, place the plane of focus and compose the final geometry before exposure—often with less cropping and fewer compromises.
        </InfoCard>

        <InfoCard icon={<span className="material-symbols-outlined">open_with</span>} title={"When is the camera simpler than post-processing?"}>
          For architecture, interiors, still life and product photography, a carefully applied rise, tilt or swing can solve perspective and focus in one exposure. The alternative may require perspective correction, heavy cropping, focus stacking and repeated retouching.
        </InfoCard>

        <InfoCard icon={<span className="material-symbols-outlined">person</span>} title={"Why do artists still use view cameras?"}>
          A view camera slows the process down. The upside-down image on the ground glass encourages careful looking, and every movement becomes a deliberate choice. Artists use it not only for image quality, but because the method changes how a photograph is seen and made.
        </InfoCard>
      </div>
    </section>

    <FocusCtaPanel />
  </AppShell>
);

export const ScenesPage = () => {
  const entries = getPublicSceneEntries();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(({ scene, meta }) => {
      const hay = `${scene.name} ${meta.description} ${meta.topics.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [entries, query]);

  return (
    <AppShell title="Scenes" useSiteShell>
      <p>Choose a scene to explore how focus, perspective and camera movements affect the image on the ground glass.</p>

      <div className="scenes-header">
        <div className="scenes-search">
          <label htmlFor="scene-search" className="visually-hidden">Search scenes</label>
          <input id="scene-search" className="form-input" placeholder="Search scenes…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="scenes-grid">
        {filtered.length === 0 ? (
          <div className="content-note">No scenes match your search.</div>
        ) : (
          filtered.map(({ scene, meta }) => (
            <SceneCard key={scene.id} sceneId={scene.id} title={scene.name} description={meta.description} topics={meta.topics} badge={meta.badge ?? null} />
          ))
        )}
      </div>

      <div className="rebuild-notice">
        <span className="material-symbols-outlined">info</span>
        <div>Additional lessons for rise, tilt and swing are being rebuilt.</div>
      </div>
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
