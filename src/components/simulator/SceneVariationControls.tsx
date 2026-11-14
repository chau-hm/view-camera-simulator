import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SceneDefinition } from "../../types/scene";
import type { SceneVariantIdentity } from "../../types/sceneVariation";
import type { SceneVariantRouteResolution } from "../../app/sceneVariationRoute";
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
    if (!identity || typeof window === "undefined" || !navigator.clipboard?.writeText) {
      setCopyStatus("failed");
      return;
    }
    const shareUrl = new URL(
      `${location.pathname}${location.search}${location.hash}`,
      window.location.origin,
    ).toString();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }, [identity, location.hash, location.pathname, location.search]);

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
