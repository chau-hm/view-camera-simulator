import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SceneDefinition } from "../../types/scene";
import type { SceneVariantIdentity } from "../../types/sceneVariation";
import type { SceneVariantRouteResolution } from "../../app/sceneVariationRoute";
import {
  parseSceneSeedFromSearch,
  parseSceneVariationSchemaFromSearch,
} from "../../app/sceneVariationUrl";
import { useRegenerateSceneVariant } from "../../app/useRegenerateSceneVariant";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";

type SceneVariationControlsProps = {
  scene: Pick<SceneDefinition, "id" | "sceneVariation">;
  identity: SceneVariantIdentity | null;
  routeStatus: SceneVariantRouteResolution["status"];
  eligible: boolean;
};

export const SceneVariationControls = ({
  scene,
  identity,
  routeStatus,
  eligible,
}: SceneVariationControlsProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const regenerate = useRegenerateSceneVariant({
    mode: "free",
    scene,
    eligible,
  });

  const copyShareUrl = useCallback(async () => {
    if (
      !identity ||
      routeStatus !== "resolved" ||
      identity.sceneId !== scene.id ||
      typeof window === "undefined" ||
      !navigator.clipboard?.writeText
    ) {
      setCopyStatus("failed");
      return;
    }

    const browserUrl = new URL(window.location.href);
    const browserSeed = parseSceneSeedFromSearch(browserUrl.search);
    const browserSchema = parseSceneVariationSchemaFromSearch(browserUrl.search);
    if (
      browserUrl.search !== location.search ||
      browserUrl.hash !== location.hash ||
      browserSeed.kind !== "valid" ||
      browserSeed.seed !== identity.seed ||
      browserSchema.kind !== "valid" ||
      browserSchema.schemaVersion !== identity.schemaVersion
    ) {
      setCopyStatus("failed");
      return;
    }

    try {
      // The browser URL includes Vite's deployment base path; Router location
      // paths are basename-relative, so do not reconstruct the absolute URL.
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }, [identity, location.hash, location.search, routeStatus, scene.id]);

  const statusMessage = routeStatus === "unsupported-schema"
    ? t(simulatorMessageKeys.variation.unsupportedSchema)
    : routeStatus === "invalid-schema"
      ? t(simulatorMessageKeys.variation.invalidSchema)
      : null;

  return (
    <section
      className="scene-variation-controls"
      aria-label={t(simulatorMessageKeys.variation.groupLabel)}
      data-testid="scene-variation-controls"
      data-active-seed={identity?.seed}
      data-active-schema={identity?.schemaVersion}
    >
      {identity ? (
        <>
          <p className="scene-variation-controls__identity">
            {t(simulatorMessageKeys.variation.activeSeed, {
              seed: identity.seed,
              version: identity.schemaVersion,
            })}
          </p>
          <button
            type="button"
            className="btn btn--compact"
            onClick={() => {
              setCopyStatus("idle");
              regenerate();
            }}
          >
            {t(simulatorMessageKeys.variation.regenerate)}
          </button>
          <button
            type="button"
            className="btn btn--compact btn--ghost"
            onClick={() => void copyShareUrl()}
          >
            {t(simulatorMessageKeys.variation.copyUrl)}
          </button>
          {copyStatus !== "idle" ? (
            <span className="scene-variation-controls__feedback" role="status">
              {copyStatus === "copied"
                ? t(simulatorMessageKeys.variation.copied)
                : t(simulatorMessageKeys.variation.copyFailed)}
            </span>
          ) : null}
        </>
      ) : statusMessage ? (
        <p className="scene-variation-controls__feedback" role="status">{statusMessage}</p>
      ) : null}
    </section>
  );
};
