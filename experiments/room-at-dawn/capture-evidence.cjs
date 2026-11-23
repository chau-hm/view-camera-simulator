const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const out = path.resolve(process.argv[2] || "/private/tmp/room-optics-evidence");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const p = await b.newPage({ viewport: { width: 1200, height: 950 } });
  p.on("pageerror", (e) => console.log("pageerror", e.message));
  p.on("console", (m) => {
    if (m.type() === "error") console.log("error", m.text().slice(0, 400));
  });
  await p.goto(
    "http://127.0.0.1:5199/view-camera-simulator/experiments/room-at-dawn/optics.html?rttDiagnostics=1",
  );
  await p.waitForFunction("window.__roomOptics?.ready || window.__roomOptics?.error", null, {
    timeout: 240000,
  });
  await p.waitForTimeout(5000);
  async function snap(name) {
    let x = await p.evaluate(() => ({
      camera: window.__roomOptics.camera,
      lens: window.__roomOptics.optics.lensCenterWorld,
      focus: window.__roomOptics.optics.focusPlane,
      info: window.__roomOptics.info,
      gi: window.__giReport,
    }));
    console.log(name, JSON.stringify(x));
    await p
      .locator("canvas")
      .nth(1)
      .screenshot({ path: `${out}/room-current-${name}.png`, timeout: 120000 });
  }
  await snap("neutral");
  await p.getByLabel("Focus (mm)").fill("800");
  await p.waitForTimeout(4000);
  await snap("focus-near");
  await p.getByLabel("Focus (mm)").fill("3500");
  await p.waitForTimeout(4000);
  await snap("focus-far");
  await p.getByLabel("Aperture").selectOption("22");
  await p.waitForTimeout(4000);
  await snap("stopped");
  await p.getByLabel("Focus (mm)").fill("2000");
  await p.getByLabel("Aperture").selectOption("5.6");
  await p.getByLabel("Camera lateral position (mm)").fill("500");
  await p.waitForTimeout(4000);
  await snap("lateral");
  await p.getByLabel("Rise (mm)").fill("30");
  await p.getByLabel("Shift (mm)").fill("40");
  await p.getByLabel("Tilt (degrees)").fill("5");
  await p.getByLabel("Swing (degrees)").fill("5");
  await p.waitForTimeout(4000);
  await snap("combined");
  await p.getByRole("button", { name: "Toggle Raw/Upright" }).click();
  await p.waitForTimeout(3000);
  await snap("raw");
  await p.getByRole("button", { name: "Unmount views" }).click();
  console.log("unmounted canvases", await p.locator("canvas").count());
  await p.getByRole("button", { name: "Remount views" }).click();
  await p.waitForTimeout(5000);
  await snap("remount");
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
