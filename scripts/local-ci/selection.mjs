import path from "node:path";

const knownModes = new Set(["full", "focused", "affected", "core"]);

const nativeWebGpuAssertionBySpec = new Map([
  ["src/tests/e2e/architecture-rise-webgpu-validation.spec.ts", "OBSERVER_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-aperture-gather-app.spec.ts", "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-aperture-gather.spec.ts", "OBSERVER_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-b1-optical-validation.spec.ts", "OBSERVER_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-coc-footprint.spec.ts", "OBSERVER_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-correspondence-large-coc.spec.ts", "OBSERVER_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-failure-host.spec.ts", "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-far-reconstruction-i.spec.ts", "OBSERVER_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-far-reconstruction.spec.ts", "OBSERVER_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-gather-quality.spec.ts", "OBSERVER_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-host.spec.ts", "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-interior-coc-quality.spec.ts", "OBSERVER_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-m6-presentation.spec.ts", "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-m6b-conformance.spec.ts", "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-m6c-alpha.spec.ts", "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-m7g-lifecycle.spec.ts", "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-physical-coc-app.spec.ts", "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-physical-coc.spec.ts", "OBSERVER_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts", "OBSERVER_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/ground-glass-webgpu-r187-app-pilot.spec.ts", "GROUND_GLASS_NATIVE_WEBGPU_REQUIRED"],
  ["src/tests/e2e/observer-webgpu-pilot.spec.ts", "OBSERVER_NATIVE_WEBGPU_REQUIRED"],
]);

const splitList = (value) => value.split(",").map((entry) => entry.trim()).filter(Boolean);

export function nativeWebGpuAssertionForSpec(spec) {
  const environmentKey = nativeWebGpuAssertionBySpec.get(spec);
  return environmentKey ? { environmentKey, requiredValue: "1" } : null;
}

export function parseLocalCiArgs(argv) {
  const options = {
    mode: "full",
    base: "origin/main",
    tests: [],
    owners: [],
    e2eSpecs: [],
    includeE2E: false,
    productionPreview: false,
    nativeWebGpu: false,
    workers: null,
    verbose: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const takeValue = (name) => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
      index += 1;
      return value;
    };

    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--verbose") options.verbose = true;
    else if (argument === "--with-e2e") options.includeE2E = true;
    else if (argument === "--production-preview") options.productionPreview = true;
    else if (argument === "--native-webgpu") options.nativeWebGpu = true;
    else if (argument === "--mode") options.mode = takeValue(argument);
    else if (argument.startsWith("--mode=")) options.mode = argument.slice("--mode=".length);
    else if (argument === "--base") options.base = takeValue(argument);
    else if (argument.startsWith("--base=")) options.base = argument.slice("--base=".length);
    else if (argument === "--tests") options.tests.push(...splitList(takeValue(argument)));
    else if (argument.startsWith("--tests=")) options.tests.push(...splitList(argument.slice("--tests=".length)));
    else if (argument === "--owner") options.owners.push(...splitList(takeValue(argument)));
    else if (argument.startsWith("--owner=")) options.owners.push(...splitList(argument.slice("--owner=".length)));
    else if (argument === "--e2e-spec") options.e2eSpecs.push(...splitList(takeValue(argument)));
    else if (argument.startsWith("--e2e-spec=")) options.e2eSpecs.push(...splitList(argument.slice("--e2e-spec=".length)));
    else if (argument === "--workers") options.workers = takeValue(argument);
    else if (argument.startsWith("--workers=")) options.workers = argument.slice("--workers=".length);
    else throw new Error(`Unknown option: ${argument}`);
  }

  if (!knownModes.has(options.mode)) throw new Error(`Unknown mode: ${options.mode}`);
  if (options.workers !== null && (!/^\d+$/.test(options.workers) || Number(options.workers) < 1)) {
    throw new Error("--workers must be a positive integer");
  }
  if (options.mode === "focused" && options.tests.length === 0 && options.owners.length === 0 && options.e2eSpecs.length === 0) {
    throw new Error("Focused mode needs --tests, --owner, or --e2e-spec");
  }
  if (options.mode === "focused" && options.includeE2E && options.e2eSpecs.length === 0 && options.owners.length === 0) {
    throw new Error("Focused --with-e2e needs an owner or an explicit --e2e-spec");
  }
  if (options.productionPreview && options.nativeWebGpu) {
    throw new Error("Production-preview and native-WebGPU qualification are separate modes");
  }
  if ((options.productionPreview || options.nativeWebGpu) && options.e2eSpecs.length === 0) {
    throw new Error("Specialized browser qualification needs an explicit --e2e-spec");
  }
  if (options.mode === "core" && options.owners.length > 0) {
    throw new Error("Core mode uses the checked-in candidate manifest; use focused mode for owners");
  }

  options.tests = [...new Set(options.tests)];
  options.owners = [...new Set(options.owners)];
  options.e2eSpecs = [...new Set(options.e2eSpecs)];
  return options;
}

