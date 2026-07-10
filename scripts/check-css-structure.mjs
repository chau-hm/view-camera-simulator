import fs from "fs";
import path from "path";

const cssPath = path.resolve("./src/index.css");
const content = fs.readFileSync(cssPath, "utf8");

const openBraces = (content.match(/{/g) || []).length;
const closeBraces = (content.match(/}/g) || []).length;
const btnSecondaryMatches = (content.match(/\.btn--secondary\s*\{/g) || []).length;
const hasSiteShell = content.includes(".site-shell");

if (openBraces !== closeBraces) {
  console.error(`CSS structure error: unmatched braces: {=${openBraces} }=${closeBraces}`);
  process.exit(2);
}

if (btnSecondaryMatches !== 1) {
  console.error(
    `CSS structure error: expected exactly 1 ".btn--secondary {" rule, found ${btnSecondaryMatches}`,
  );
  process.exit(3);
}

if (!hasSiteShell) {
  console.error("CSS structure error: .site-shell selector not found");
  process.exit(4);
}

console.log("CSS structure check passed");
process.exit(0);
