import { useMemo } from "react";
import { resolveSceneWorldIllumination } from "../scenes/illumination/sceneWorldIllumination";
import { worldIlluminationPointToWorld } from "./worldIlluminationContract";

export const WorldIllumination = ({ sceneId }: { sceneId: string }) => {
  const illumination = useMemo(
    () => resolveSceneWorldIllumination(sceneId),
    [sceneId],
  );

  return (
    <>
      {illumination.sources.map((source) => {
        if (source.kind !== "point") return null;
        const light = worldIlluminationPointToWorld(source);
        return (
          <pointLight
            key={source.id}
            name={source.id}
            color={light.color}
            intensity={light.intensity}
            distance={light.distance}
            decay={light.decay}
            castShadow={light.castShadow}
            position={light.position}
          />
        );
      })}
    </>
  );
};
