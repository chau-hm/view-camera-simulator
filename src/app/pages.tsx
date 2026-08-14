import { lazy, Suspense } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { getTaskById } from "../core/tasks/taskRegistry";
import { getSceneById } from "../scenes/definitions";
import { getPublicSceneEntries, getPublicSceneEntryById } from "./publicScenes";
import { isValidSimulatorRoute } from "./simulatorRouteValidation";
import type { SimulatorMode } from "../types/camera";

import { ViewCameraHeroIllustration } from "../components/marketing/ViewCameraHeroIllustration";
import { InfoCard } from "../components/marketing/InfoCard";
import { FocusCtaPanel } from "../components/marketing/FocusCtaPanel";
import { SceneCard } from "../components/marketing/SceneCard";
import { DesktopExperienceNotice } from "../components/marketing/DesktopExperienceNotice";

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
          Move the whole camera or its Front and Rear standards, then compare how viewpoint, framing, perspective
          and focus change on the Ground Glass.
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

    <DesktopExperienceNotice />

    <section id="why" className="landing-info-section" aria-label="Why use a view camera">
      <div className="landing-info-list">
        <InfoCard icon={<span className="material-symbols-outlined">architecture</span>} title={"What can a view camera control before exposure?"}>
          A view camera separates decisions that are often bundled together: where the camera observes from, how the subject is framed, how the image geometry is controlled, and where the plane of sharp focus lies. These relationships can be shaped at the camera before exposure rather than treated only as corrections afterwards.
        </InfoCard>

        <InfoCard icon={<span className="material-symbols-outlined">open_with</span>} title={"Why do camera movements matter?"}>
          Rise and shift can change framing without moving the viewpoint. Tilt and swing can rotate the plane of sharp focus. Moving the whole camera changes viewpoint, perspective relationships and parallax. The useful question is which physical relationship you want to change.
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

  return (
    <AppShell title="Scenes" useSiteShell>
      <p>Choose a scene to compare viewpoint, framing, perspective geometry and plane-of-sharp-focus control on the Ground Glass.</p>

      <DesktopExperienceNotice />

      <div className="scenes-grid">
        {entries.length === 0 ? (
          <div className="content-note">No scenes available.</div>
        ) : (
          entries.map(({ scene, meta }) => (
            <SceneCard
              key={scene.id}
              sceneId={scene.id}
              title={scene.name}
              description={meta.description}
              topics={meta.topics}
              availability={meta.availability}
              thumbnailAsset={meta.thumbnailAsset}
              guidedTaskId={meta.guidedTaskId}
            />
          ))
        )}
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
  const parsedMode: SimulatorMode | null =
    mode === "free" || mode === "guided" ? mode : null;
  const resolvedSceneId = sceneId ?? "architecture-rise";
  const scene = getSceneById(resolvedSceneId);
  const publicEntry = getPublicSceneEntryById(resolvedSceneId);
  const resolvedTask = taskId ? getTaskById(taskId) : undefined;

  if (
    !scene ||
    !publicEntry ||
    publicEntry.availability !== "available" ||
    !parsedMode ||
    !isValidSimulatorRoute({
      mode: parsedMode,
      taskId,
      sceneId: resolvedSceneId,
      publicEntry,
      task: resolvedTask,
    })
  ) {
    return <Navigate to="/scenes" replace />;
  }

  return (
    <AppShell title="" fullBleed>
      <Suspense fallback={<p>Loading simulator workspace…</p>}>
        <SimulatorWorkspace
          mode={parsedMode}
          sceneId={resolvedSceneId}
          taskId={taskId ?? null}
          calibrationEnabled={parsedMode === "free" && resolvedSceneId === "understanding-camera-movements" && searchParams.get("cameraCalibration") === "1"}
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
