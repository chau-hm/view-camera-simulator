import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { WorldProceduralSkyGroundEnvironment } from "./worldIlluminationContract";
import {
  createWorldEnvironmentRig,
  disposeWorldEnvironmentRig,
} from "./worldEnvironmentRig";

export const WorldEnvironment = ({
  environment,
}: {
  environment: WorldProceduralSkyGroundEnvironment;
}) => {
  const { gl, scene } = useThree();

  useLayoutEffect(() => {
    const rig = createWorldEnvironmentRig(scene, gl, environment);
    return () => disposeWorldEnvironmentRig(scene, rig);
  }, [environment, gl, scene]);

  return null;
};
