import { expect, test, type Locator, type Page } from "@playwright/test";

const paneRtt = (page: Page, channel: "camera-movement-original" | "camera-movement-current") =>
  page.locator(`[data-testid="ground-glass-rtt"][data-rtt-channel="${channel}"]`);

const assertPaneContentful = async (pane: Locator) => {
  await expect(pane).toBeVisible({ timeout: 15_000 });
  await expect(pane).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15_000 });
  await expect(pane).toHaveAttribute("data-rtt-uniforms-finite", "true", { timeout: 5_000 });
  await expect(pane).toHaveAttribute("data-rtt-raw-contentful", "true", { timeout: 15_000 });
  await expect(pane).toHaveAttribute("data-rtt-final-contentful", "true", { timeout: 15_000 });
}

const assertComparisonContentful = async (page: Page) => {
  await expect(page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel^="camera-movement-"]')).toHaveCount(2);
  await assertPaneContentful(paneRtt(page, "camera-movement-original"));
  await assertPaneContentful(paneRtt(page, "camera-movement-current"));
};

test("public camera-movement Ground Glass compares neutral and current through stable RTT channels", async ({ page }) => {
  test.setTimeout(150_000);
  const pageErrors: string[] = [];
  const graphicsErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (!["warning", "error"].includes(message.type())) return;
    const text = message.text();
    if (!/(WebGL|THREE|GPU)/i.test(text) || /GPU stall due to ReadPixels/i.test(text)) return;
    graphicsErrors.push(`${message.type()}: ${text}`);
  });

  await page.goto("/simulator/free/understanding-camera-movements?rttDiagnostics=1");
  await expect(page.getByText("Compare the neutral camera with the selected movement.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ground Glass", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Original", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current", exact: true })).toBeVisible();
  await expect(page.getByText("Neutral · No camera movements", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Original and Current Ground Glass comparison").getByText("Neutral · No movement", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "Raw Ground Glass" })).toHaveCount(1);
  await expect(page.getByRole("radio", { name: "Upright Assist" })).toHaveCount(1);

  await assertComparisonContentful(page);
  const original = paneRtt(page, "camera-movement-original");
  const current = paneRtt(page, "camera-movement-current");
  const geometryId = await original.getAttribute("data-rtt-lattice-geometry-id");
  const originalGeneration = await original.getAttribute("data-rtt-resource-generation");
  const originalSubjectGeneration = await original.getAttribute("data-rtt-lattice-subject-generation");
  const currentGeneration = await current.getAttribute("data-rtt-resource-generation");
  const currentSubjectGeneration = await current.getAttribute("data-rtt-lattice-subject-generation");
  expect(geometryId).toBeTruthy();
  expect(originalGeneration).toBeTruthy();
  expect(originalSubjectGeneration).toBeTruthy();
  expect(currentGeneration).toBeTruthy();
  expect(currentSubjectGeneration).toBeTruthy();
  await expect(original).toHaveAttribute("data-rtt-lattice-geometry-id", geometryId!);
  await expect(current).toHaveAttribute("data-rtt-lattice-geometry-id", geometryId!);
  await expect(original).toHaveAttribute("data-rtt-lattice-edge-count", "224");
  await expect(current).toHaveAttribute("data-rtt-lattice-edge-count", "224");
  await expect(original).toHaveAttribute("data-rtt-lattice-target-region", "middle");
  await expect(current).toHaveAttribute("data-rtt-lattice-target-region", "middle");

  // The shared lattice/resource assertions above do not prove that the two RTT
  // cameras are driven by different physical states.  Capture the neutral
  // poses and require Original to remain neutral while representative movement
  // cases change Current.  Rear tilt, rise, and viewpoint placement are used
  // because each changes the rendered camera extrinsics in the canonical model.
  const poseAttributes = ["data-rtt-camera-position", "data-rtt-camera-up", "data-rtt-camera-forward"] as const;
  const neutralOriginalPose = Object.fromEntries(
    await Promise.all(poseAttributes.map(async (attribute) => [attribute, await original.getAttribute(attribute)] as const)),
  );
  const neutralCurrentPose = Object.fromEntries(
    await Promise.all(poseAttributes.map(async (attribute) => [attribute, await current.getAttribute(attribute)] as const)),
  );
  for (const attribute of poseAttributes) {
    expect(neutralOriginalPose[attribute]).toBeTruthy();
    expect(neutralCurrentPose[attribute]).toBeTruthy();
    expect(neutralOriginalPose[attribute]).toBe(neutralCurrentPose[attribute]);
  }

  const assertOriginalNeutralAndCurrentChanged = async (label: string) => {
    await page.getByRole("radio", { name: label }).click();
    await expect(page.getByRole("radio", { name: label })).toBeChecked();
    for (const attribute of poseAttributes) {
      await expect(original).toHaveAttribute(attribute, neutralOriginalPose[attribute]!);
    }
    await expect
      .poll(async () => {
        const values = await Promise.all(poseAttributes.map((attribute) => current.getAttribute(attribute)));
        return values.some((value, index) => value !== neutralCurrentPose[poseAttributes[index]]);
      })
      .toBe(true);
  };

  await assertOriginalNeutralAndCurrentChanged("B — Rear tilt");
  await assertOriginalNeutralAndCurrentChanged("C1 — Front rise");
  await assertOriginalNeutralAndCurrentChanged("C3 — Higher viewpoint");

  for (const label of [
    "A — Front tilt",
    "B — Rear tilt",
    "C1 — Front rise",
    "C2 — Rear rise",
    "C3 — Higher viewpoint",
    "D1 — Front fall",
    "D2 — Rear fall",
    "D3 — Lower viewpoint",
    "Neutral",
  ]) {
    await page.getByRole("radio", { name: label }).click();
    await expect(page.getByRole("radio", { name: label })).toBeChecked();
    const expectedRegion = label.includes("C3") ? "upper" : label.includes("D3") ? "lower" : "middle";
    await expect(original).toHaveAttribute("data-rtt-lattice-target-region", expectedRegion);
    await expect(current).toHaveAttribute("data-rtt-lattice-target-region", expectedRegion);
    await expect(original).toHaveAttribute("data-rtt-lattice-geometry-id", geometryId!);
    await expect(current).toHaveAttribute("data-rtt-lattice-geometry-id", geometryId!);
    await expect(original).toHaveAttribute("data-rtt-lattice-subject-generation", originalSubjectGeneration!);
    await expect(current).toHaveAttribute("data-rtt-lattice-subject-generation", currentSubjectGeneration!);
    await expect(original).toHaveAttribute("data-rtt-resource-generation", originalGeneration!);
    await expect(current).toHaveAttribute("data-rtt-resource-generation", currentGeneration!);
    await assertPaneContentful(original);
    await assertPaneContentful(current);
  }

  // Pane interactions remain independent and are not reset by case selection.
  const originalStage = page.getByRole("button", { name: "Zoom in Original Ground Glass view", exact: true });
  const currentStage = page.getByRole("button", { name: "Zoom in Current Ground Glass view", exact: true });
  await originalStage.click();
  await expect(page.getByRole("button", { name: "Reset Original Ground Glass view", exact: true })).toBeVisible();
  await expect(currentStage).toBeVisible();
  await page.getByRole("button", { name: "Reset Original Ground Glass view", exact: true }).click();
  await expect(page.getByRole("button", { name: "Zoom in Original Ground Glass view", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Expand Ground Glass" }).click();
  await expect(page.getByRole("heading", { name: "Original", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore Ground Glass" })).toBeVisible();
  await assertComparisonContentful(page);

  expect(pageErrors).toEqual([]);
  expect(graphicsErrors).toEqual([]);
});

test("calibration workbench keeps the existing single Ground Glass path", async ({ page }) => {
  await page.goto("/simulator/free/understanding-camera-movements?cameraCalibration=1&rttDiagnostics=1");
  await expect(page.getByRole("region", { name: "Camera movement calibration workbench" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Original", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Current", exact: true })).toHaveCount(0);
  await expect(page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel^="camera-movement-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="ground-glass-rtt"][data-rtt-channel="default"]')).toHaveAttribute("data-rtt-camera-ok", "true", { timeout: 15_000 });
});
