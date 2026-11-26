import { expect, test } from "@playwright/test";

test("Pages payload serves assets and its fallback supports a direct deep link", async ({ page, request }) => {
  const missing: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400 && /\/assets\//.test(response.url())) missing.push(response.url());
  });
  const base = "/view-camera-simulator/";
  const index = await request.get(base);
  const fallback = await request.get(`${base}404.html`);
  expect(fallback.status()).toBe(200);
  expect(await fallback.body()).toEqual(await index.body());
  const response = await page.goto(`${base}simulator/free/architecture-rise`);
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("scene-canvas")).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  await page.reload();
  await expect(page.getByTestId("scene-canvas")).toHaveAttribute("data-observer-renderer-status", "active", { timeout: 60_000 });
  expect(missing).toEqual([]);
});
