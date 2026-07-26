import { useAppStore } from "../../state/appStore";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { DEFAULT_SHOW_OPTICAL_GEOMETRY } from "../../state/sceneViewDefaults";

/**
 * Reset the Zustand store to a clean state before each test.
 * Prevents route-initialisation early-return from a repeated route key
 * and ensures no movement state leaks between tests.
 */
export function resetStoreForTest() {
  useAppStore.setState({
    camera: DEFAULT_CAMERA_STATE,
    scene: { activeSceneId: DEFAULT_CAMERA_STATE.activeSceneId },
    task: {
      activeTaskId: DEFAULT_CAMERA_STATE.activeTaskId,
      currentTaskEvaluation: null,
    },
    ui: {
      mode: DEFAULT_CAMERA_STATE.mode,
      geometryView: DEFAULT_CAMERA_STATE.geometryView,
      groundGlassAssistEnabled: DEFAULT_CAMERA_STATE.groundGlassAssistEnabled,
      focusAssistEnabled: DEFAULT_CAMERA_STATE.focusAssistEnabled,
      gridEnabled: DEFAULT_CAMERA_STATE.gridEnabled,
      showOpticalGeometry: DEFAULT_SHOW_OPTICAL_GEOMETRY,
    },
    selectedMovement: null,
    lastInitializedRouteKey: null,
    groundGlassRttRuntimeInfo: null,
  });
}
