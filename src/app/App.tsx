import { RouterProvider } from "react-router-dom";
import { AppProviders } from "./providers";
import { router } from "./router";

export const App = () => (
  <AppProviders>
    <RouterProvider router={router} />
  </AppProviders>
);
