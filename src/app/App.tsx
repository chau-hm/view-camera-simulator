import { RouterProvider } from "react-router-dom";
import { AppProviders } from "./providers";
import { router } from "./router";
import { AppErrorBoundary } from "../components/system/AppErrorBoundary";
import { GroundGlassRenderHostStateProvider } from "../render/GroundGlassRenderHost";

export const App = () => (
  <AppErrorBoundary>
    <AppProviders>
      <GroundGlassRenderHostStateProvider>
        <RouterProvider router={router} />
      </GroundGlassRenderHostStateProvider>
    </AppProviders>
  </AppErrorBoundary>
);
