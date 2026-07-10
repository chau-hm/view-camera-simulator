import { Navigate, createBrowserRouter } from "react-router-dom";
import { HomePage, NotFoundPage, ResultPage, SimulatorRoutePage, ScenesPage } from "./pages";
import { ModeRedirect } from "./ModeRedirect";

export const routes = [
  { path: "/", element: <HomePage /> },
  { path: "/mode", element: <ModeRedirect /> },
  { path: "/scenes", element: <ScenesPage /> },
  { path: "/simulator/:mode/:sceneId", element: <SimulatorRoutePage /> },
  { path: "/simulator/:mode/:sceneId/:taskId", element: <SimulatorRoutePage /> },
  { path: "/result/:taskId?", element: <ResultPage /> },
  { path: "/not-found", element: <NotFoundPage /> },
  { path: "*", element: <Navigate to="/not-found" replace /> },
];

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

export const router = createBrowserRouter(routes, {
  basename: basename || "/",
});
