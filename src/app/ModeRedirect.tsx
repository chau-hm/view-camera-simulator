import { useEffect } from "react";
import { ScenesPage } from "./pages";

export const ModeRedirect = () => {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/scenes");
    }
  }, []);

  return <ScenesPage />;
};
