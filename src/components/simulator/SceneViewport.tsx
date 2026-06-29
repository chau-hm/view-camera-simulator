import { useMemo, useState } from "react";
import { SceneRenderer } from "../../render/SceneRenderer";
import { isWebGLAvailable } from "../../utils/webgl";
import type { UiErrorState } from "../../types/ui";
import type { SceneDefinition } from "../../types/scene";

type SceneViewportProps = {
  scene: SceneDefinition;
  simulateAssetFailure: boolean;
};

export const SceneViewport = ({ scene, simulateAssetFailure }: SceneViewportProps) => {
  const [attempt, setAttempt] = useState(0);
  const [assetError, setAssetError] = useState<UiErrorState | null>(null);
  const webglAvailable = useMemo(() => isWebGLAvailable(), []);

  if (!webglAvailable) {
    return (
      <section>
        <h2>3D Scene</h2>
        <p>WebGL is unavailable in this browser. Please use a WebGL-capable browser on desktop.</p>
      </section>
    );
  }

  if (assetError) {
    return (
      <section>
        <h2>3D Scene</h2>
        <p>{assetError.message}</p>
        <button
          type="button"
          onClick={() => {
            setAssetError(null);
            setAttempt((value) => value + 1);
          }}
        >
          Retry loading scene
        </button>
      </section>
    );
  }

  return (
    <section>
      <h2>3D Scene</h2>
      <SceneRenderer
        scene={scene}
        attempt={attempt}
        simulateAssetFailure={simulateAssetFailure}
        onAssetError={(message) => setAssetError({ title: "Scene load failed", message })}
      />
    </section>
  );
};
