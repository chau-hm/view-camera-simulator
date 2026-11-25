import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import "../../../index.css";
import { AppShell } from "../../../components/layout/AppShell";
import { SimulatorWorkspace } from "../../../components/layout/SimulatorWorkspace";
import { SimulatorRoutePage } from "../../../app/pages";

const FIXTURE_PATH = "/src/tests/e2e/fixtures/architecture-rise-webgpu-validation.html";

const verificationNavigationStyle: React.CSSProperties = {
  position: "fixed",
  insetInlineEnd: 8,
  insetBlockEnd: 8,
  zIndex: 10_000,
  display: "flex",
  gap: 8,
  padding: 8,
  borderRadius: 6,
  background: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 1px 6px rgba(0, 0, 0, 0.25)",
};

export const ArchitectureRiseVerificationFixture = () => {
  useEffect(() => {
    document.body.setAttribute("data-fixture-ready", "true");
    return () => document.body.removeAttribute("data-fixture-ready");
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path={FIXTURE_PATH}
          element={(
            <AppShell title="" fullBleed>
              <nav aria-label="Verification navigation" style={verificationNavigationStyle}>
                <Link data-testid="verification-navigate-away" to="/simulator/free/view-camera-anatomy?rttDiagnostics=1">
                  Navigate to Anatomy
                </Link>
              </nav>
              <SimulatorWorkspace
                mode="free"
                sceneId="architecture-rise"
                taskId={null}
                simulateAssetFailure={false}
                developmentArchitectureRiseWebGpuVerification
              />
            </AppShell>
          )}
        />
        <Route
          path="/simulator/:mode/:sceneId"
          element={(
            <>
              <nav aria-label="Verification navigation" style={verificationNavigationStyle}>
                <Link data-testid="verification-return" to={`${FIXTURE_PATH}?rttDiagnostics=1`}>
                  Return to Architecture Rise verification
                </Link>
              </nav>
              <SimulatorRoutePage />
            </>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
};

const rootElement = document.getElementById("architecture-rise-webgpu-fixture");
if (!rootElement) throw new Error("Architecture Rise verification fixture root is missing");

createRoot(rootElement).render(
  <StrictMode>
    <ArchitectureRiseVerificationFixture />
  </StrictMode>,
);
