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
import {
  disposeWorldEnvironmentRig,
  setWorldEnvironmentRigSuppressed,
  type WorldEnvironmentRig,
} from "./worldEnvironmentRig";

export const WorldEnvironment = ({
  environment,
  mountGeneration,
  createRealizationToken,
  onStatusChange,
  architectureRiseVerificationHarness = false,
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
  architectureRiseVerificationHarness?: boolean;
}) => {
  const { gl, scene } = useThree();

  useLayoutEffect(() => {
    let current = true;
    let rig: WorldEnvironmentRig | null = null;
    let requestedEnvironmentEnabled = true;
    const verificationContainer =
      import.meta.env.DEV &&
      architectureRiseVerificationHarness &&
      typeof window !== "undefined" &&
      window.location.pathname === "/src/tests/e2e/fixtures/architecture-rise-webgpu-validation.html"
        ? gl.domElement.closest<HTMLElement>(
            '[data-observer-verification-scene="architecture-rise"]',
          )
        : null;
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

    const syncVerificationEvidence = () => {
      if (!verificationContainer || !rig) return;
      verificationContainer.setAttribute("data-observer-test-environment-control", "ready");
      verificationContainer.setAttribute(
        "data-observer-test-environment-enabled",
        String(!rig.suppressed && scene.environment === rig.environmentTexture),
      );
      verificationContainer.setAttribute(
        "data-observer-test-environment-assigned",
        String(scene.environment === rig.environmentTexture),
      );
      verificationContainer.setAttribute(
        "data-observer-test-environment-intensity",
        String(scene.environmentIntensity),
      );
    };
    const setEnvironmentEnabled = (event: Event) => {
      const enabled = (event as CustomEvent<unknown>).detail;
      if (typeof enabled !== "boolean") return;
      requestedEnvironmentEnabled = enabled;
      if (rig) setWorldEnvironmentRigSuppressed(scene, rig, !enabled);
      syncVerificationEvidence();
    };
    if (verificationContainer) {
      verificationContainer.addEventListener(
        "vcs:observer-verification:architecture-rise-environment",
        setEnvironmentEnabled,
      );
    }

    const acceptRig = (createdRig: WorldEnvironmentRig | null) => {
      if (!createdRig) return;
      rig = createdRig;
      if (!requestedEnvironmentEnabled) {
        setWorldEnvironmentRigSuppressed(scene, createdRig, true);
      }
      syncVerificationEvidence();
      onStatusChange?.(mountGeneration, realization, "active");
    };

    try {
      const result = createObserverWorldEnvironmentRig(scene, gl, environment, isCurrent);
      if (result instanceof Promise) {
        void result
          .then((createdRig) => {
            if (!current) {
              if (createdRig) disposeWorldEnvironmentRig(scene, createdRig);
              return;
            }
            acceptRig(createdRig);
          })
          .catch(reportFailure);
      } else {
        acceptRig(result);
      }
    } catch (error) {
      reportFailure(error);
    }

    return () => {
      current = false;
      if (verificationContainer) {
        verificationContainer.removeEventListener(
          "vcs:observer-verification:architecture-rise-environment",
          setEnvironmentEnabled,
        );
        verificationContainer.removeAttribute("data-observer-test-environment-control");
        verificationContainer.removeAttribute("data-observer-test-environment-enabled");
        verificationContainer.removeAttribute("data-observer-test-environment-assigned");
        verificationContainer.removeAttribute("data-observer-test-environment-intensity");
      }
      if (rig) disposeWorldEnvironmentRig(scene, rig);
    };
  }, [
    architectureRiseVerificationHarness,
    createRealizationToken,
    environment,
    gl,
    mountGeneration,
    onStatusChange,
    scene,
  ]);

  return null;
};
