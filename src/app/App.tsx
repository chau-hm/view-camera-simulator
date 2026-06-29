import { RouterProvider } from "react-router-dom";
import { AppProviders } from "./providers";
import { router } from "./router";
import { AppErrorBoundary } from "../components/system/AppErrorBoundary";

export const App = () => (
  <AppErrorBoundary>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </AppErrorBoundary>
);
