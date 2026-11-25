import { Navigate, createBrowserRouter } from "react-router-dom";
import type { RouteObject } from "react-router-dom";
import { lazy, Suspense } from "react";
import { FaqPage, HomePage, NotFoundPage, ResultPage, SimulatorRoutePage, ScenesPage } from "./pages";

export const routes: RouteObject[] = [
  { path: "/", element: <HomePage /> },
  { path: "/mode", element: <Navigate to="/scenes" replace /> },
  { path: "/scenes", element: <ScenesPage /> },
  { path: "/faq", element: <FaqPage /> },
  { path: "/simulator/:mode/:sceneId", element: <SimulatorRoutePage /> },
  { path: "/simulator/:mode/:sceneId/:taskId", element: <SimulatorRoutePage /> },
  { path: "/result/:taskId?", element: <ResultPage /> },
  { path: "/not-found", element: <NotFoundPage /> },
  { path: "*", element: <Navigate to="/not-found" replace /> },
];

if (import.meta.env.DEV) {
  const DevelopmentFringeClubPage = lazy(() =>
    import("./development/FringeClubDevelopmentPage").then((module) => ({
      default: module.FringeClubDevelopmentPage,
    })),
  );
  routes.splice(
    routes.length - 1,
    0,
    {
      path: "/__dev/fringe-club",
      element: (
        <Suspense fallback={<p>Loading development fixture…</p>}>
          <DevelopmentFringeClubPage />
        </Suspense>
      ),
    },
    {
      path: "/__dev/fringe-club-rtt",
      element: (
        <Suspense fallback={<p>Loading development fixture…</p>}>
          <DevelopmentFringeClubPage enableGroundGlass />
        </Suspense>
      ),
    },
  );
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

export const router = createBrowserRouter(routes, {
  basename: basename || "/",
});
