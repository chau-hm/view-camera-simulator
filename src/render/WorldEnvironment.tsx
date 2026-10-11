import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { WorldProceduralSkyGroundEnvironment } from "./worldIlluminationContract";
import {
  createObserverWorldEnvironmentRig,
  UnsupportedObserverEnvironmentRendererError,
  type ObserverWorldEnvironmentStatus,
} from "./observerWorldEnvironmentRig";
import { disposeWorldEnvironmentRig, type WorldEnvironmentRig } from "./worldEnvironmentRig";

export const WorldEnvironment = ({
  environment,
  mountGeneration,
  onStatusChange,
}: {
  environment: WorldProceduralSkyGroundEnvironment;
  mountGeneration: number;
  onStatusChange?: (
    generation: number,
    status: ObserverWorldEnvironmentStatus,
  ) => void;
}) => {
  const { gl, scene } = useThree();

  useLayoutEffect(() => {
    let current = true;
    let rig: WorldEnvironmentRig | null = null;
    const isCurrent = () => current;
    const reportFailure = (error: unknown) => {
      if (!current) return;
      const status = error instanceof UnsupportedObserverEnvironmentRendererError
        ? "unsupported"
        : "failed";
      onStatusChange?.(mountGeneration, status);
      console.error("Observer world environment initialization failed", error);
    };
    onStatusChange?.(mountGeneration, "pending");

    try {
      const result = createObserverWorldEnvironmentRig(scene, gl, environment, isCurrent);
      if (result instanceof Promise) {
        void result
          .then((createdRig) => {
            if (!current) {
              if (createdRig) disposeWorldEnvironmentRig(scene, createdRig);
              return;
            }
            if (!createdRig) return;
            rig = createdRig;
            onStatusChange?.(mountGeneration, "active");
          })
          .catch(reportFailure);
      } else if (result) {
        rig = result;
        onStatusChange?.(mountGeneration, "active");
      }
    } catch (error) {
      reportFailure(error);
    }

    return () => {
      current = false;
      if (rig) disposeWorldEnvironmentRig(scene, rig);
    };
  }, [environment, gl, mountGeneration, onStatusChange, scene]);

  return null;
};
