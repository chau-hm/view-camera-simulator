import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import "../i18n";
import { AppShell } from "../components/layout/AppShell";
import { getTaskById } from "../core/tasks/taskRegistry";
import { getSceneById } from "../scenes/definitions";
import { getPublicSceneEntries, getPublicSceneEntryById } from "./publicScenes";
import { isValidSimulatorRoute } from "./simulatorRouteValidation";
import type { SimulatorMode } from "../types/camera";

import { ViewCameraHeroIllustration } from "../components/marketing/ViewCameraHeroIllustration";
import { InfoCard } from "../components/marketing/InfoCard";
import { SceneCard } from "../components/marketing/SceneCard";
import { DesktopExperienceNotice } from "../components/marketing/DesktopExperienceNotice";
import { FaqSection } from "../components/marketing/FaqSection";

const SimulatorWorkspace = lazy(() =>
  import("../components/layout/SimulatorWorkspace").then((module) => ({ default: module.SimulatorWorkspace })),
);

export const HomePage = () => {
  const { t } = useTranslation();

  return (
    <AppShell title="">
      <section className="hero">
        <div className="hero__content">
          <div className="eyebrow">{t("home.hero.eyebrow")}</div>
          <h1>{t("home.hero.title")}</h1>
          <p>{t("home.hero.description")}</p>
          <div className="hero__actions">
            <Link className="btn btn--primary" to="/scenes">
              {t("home.hero.exploreSimulator")}
            </Link>
          </div>
        </div>

        <ViewCameraHeroIllustration />
      </section>

      <DesktopExperienceNotice />

      <section id="why" className="landing-info-section" aria-label={t("home.why.ariaLabel")}>
        <div className="landing-info-list">
          <InfoCard
            icon={<span className="material-symbols-outlined">architecture</span>}
            title={t("home.info.control.title")}
          >
            {t("home.info.control.body")}
          </InfoCard>

          <InfoCard
            icon={<span className="material-symbols-outlined">open_with</span>}
            title={t("home.info.movements.title")}
          >
            {t("home.info.movements.body")}
          </InfoCard>

          <InfoCard
            icon={<span className="material-symbols-outlined">person</span>}
            title={t("home.info.artists.title")}
          >
            {t("home.info.artists.body")}
          </InfoCard>
        </div>
      </section>

    </AppShell>
  );
};

export const FaqPage = () => {
  const { t } = useTranslation();

  return (
    <AppShell title="" useSiteShell>
      <div lang="en">
        <header className="faq-page-header">
          <h1>{t("home.faq.title")}</h1>
        </header>
        <FaqSection />
      </div>
    </AppShell>
  );
};

export const ScenesPage = () => {
  const { t } = useTranslation();
  const entries = getPublicSceneEntries();

  return (
    <AppShell title={t("scenes.page.title")} useSiteShell>
      <p>{t("scenes.page.intro")}</p>

      <DesktopExperienceNotice />

      <div className="scenes-grid">
        {entries.length === 0 ? (
          <div className="content-note">{t("scenes.page.noScenesAvailable")}</div>
        ) : (
          entries.map(({ scene, meta }) => (
            <SceneCard
              key={scene.id}
              sceneId={scene.id}
              title={t(meta.titleKey)}
              description={t(meta.descriptionKey)}
              topics={meta.topicKeys.map((topicKey) => t(topicKey))}
              availability={meta.availability}
              thumbnailAsset={meta.thumbnailAsset}
              guidedTaskId={meta.guidedTaskId}
              guidedLesson={Boolean(meta.guidedLesson)}
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
          guidedLessonEnabled={searchParams.get("lesson") === "1" && Boolean(publicEntry.guidedLesson)}
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
