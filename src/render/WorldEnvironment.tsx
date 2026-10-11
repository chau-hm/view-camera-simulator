import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { WorldProceduralSkyGroundEnvironment } from "./worldIlluminationContract";
import {
  createObserverWorldEnvironmentRig,
  UnsupportedObserverEnvironmentRendererError,
} from "./observerWorldEnvironmentRig";
import type {
  ObserverWorldEnvironmentRealizationToken,
  ObserverWorldEnvironmentStatus,
} from "./observerWorldEnvironmentStatus";
import { disposeWorldEnvironmentRig, type WorldEnvironmentRig } from "./worldEnvironmentRig";

export const WorldEnvironment = ({
  environment,
  mountGeneration,
  createRealizationToken,
  onStatusChange,
}: {
  environment: WorldProceduralSkyGroundEnvironment;
  mountGeneration: number;
  createRealizationToken: (
    rendererGeneration: number,
  ) => ObserverWorldEnvironmentRealizationToken;
  onStatusChange?: (
    generation: number,
    realization: ObserverWorldEnvironmentRealizationToken,
    status: ObserverWorldEnvironmentStatus,
  ) => void;
}) => {
  const { gl, scene } = useThree();

  useLayoutEffect(() => {
    let current = true;
    let rig: WorldEnvironmentRig | null = null;
    const realization = createRealizationToken(mountGeneration);
    const isCurrent = () => current;
    const reportFailure = (error: unknown) => {
      if (!current) return;
      const status = error instanceof UnsupportedObserverEnvironmentRendererError
        ? "unsupported"
        : "failed";
      onStatusChange?.(mountGeneration, realization, status);
      console.error("Observer world environment initialization failed", error);
    };
    onStatusChange?.(mountGeneration, realization, "pending");

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
            onStatusChange?.(mountGeneration, realization, "active");
          })
          .catch(reportFailure);
      } else if (result) {
        rig = result;
        onStatusChange?.(mountGeneration, realization, "active");
      }
    } catch (error) {
      reportFailure(error);
    }

    return () => {
      current = false;
      if (rig) disposeWorldEnvironmentRig(scene, rig);
    };
  }, [createRealizationToken, environment, gl, mountGeneration, onStatusChange, scene]);

  return null;
};
