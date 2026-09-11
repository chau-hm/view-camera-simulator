import type { ConsoleMessage } from "@playwright/test";

/**
 * Fiber 9.6.1 constructs THREE.Clock internally; stable 9.7.0 still does too:
 * https://github.com/pmndrs/react-three-fiber/blob/v9.7.0/packages/fiber/src/core/store.ts
 * r185 retains Clock but warns at construction. Keep this warning visible in
 * the browser; exempt only its exact warning text from renderer-error checks.
 * Remove this exception when a stable Fiber release migrates its clock.
 */
export const isKnownFiberClockDeprecation = (
  message: Pick<ConsoleMessage, "type" | "text">,
): boolean =>
  message.type() === "warning" &&
  message.text() === "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.";
