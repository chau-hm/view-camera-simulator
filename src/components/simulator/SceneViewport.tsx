import { useMemo, useState } from "react";
import { SceneRenderer } from "../../render/SceneRenderer";
import { isWebGLAvailable } from "../../utils/webgl";
import type { UiErrorState } from "../../types/ui";
import type { SceneDefinition } from "../../types/scene";
import { UI_COPY } from "../../ui/copy";

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
        <h2>{UI_COPY.simulator.sceneTitle}</h2>
        <p>{UI_COPY.simulator.webglUnavailable}</p>
      </section>
    );
  }

  if (assetError) {
    return (
      <section>
        <h2>{UI_COPY.simulator.sceneTitle}</h2>
        <p>{assetError.message}</p>
        <button
          type="button"
          onClick={() => {
            setAssetError(null);
            setAttempt((value) => value + 1);
          }}
        >
          {UI_COPY.simulator.retryLoadScene}
        </button>
      </section>
    );
  }

  return (
    <section>
      <h2>{UI_COPY.simulator.sceneTitle}</h2>
      <SceneRenderer
        scene={scene}
        attempt={attempt}
        simulateAssetFailure={simulateAssetFailure}
        onAssetError={(message) => setAssetError({ title: UI_COPY.simulator.sceneLoadFailed, message })}
      />
    </section>
  );
};
