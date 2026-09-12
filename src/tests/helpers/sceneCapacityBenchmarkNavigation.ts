export type MeasurementNavigationObservation = {
  isMainFrame: boolean;
  url: string;
};

export type MeasurementNavigationState = {
  rawDebug: boolean;
  inspectionWindowActive: boolean;
};

export const createMeasurementNavigationGuard = (
  sceneId: string,
  state: MeasurementNavigationState,
) => {
  let unexpectedNavigationUrl: string | null = null;

  const assertStable = (): void => {
    if (unexpectedNavigationUrl === null) return;
    throw new Error(
      "Scene capacity benchmark navigated during an active measurement: " +
        `scene=${sceneId} rawDebug=${state.rawDebug} ` +
        `inspectionWindowActive=${state.inspectionWindowActive} ` +
        `url=${unexpectedNavigationUrl}`,
    );
  };

  return {
    observeNavigation: ({ isMainFrame, url }: MeasurementNavigationObservation): void => {
      if (isMainFrame && unexpectedNavigationUrl === null) {
        unexpectedNavigationUrl = url;
      }
    },
    assertStable,
  };
};
