const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const a = fs.readFileSync(process.argv[2]).toString("base64"),
    b = fs.readFileSync(process.argv[3]).toString("base64");
  const browser = await chromium.launch({ headless: true });
  const p = await browser.newPage();
  const result = await p.evaluate(
    async ({ a, b, rotateSecond }) => {
      async function decode(x) {
        const bytes = Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const c = document.createElement("canvas");
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(bmp, 0, 0);
        return {
          width: c.width,
          height: c.height,
          data: ctx.getImageData(0, 0, c.width, c.height).data,
        };
      }
      const x = await decode(a),
        y = await decode(b);
      if (x.width !== y.width || x.height !== y.height) throw Error("dimensions mismatch");
      let sum = 0,
        max = 0,
        changed = 0;
      for (let i = 0; i < x.data.length; i += 4) {
        let d = 0;
        const j = rotateSecond ? y.data.length - 4 - i : i;
        for (let k = 0; k < 3; k++) d += Math.abs(x.data[i + k] - y.data[j + k]);
        sum += d;
        max = Math.max(max, d / 3);
        if (d > 6) changed++;
      }
      return {
        meanAbsoluteRgb8: sum / (x.width * x.height * 3),
        maximumMeanChannelDifference: max,
        changedPixelFraction: changed / (x.width * x.height),
        width: x.width,
        height: x.height,
        rotateSecond,
        meaning: "display-referred 8-bit screenshot difference; not linear radiance",
      };
    },
    { a, b, rotateSecond: process.argv.includes("--rotate-second") },
  );
  console.log(JSON.stringify(result));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