export function matchesOwnerPath(filePath, pattern) {
  const fileSegments = filePath.split("/");
  const patternSegments = pattern.split("/");
  const segmentMatches = (fileSegment, patternSegment) => {
    const expression = patternSegment
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${expression}$`).test(fileSegment);
  };
  const match = (patternIndex, fileIndex) => {
    if (patternIndex === patternSegments.length) return fileIndex === fileSegments.length;
    if (patternSegments[patternIndex] === "**") {
      if (patternIndex === patternSegments.length - 1) return true;
      for (let nextFileIndex = fileIndex; nextFileIndex <= fileSegments.length; nextFileIndex += 1) {
        if (match(patternIndex + 1, nextFileIndex)) return true;
      }
      return false;
    }
    return fileIndex < fileSegments.length &&
      segmentMatches(fileSegments[fileIndex], patternSegments[patternIndex]) &&
      match(patternIndex + 1, fileIndex + 1);
  };
  return match(0, 0);
}

export function resolveOwnerSelection(changedPaths, owners, pathExists) {
  const ownerIds = new Set();
  const tests = new Set();
  const e2eSpecs = new Set();
  const e2eOwnerIdsBySpec = new Map();
  const allDevelopmentE2EOwnerIds = new Set();
  const reasons = [];
  const unknownPaths = [];
  const provisionalPaths = [];
  const incompleteReasons = [];
  let fullVitest = false;
  let fullLocalCi = false;
  let allDevelopmentE2E = false;
  let nativeGpuRequired = false;
  let requiresE2E = false;

  for (const changedPath of changedPaths) {
    const matches = owners.filter((owner) => owner.paths.some((pattern) => matchesOwnerPath(changedPath, pattern)));
    if (matches.length === 0) {
      unknownPaths.push(changedPath);
      continue;
    }

    const completeMatches = matches.filter((owner) => owner.coverage !== "provisional");
    const provisionalMatches = matches.filter((owner) => owner.coverage === "provisional");
    if (provisionalMatches.length > 0 && completeMatches.length === 0) {
      provisionalPaths.push(changedPath);
      fullVitest = true;
      for (const owner of provisionalMatches) {
        const reason = `Only provisional ownership matched. ${owner.reason} Full Vitest was selected; affected coverage remains incomplete until a direct owner is established.`;
        incompleteReasons.push({ path: changedPath, owner: owner.id, reason });
        reasons.push({ path: changedPath, owner: owner.id, reason });
      }
    }

    for (const owner of matches) {
      ownerIds.add(owner.id);
      reasons.push({ path: changedPath, owner: owner.id, reason: owner.reason });
      if (owner.incompleteReason) {
        incompleteReasons.push({ path: changedPath, owner: owner.id, reason: owner.incompleteReason });
        reasons.push({ path: changedPath, owner: owner.id, reason: owner.incompleteReason });
      }
      for (const testPath of owner.tests ?? []) tests.add(testPath);
      for (const specPath of owner.e2eSpecs ?? []) {
        e2eSpecs.add(specPath);
        const specOwners = e2eOwnerIdsBySpec.get(specPath) ?? new Set();
        specOwners.add(owner.id);
        e2eOwnerIdsBySpec.set(specPath, specOwners);
      }
      fullVitest ||= owner.fullVitest === true;
      fullLocalCi ||= owner.fullLocalCi === true;
      allDevelopmentE2E ||= owner.allDevelopmentE2E === true;
      nativeGpuRequired ||= owner.nativeGpuRequired === true;
      requiresE2E ||= owner.requiresE2E === true;
    }

    if (/^src\/tests\/e2e\/[^/]+\.spec\.ts$/.test(changedPath)) {
      e2eSpecs.add(changedPath);
      requiresE2E = true;
      const specOwners = e2eOwnerIdsBySpec.get(changedPath) ?? new Set();
      for (const owner of matches) specOwners.add(owner.id);
      e2eOwnerIdsBySpec.set(changedPath, specOwners);
    } else if (changedPath.startsWith("src/tests/e2e/")) {
      allDevelopmentE2E = true;
      requiresE2E = true;
      for (const owner of matches) allDevelopmentE2EOwnerIds.add(owner.id);
    }
  }

  const staleTests = [...tests].filter((testPath) => !pathExists(testPath));
  const staleSpecs = [...e2eSpecs].filter((specPath) => !pathExists(specPath));
  if (staleTests.length > 0 || staleSpecs.length > 0) {
    fullVitest = true;
    reasons.push({ path: "owner-manifest", owner: "stale-owner-reference", reason: "Missing mapped test path; full Vitest fallback selected." });
  }
  if (unknownPaths.length > 0) {
    fullVitest = true;
    reasons.push({ path: unknownPaths.join(", "), owner: "unmapped-change", reason: "Unknown ownership; full Vitest fallback selected and affected result remains incomplete." });
  }
  if (fullVitest) tests.clear();

  return {
    ownerIds: [...ownerIds].sort(),
    tests: [...tests].sort(),
    e2eSpecs: [...e2eSpecs].sort(),
    e2eRequirements: [...e2eSpecs].sort().map((file) => ({ file, ownerIds: [...(e2eOwnerIdsBySpec.get(file) ?? [])].sort() })),
    allDevelopmentE2EOwnerIds: [...allDevelopmentE2EOwnerIds].sort(),
    reasons,
    unknownPaths,
    provisionalPaths,
    staleTests,
    staleSpecs,
    incompleteReasons,
    fullVitest,
    fullLocalCi,
    allDevelopmentE2E,
    nativeGpuRequired,
    requiresE2E,
    incomplete: unknownPaths.length > 0 || staleTests.length > 0 || staleSpecs.length > 0 || incompleteReasons.length > 0,
  };
}

export function validateSelectedTestPaths(testPaths, exists, isVitestPath) {
  const invalid = testPaths.filter((testPath) => !exists(testPath) || !isVitestPath(testPath));
  return { valid: invalid.length === 0, invalid };
}

export function parseVitestJsonReport(report) {
  const integerFields = [
    "numTotalTestSuites",
    "numPassedTestSuites",
    "numFailedTestSuites",
    "numPendingTestSuites",
    "numTotalTests",
    "numPassedTests",
    "numFailedTests",
    "numPendingTests",
    "numTodoTests",
  ];
  if (!report || typeof report !== "object" || !Array.isArray(report.testResults)) {
    throw new Error("Vitest JSON report is missing testResults");
  }
  for (const field of integerFields) {
    if (!Number.isInteger(report[field]) || report[field] < 0) {
      throw new Error(`Vitest JSON report has no reliable ${field}`);
    }
  }
  if (typeof report.success !== "boolean") throw new Error("Vitest JSON report is missing success status");
  if (report.numTotalTests === 0 || report.numTotalTestSuites === 0 || report.testResults.length === 0) throw new Error("Vitest collected no tests");
  if (report.numTotalTestSuites !== report.numPassedTestSuites + report.numFailedTestSuites + report.numPendingTestSuites) {
    throw new Error("Vitest JSON report has inconsistent suite totals");
  }
  if (report.success && report.numFailedTestSuites > 0) throw new Error("Vitest JSON report success contradicts failed suites");
  if (report.numTotalTests !== report.numPassedTests + report.numFailedTests + report.numPendingTests + report.numTodoTests) {
    throw new Error("Vitest JSON report has inconsistent test totals");
  }
  if (report.testResults.some((result) => !result || typeof result.name !== "string" || result.name.length === 0)) {
    throw new Error("Vitest JSON report has test results without file paths");
  }
  const files = report.testResults.map((result) => result.name);
  if (new Set(files).size !== files.length) throw new Error("Vitest JSON report contains duplicate test file paths");

  return {
    discoveredFiles: report.testResults.length,
    discoveredSuites: report.numTotalTestSuites,
    discoveredCases: report.numTotalTests,
    executedCases: report.numPassedTests + report.numFailedTests,
    passed: report.numPassedTests,
    failed: report.numFailedTests,
    skipped: report.numPendingTests,
    todo: report.numTodoTests,
    success: report.success,
    files,
  };
}

export function compareTestFileSelection(selectedFiles, discoveredFiles, repositoryRoot, { matchBasenames = false } = {}) {
  const toRepositoryPath = (filePath) => {
    if (matchBasenames) return path.posix.basename(filePath.replaceAll("\\", "/"));
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(repositoryRoot, filePath);
    const relativePath = path.relative(repositoryRoot, absolutePath);
    return relativePath === ".." || relativePath.startsWith(`..${path.sep}`)
      ? "OUTSIDE_REPOSITORY"
      : relativePath.split(path.sep).join("/");
  };
  const expected = new Set(selectedFiles.map(toRepositoryPath));
  const discovered = new Set(discoveredFiles.map(toRepositoryPath));
  const missing = [...expected].filter((filePath) => !discovered.has(filePath)).sort();
  const extra = [...discovered].filter((filePath) => !expected.has(filePath)).sort();
  return { matches: missing.length === 0 && extra.length === 0, missing, extra };
}

export function parsePlaywrightJsonReport(report, repositoryRoot = process.cwd()) {
  const stats = report?.stats;
  if (!stats || !Number.isInteger(stats.expected) || !Number.isInteger(stats.skipped) || !Number.isInteger(stats.unexpected) || !Number.isInteger(stats.flaky)) {
    throw new Error("Playwright JSON report is missing reliable stats");
  }
  const configFile = report?.config?.configFile;
  const rootDir = report?.config?.rootDir;
  if (typeof configFile !== "string" || configFile.length === 0 || typeof rootDir !== "string" || rootDir.length === 0) {
    throw new Error("Playwright JSON report is missing configuration identity");
  }
  const flaky = stats.flaky;
  const total = stats.expected + stats.skipped + stats.unexpected + flaky;
  if (total === 0) throw new Error("Playwright discovered no tests");
  const filePaths = new Set();
  const projectNames = new Set();
  const visitSuites = (suites) => {
    if (!Array.isArray(suites)) return;
    for (const suite of suites) {
      for (const spec of suite.specs ?? []) {
        if (typeof spec.file === "string") {
          const absolutePath = path.isAbsolute(spec.file) ? spec.file : path.resolve(rootDir, spec.file);
          const relativePath = path.relative(repositoryRoot, absolutePath);
          const repositoryPath = relativePath === ".." || relativePath.startsWith(`..${path.sep}`)
            ? "OUTSIDE_REPOSITORY"
            : relativePath.split(path.sep).join("/");
          filePaths.add(repositoryPath);
        }
        for (const test of spec.tests ?? []) {
          if (typeof test.projectName === "string" && test.projectName.length > 0) projectNames.add(test.projectName);
        }
      }
      visitSuites(suite.suites);
    }
  };
  visitSuites(report.suites);
  if (filePaths.size === 0) throw new Error("Playwright JSON report is missing discovered spec file paths");
  if (projectNames.size === 0) throw new Error("Playwright JSON report is missing actual project names");
  const absoluteConfig = path.isAbsolute(configFile) ? configFile : path.resolve(repositoryRoot, configFile);
  const relativeConfig = path.relative(repositoryRoot, absoluteConfig);
  const repositoryConfig = relativeConfig === ".." || relativeConfig.startsWith(`..${path.sep}`)
    ? "OUTSIDE_REPOSITORY"
    : relativeConfig.split(path.sep).join("/");
  return {
    discoveredFiles: filePaths.size,
    files: [...filePaths].sort(),
    configFile: repositoryConfig,
    projectNames: [...projectNames].sort(),
    discoveredCases: total,
    executedCases: total - stats.skipped,
    passed: stats.expected + flaky,
    failed: stats.unexpected,
    skipped: stats.skipped,
    flaky,
    durationMs: Number.isFinite(stats.duration) ? stats.duration : "NOT_MEASURED",
  };
}
