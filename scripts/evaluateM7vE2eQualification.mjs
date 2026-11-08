import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const ts = require("typescript");

export const M7V_POLICY_REVISION = "m7v-e2e-skip-governance-v2";
export const M7V_SOURCE_DECLARATION_BASELINE_COMMIT = "6e236d2ef4f248bfd3ad081d8d1786a7c0f8f382";
export const M7V_REPOSITORY = "chau-hm/view-camera-simulator";
export const M7V_REPOSITORY_OWNER = "chau-hm";
export const M7V_RUNNER_WORKFLOW_PATH = ".github/workflows/m7v-lane-qualification.yml";
export const M7V_EXECUTION_ARTIFACT_ROOT = "docs/architecture/ground-glass-m7v-skip-governance/execution-artifacts";
export const M7V_LANES = [
  "ordinary-webgl",
  "renderer-serial",
  "native-webgpu",
  "research-development",
  "production-preview",
];
export const M7V_M7U_ADDITIONS = [
  "chromium::interior-corner-swing-focus.spec.ts::Interior Corner Swing keyboard steps update the public movement readout in both directions",
  "chromium::interior-corner-swing-focus.spec.ts::validated direct Swing input rejects inaccessible and off-grid targets",
];
export const M7V_CONFIGURED_BUILD_FLAGS_BY_ENV = {
  GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION: [
    { name: "VITE_GROUND_GLASS_WEBGPU_TEST_SEAM", value: "true" },
  ],
  GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH: [
    { name: "VITE_GROUND_GLASS_WEBGPU_TEST_SEAM", value: "true" },
    { name: "VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH", value: "true" },
  ],
  GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION: [
    { name: "VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION", value: "true" },
  ],
  GROUND_GLASS_WEBGPU_APERTURE_GATHER_RESEARCH: [
    { name: "VITE_GROUND_GLASS_WEBGPU_TEST_SEAM", value: "true" },
    { name: "VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH", value: "true" },
  ],
  GROUND_GLASS_WEBGPU_APERTURE_GATHER_R187_QUALIFICATION: [
    { name: "VITE_GROUND_GLASS_WEBGPU_TEST_SEAM", value: "true" },
    { name: "VITE_GROUND_GLASS_WEBGPU_APERTURE_GATHER_R187_QUALIFICATION", value: "true" },
  ],
  GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED: [
    { name: "VITE_GROUND_GLASS_WEBGPU_TEST_SEAM", value: "true" },
    { name: "VITE_GROUND_GLASS_WEBGPU_RAW_PILOT", value: "true" },
    { name: "VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION", value: "true" },
    { name: "VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH", value: "false" },
    { name: "VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH", value: "false" },
    { name: "VITE_GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION", value: "false" },
  ],
  GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED: [
    { name: "VITE_GROUND_GLASS_WEBGPU_TEST_SEAM", value: "true" },
    { name: "VITE_GROUND_GLASS_WEBGPU_RAW_PILOT", value: "true" },
    { name: "VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION", value: "true" },
    { name: "VITE_GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION", value: "true" },
    { name: "VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH", value: "false" },
    { name: "VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH", value: "false" },
  ],
};

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));
const unique = (values) => [...new Set(values)];
const stable = (value) => JSON.stringify(value);
const identitySetEqual = (left, right) =>
  left.length === right.length && new Set(left).size === left.length &&
  new Set(right).size === right.length && sorted(left).every((value, index) => value === sorted(right)[index]);

function playwrightCliPath(repositoryRoot) {
  const cli = resolve(repositoryRoot, "node_modules/playwright/cli.js");
  try {
    readFileSync(cli, { flag: "r" });
  } catch {
    throw new Error("Playwright is not installed in this worktree; install its lockfile dependencies before policy validation.");
  }
  return cli;
}

function parsePlaywrightReport(report, profileName, repositoryRoot) {
  if (!report || !Array.isArray(report.suites) || !Array.isArray(report.errors) || report.errors.length > 0) {
    throw new Error(`${profileName} Playwright discovery returned an invalid or incomplete JSON report.`);
  }
  const tests = [];
  const visit = (suite, titlePath, inheritedFile = "", isFileRoot = false) => {
    const nextTitlePath = isFileRoot ? titlePath : [...titlePath, suite.title].filter(Boolean);
    const suiteFile = String(suite.file ?? inheritedFile);
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const project = String(test.projectName ?? "");
        const testRoot = resolve(repositoryRoot, "src/tests/e2e");
        const reportedFile = String(spec.file ?? suiteFile);
        const absoluteFile = isAbsolute(reportedFile)
          ? resolve(reportedFile)
          : reportedFile.startsWith("src/tests/e2e/")
            ? resolve(repositoryRoot, reportedFile)
            : resolve(testRoot, reportedFile);
        const specPath = relative(testRoot, absoluteFile).split(sep).join("/");
        const specFile = basename(specPath);
        const fullTitlePath = [...nextTitlePath, String(spec.title ?? "")];
        if (!project || !specFile || specPath.startsWith("../") || specPath === ".." || fullTitlePath.some((part) => !part)) {
          throw new Error(`${profileName} discovery contains a test without project, spec, or full title identity.`);
        }
        tests.push({
          identity: `${project}::${specPath}::${fullTitlePath.join("::")}`,
          project,
          specPath: `src/tests/e2e/${specPath}`,
          relativeSpecPath: specPath,
          specFile,
          titlePath: fullTitlePath,
          sourceLine: Number.isInteger(spec.line) ? spec.line : null,
        });
      }
    }
    for (const child of suite.suites ?? []) visit(child, nextTitlePath, suiteFile);
  };
  for (const suite of report.suites) visit(suite, [], "", true);
  const identities = tests.map((test) => test.identity);
  if (tests.length === 0 || new Set(identities).size !== tests.length) {
    throw new Error(`${profileName} discovery is empty or contains duplicate identities.`);
  }
  return tests.sort((a, b) => a.identity.localeCompare(b.identity));
}

export function deriveM7vBuildFlagRequirements(requiredEnvironment, sourceBuildFlags) {
  const rules = [];
  for (const environmentName of requiredEnvironment) {
    const flags = M7V_CONFIGURED_BUILD_FLAGS_BY_ENV[environmentName] ?? [];
    if (flags.length) rules.push({ sourceEnvironment: environmentName, requiredValue: "1", flags });
  }
  for (const flag of sourceBuildFlags) {
    rules.push({ sourceEnvironment: flag, requiredValue: "true", flags: [{ name: flag, value: "true" }] });
  }
  const uniqueRules = new Map(rules.map((rule) => [JSON.stringify(rule), rule]));
  const conditionalBuildFlagAssignments = [...uniqueRules.values()].sort((a, b) => a.sourceEnvironment.localeCompare(b.sourceEnvironment));
  return { requiredBuildFlags: sorted(unique(sourceBuildFlags)), conditionalBuildFlagAssignments };
}

function runPlaywrightList(repositoryRoot, profileName, extraEnvironment = {}, configPath = "playwright.config.ts") {
  const cli = playwrightCliPath(repositoryRoot);
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (/^(?:OBSERVER_NATIVE_WEBGPU_|GROUND_GLASS_NATIVE_WEBGPU_|GROUND_GLASS_WEBGPU_|VITE_GROUND_GLASS_WEBGPU_|DREAM_LOOP_CAPTURE|SCENE_CAPACITY_BENCHMARK)/.test(name)) {
      delete environment[name];
    }
  }
  Object.assign(environment, extraEnvironment);
  const args = [cli, "test", `--config=${configPath}`, "--list", "--reporter=json"];
  const result = spawnSync(process.execPath, args, {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${profileName} Playwright discovery failed: ${(result.stderr || result.stdout).trim()}`);
  }
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${profileName} Playwright discovery emitted invalid JSON: ${String(error)}`);
  }
  return parsePlaywrightReport(report, profileName, repositoryRoot);
}

export function collectM7vPlaywrightInventories(repositoryRoot = projectRoot) {
  const standard = runPlaywrightList(repositoryRoot, "standard");
  const native = runPlaywrightList(repositoryRoot, "native-required", {
    OBSERVER_NATIVE_WEBGPU_REQUIRED: "1",
    GROUND_GLASS_NATIVE_WEBGPU_REQUIRED: "1",
  });
  const production = runPlaywrightList(repositoryRoot, "production-preview", {}, "playwright.production.config.ts");
  return { standard, native, production };
}

function normalizeSourceExpression(node, sourceFile) {
  return node?.getText(sourceFile).replace(/\s+/g, " ").trim() ?? null;
}

function objectProperty(object, name) {
  if (!object || !ts.isObjectLiteralExpression(object)) return null;
  return object.properties.find((property) => {
    const propertyName = property.name;
    return propertyName && (ts.isIdentifier(propertyName) || ts.isStringLiteral(propertyName)) && propertyName.text === name;
  }) ?? null;
}

function variableInitializers(sourceFile) {
  const values = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) values.set(declaration.name.text, declaration.initializer);
    }
  }
  return values;
}

function defineConfigObject(sourceFile) {
  for (const statement of sourceFile.statements) {
    if (!ts.isExportAssignment(statement)) continue;
    const visit = (node) => {
      if (ts.isCallExpression(node) && callName(node.expression) === "defineConfig" && ts.isObjectLiteralExpression(node.arguments[0])) {
        return node.arguments[0];
      }
      let found = null;
      ts.forEachChild(node, (child) => { found ??= visit(child); });
      return found;
    };
    const found = visit(statement.expression);
    if (found) return found;
  }
  return null;
}

export function collectM7vPlaywrightConfigurationEvidence(repositoryRoot = projectRoot) {
  const standardPath = resolve(repositoryRoot, "playwright.config.ts");
  const standardSource = ts.createSourceFile(standardPath, readFileSync(standardPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const variables = variableInitializers(standardSource);
  const gateVariableNames = [
    "nativeWebGpuRequired",
    "groundGlassNativeWebGpuRequired",
    "groundGlassFailureIntegration",
    "groundGlassPhysicalCocResearch",
    "groundGlassPhysicalCocR187Qualification",
    "groundGlassApertureGatherResearch",
    "groundGlassApertureGatherR187Qualification",
    "groundGlassM6PresentationRequired",
    "groundGlassM6R187Qualification",
    "groundGlassM6NativeRequired",
    "headedNativeWebGpuRequired",
  ];
  const webServerEnvironment = variables.get("webServerEnvironment");
  const webServerFlags = webServerEnvironment && ts.isObjectLiteralExpression(webServerEnvironment)
    ? webServerEnvironment.properties.filter((property) => {
        const name = property.name;
        return name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text.startsWith("VITE_GROUND_GLASS_WEBGPU_");
      }).map((property) => ({
        name: property.name.text,
        expression: normalizeSourceExpression(property.initializer, standardSource),
      })).sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const standardConfig = defineConfigObject(standardSource);
  const productionPath = resolve(repositoryRoot, "playwright.production.config.ts");
  const productionSource = ts.createSourceFile(productionPath, readFileSync(productionPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const productionConfig = defineConfigObject(productionSource);
  const policyPath = resolve(repositoryRoot, "scripts/e2e-spec-policy.mjs");
  const policySource = ts.createSourceFile(policyPath, readFileSync(policyPath, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const policyVariables = variableInitializers(policySource);
  return {
    standardGateExpressions: Object.fromEntries(gateVariableNames.map((name) => [name, normalizeSourceExpression(variables.get(name), standardSource)])),
    standardTestIgnore: normalizeSourceExpression(objectProperty(standardConfig, "testIgnore")?.initializer, standardSource),
    standardProjects: normalizeSourceExpression(objectProperty(standardConfig, "projects")?.initializer, standardSource),
    standardWebServerBuildFlags: webServerFlags,
    productionTestMatch: normalizeSourceExpression(objectProperty(productionConfig, "testMatch")?.initializer, productionSource),
    productionProjects: normalizeSourceExpression(objectProperty(productionConfig, "projects")?.initializer, productionSource),
    productionSpecSuffix: normalizeSourceExpression(policyVariables.get("productionPreviewSpecSuffix"), policySource),
  };
}

function callName(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return `${callName(node.expression)}.${node.name.text}`;
  if (ts.isElementAccessExpression(node) && node.argumentExpression &&
      (ts.isStringLiteral(node.argumentExpression) || ts.isNoSubstitutionTemplateLiteral(node.argumentExpression))) {
    return `${callName(node.expression)}.${node.argumentExpression.text}`;
  }
  return "";
}

function isFunctionLike(node) {
  return Boolean(node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node)));
}

function callbackArgument(call, index) {
  const argument = index === -1 ? [...call.arguments].reverse().find(isFunctionLike) : call.arguments[index];
  return isFunctionLike(argument) ? argument : null;
}

function isTestDefinition(call) {
  return ts.isCallExpression(call) &&
    ["test", "test.only", "test.skip", "test.fixme", "test.fail"].includes(callName(call.expression)) &&
    typeof call.arguments[0] !== "undefined" && callbackArgument(call, -1) !== null;
}

function isDescribeDefinition(call) {
  return ts.isCallExpression(call) &&
    ["test.describe", "test.describe.serial", "test.describe.parallel", "test.describe.only", "test.describe.skip", "test.describe.fixme"].includes(callName(call.expression)) &&
    typeof call.arguments[0] !== "undefined" && callbackArgument(call, -1) !== null;
}

function isSkipGate(call) {
  return ts.isCallExpression(call) && ["test.skip", "test.fixme"].includes(callName(call.expression)) && !callbackArgument(call, 1);
}

function staticTitle(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function isStaticSkippedTest(call) {
  return ["test.skip", "test.fixme"].includes(callName(call.expression)) && isTestDefinition(call);
}

function isStaticSkippedSuite(call) {
  return ["test.describe.skip", "test.describe.fixme"].includes(callName(call.expression)) && isDescribeDefinition(call);
}

function isDynamicTestModifierCall(call) {
  if (!ts.isCallExpression(call) || !ts.isElementAccessExpression(call.expression)) return false;
  const modifier = call.expression.argumentExpression;
  if (!modifier || ts.isStringLiteral(modifier) || ts.isNoSubstitutionTemplateLiteral(modifier)) return false;
  const owner = callName(call.expression.expression);
  return owner === "test" || owner === "test.describe";
}

function isUnsupportedSkipPattern(call) {
  if (isDynamicTestModifierCall(call)) return true;
  const name = callName(call.expression);
  if (!/\.(?:skip|fixme)$/.test(name)) return false;
  return !isTestDefinition(call) && !isDescribeDefinition(call) && !isSkipGate(call);
}

function sourceLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function serializeSkipGate(gate, sourceFile) {
  const call = gate.node;
  if (gate.kind === "static-skip-declaration") {
    return {
      kind: gate.kind,
      line: sourceLine(sourceFile, call),
      scope: gate.scope,
      sourceText: callName(call.expression),
      condition: "unconditional",
      reason: null,
    };
  }
  return {
    line: sourceLine(sourceFile, call),
    scope: gate.scope,
    sourceText: call.getText(sourceFile),
    condition: call.arguments[0]?.getText(sourceFile) ?? null,
    reason: typeof call.arguments[1]?.text === "string" ? call.arguments[1].text : null,
  };
}

function collectBodySkipGates(body, sourceFile) {
  const gates = [];
  const unsupportedPatterns = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && (isTestDefinition(node) || isDescribeDefinition(node))) return;
    if (ts.isCallExpression(node) && isSkipGate(node)) gates.push({ node, scope: "test" });
    else if (ts.isCallExpression(node) && isUnsupportedSkipPattern(node)) {
      unsupportedPatterns.push(`unsupported-test-skip-pattern:${sourceLine(sourceFile, node)}:${node.getText(sourceFile)}`);
    }
    ts.forEachChild(node, visit);
  };
  if (body) visit(body);
  return { gates, unsupportedPatterns };
}

function scanTestDefinitions(sourceFile) {
  const byLine = new Map();
  const byTitlePath = new Map();
  const unsupportedPatterns = [];
  const record = (call, inheritedGates, suiteTitlePath) => {
    const body = callbackArgument(call, -1)?.body;
    const line = sourceLine(sourceFile, call);
    const title = staticTitle(call.arguments[0]);
    const definition = {
      line,
      callName: callName(call.expression),
      titleExpression: call.arguments[0]?.getText(sourceFile) ?? "",
    };
    const bodyEvidence = collectBodySkipGates(body, sourceFile);
    unsupportedPatterns.push(...bodyEvidence.unsupportedPatterns);
    const staticDeclaration = isStaticSkippedTest(call)
      ? [{ node: call, scope: "test", kind: "static-skip-declaration" }]
      : [];
    const gates = [
      ...inheritedGates,
      ...staticDeclaration,
      ...bodyEvidence.gates,
    ].map((gate) => serializeSkipGate(gate, sourceFile));
    const signature = normalizeDeclarationSignature(definition, gates);
    const entries = byLine.get(line) ?? [];
    entries.push({ definition, skipConditions: gates, signature });
    byLine.set(line, entries);
    if (title !== null && title.trim() !== "") {
      const titlePath = [...suiteTitlePath, title];
      const key = titlePath.join("\u0000");
      if (byTitlePath.has(key)) unsupportedPatterns.push(`duplicate-static-test-title-path:${titlePath.join("::")}`);
      else byTitlePath.set(key, {
        definition,
        skipConditions: gates,
        signature,
      });
    }
  };
  const scanNested = (node, inheritedGates, suiteTitlePath) => {
    if (ts.isBlock(node)) {
      scanStatements(node.statements, inheritedGates, suiteTitlePath);
      return;
    }
    if (ts.isCallExpression(node) && isDescribeDefinition(node)) {
      const body = callbackArgument(node, -1)?.body;
      if (body && ts.isBlock(body)) {
        const title = staticTitle(node.arguments[0]);
        const suiteGate = isStaticSkippedSuite(node)
          ? [{ node, scope: "suite", kind: "static-skip-declaration" }]
          : [];
        scanStatements(body.statements, [...inheritedGates, ...suiteGate], title === null ? suiteTitlePath : [...suiteTitlePath, title]);
      }
      return;
    }
    if (ts.isCallExpression(node) && isTestDefinition(node)) {
      record(node, inheritedGates, suiteTitlePath);
      return;
    }
    if (ts.isCallExpression(node) && isSkipGate(node)) return;
    if (ts.isCallExpression(node) && isUnsupportedSkipPattern(node)) {
      unsupportedPatterns.push(`unsupported-test-skip-pattern:${sourceLine(sourceFile, node)}:${node.getText(sourceFile)}`);
      return;
    }
    ts.forEachChild(node, (child) => scanNested(child, inheritedGates, suiteTitlePath));
  };
  const scanStatements = (statements, inheritedGates, suiteTitlePath) => {
    let activeGates = [...inheritedGates];
    for (const statement of statements) {
      if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && isSkipGate(statement.expression)) {
        activeGates = [...activeGates, { node: statement.expression, scope: "suite" }];
        continue;
      }
      if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && isDescribeDefinition(statement.expression)) {
        const body = callbackArgument(statement.expression, -1)?.body;
        if (body && ts.isBlock(body)) {
          const title = staticTitle(statement.expression.arguments[0]);
          const suiteGate = isStaticSkippedSuite(statement.expression)
            ? [{ node: statement.expression, scope: "suite", kind: "static-skip-declaration" }]
            : [];
          scanStatements(body.statements, [...activeGates, ...suiteGate], title === null ? suiteTitlePath : [...suiteTitlePath, title]);
        }
        continue;
      }
      if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && isTestDefinition(statement.expression)) {
        record(statement.expression, activeGates, suiteTitlePath);
        continue;
      }
      if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && isUnsupportedSkipPattern(statement.expression)) {
        unsupportedPatterns.push(`unsupported-test-skip-pattern:${sourceLine(sourceFile, statement.expression)}:${statement.expression.getText(sourceFile)}`);
        continue;
      }
      scanNested(statement, activeGates, suiteTitlePath);
    }
  };
  scanStatements(sourceFile.statements, [], []);
  return { byLine, byTitlePath, unsupportedPatterns: unique(unsupportedPatterns) };
}

function normalizeDeclarationSignature(definition, skipConditions) {
  return {
    callName: definition.callName,
    skipConditions: skipConditions.map(({ kind = "conditional-skip-gate", scope, condition, reason, sourceText }) => ({
      kind,
      scope,
      condition,
      reason,
      sourceText: String(sourceText ?? "").replace(/\s+/g, " ").trim(),
    })),
  };
}

function propertyChain(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isMetaProperty(node)) return `${node.keywordToken === ts.SyntaxKind.ImportKeyword ? "import" : "meta"}.${node.name.text}`;
  if (ts.isPropertyAccessExpression(node)) return `${propertyChain(node.expression)}.${node.name.text}`;
  if (ts.isElementAccessExpression(node)) {
    const argument = node.argumentExpression;
    const part = argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
      ? argument.text : "";
    return `${propertyChain(node.expression)}.${part}`;
  }
  return "";
}

function importBindings(sourceFile) {
  const bindings = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindingsNode = statement.importClause?.namedBindings;
    if (!bindingsNode || !ts.isNamedImports(bindingsNode)) continue;
    for (const element of bindingsNode.elements) {
      bindings.set(element.name.text, {
        importedName: element.propertyName?.text ?? element.name.text,
        moduleSpecifier: statement.moduleSpecifier.text,
      });
    }
  }
  return bindings;
}

function resolveImportedFunction(repositoryRoot, currentPath, moduleSpecifier, functionName) {
  if (!moduleSpecifier.startsWith(".")) return null;
  const base = resolve(dirname(currentPath), moduleSpecifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, resolve(base, "index.ts")];
  for (const path of candidates) {
    try {
      const contents = readFileSync(path, "utf8");
      const sf = ts.createSourceFile(path, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      for (const statement of sf.statements) {
        if (ts.isFunctionDeclaration(statement) && statement.name?.text === functionName) return { path, sourceFile: sf, node: statement.body };
        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name) && declaration.name.text === functionName && declaration.initializer) {
              return { path, sourceFile: sf, node: declaration.initializer };
            }
          }
        }
      }
    } catch {
      // Try the next source extension.
    }
  }
  return null;
}

function collectRequiredEnvironment(repositoryRoot, sourcePath, sourceFile, gates) {
  const environments = new Set();
  const buildFlags = new Set();
  const variables = new Map();
  const functions = new Map();
  const imports = importBindings(sourceFile);
  const visitDeclarations = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) variables.set(node.name.text, node.initializer);
    if (ts.isFunctionDeclaration(node) && node.name && node.body) functions.set(node.name.text, node.body);
    ts.forEachChild(node, visitDeclarations);
  };
  visitDeclarations(sourceFile);
  const expandedSymbols = new Set();
  const expandedHelpers = new Set();
  const visit = (node, sf = sourceFile, filePath = sourcePath, depth = 0) => {
    if (!node || depth > 24) return;
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const chain = propertyChain(node);
      const match = chain.match(/^(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]*)$/);
      if (match) {
        (match[1].startsWith("VITE_") ? buildFlags : environments).add(match[1]);
        return;
      }
    }
    if (ts.isIdentifier(node)) {
      const name = node.text;
      const local = variables.get(name) ?? functions.get(name);
      if (local && !expandedSymbols.has(name)) {
        expandedSymbols.add(name);
        visit(local, sourceFile, sourcePath, depth + 1);
      }
      const imported = imports.get(name);
      if (imported && !expandedHelpers.has(name)) {
        expandedHelpers.add(name);
        const helper = resolveImportedFunction(repositoryRoot, sourcePath, imported.moduleSpecifier, imported.importedName);
        if (helper) visit(helper.node, helper.sourceFile, helper.path, depth + 1);
      }
    }
    ts.forEachChild(node, (child) => visit(child, sf, filePath, depth + 1));
  };
  for (const gate of gates) {
    if (gate.node.arguments[0]) visit(gate.node.arguments[0]);
    const reason = typeof gate.node.arguments[1]?.text === "string" ? gate.node.arguments[1].text : "";
    for (const match of reason.matchAll(/\b([A-Z][A-Z0-9_]+)\s*=/g)) {
      (match[1].startsWith("VITE_") ? buildFlags : environments).add(match[1]);
    }
  }
  return { requiredEnvironment: sorted(environments), requiredBuildFlags: sorted(buildFlags) };
}

export function collectM7vTestSourceEvidence(repositoryRoot, discoveredTests) {
  const byFile = new Map();
  const evidenceByIdentity = new Map();
  for (const test of discoveredTests) {
    const file = test.specPath ?? `src/tests/e2e/${test.specFile}`;
    if (!byFile.has(file)) {
      const sourcePath = resolve(repositoryRoot, file);
      const text = readFileSync(sourcePath, "utf8");
      const sourceFile = ts.createSourceFile(sourcePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      if (sourceFile.parseDiagnostics.length > 0) throw new Error(`Could not parse ${file} while verifying test skip gates.`);
      byFile.set(file, { sourcePath, sourceFile, definitions: scanTestDefinitions(sourceFile) });
    }
    const entry = byFile.get(file);
    const line = test.sourceLine;
    const definitions = entry.definitions.byLine.get(line) ?? [];
    if (definitions.length !== 1) {
      if (definitions.length === 0 && entry.definitions.unsupportedPatterns.length > 0) {
        const definition = {
          line: line ?? 0,
          callName: "unsupported-skip-affecting-declaration",
          titleExpression: test.titlePath?.at(-1) ?? "",
        };
        evidenceByIdentity.set(test.identity, {
          identity: test.identity,
          sourcePath: file,
          definition,
          skipConditions: [],
          declarationSignature: normalizeDeclarationSignature(definition, []),
          unsupportedPatterns: entry.definitions.unsupportedPatterns,
          requiredEnvironment: [],
          requiredBuildFlags: [],
        });
        continue;
      }
      throw new Error(`${test.identity} maps to ${definitions.length} source test definitions at ${file}:${line ?? "unknown"}.`);
    }
    const sourceEvidence = definitions[0];
    const required = collectRequiredEnvironment(repositoryRoot, entry.sourcePath, entry.sourceFile, sourceEvidence.skipConditions.map((gate) => ({
      node: findSkipGateNode(entry.sourceFile, gate.line, gate.sourceText),
    })).filter((gate) => gate.node));
    evidenceByIdentity.set(test.identity, {
      identity: test.identity,
      sourcePath: file,
      definition: sourceEvidence.definition,
      skipConditions: sourceEvidence.skipConditions,
      declarationSignature: normalizeDeclarationSignature(sourceEvidence.definition, sourceEvidence.skipConditions),
      unsupportedPatterns: entry.definitions.unsupportedPatterns,
      ...required,
    });
  }
  return evidenceByIdentity;
}

export function collectM7vSourceDeclarationBaseline(repositoryRoot, discoveredTests, currentSourceEvidence, commitSha = M7V_SOURCE_DECLARATION_BASELINE_COMMIT) {
  const issues = [];
  const byFile = new Map();
  const declarationsByIdentity = new Map();
  if (!/^[a-f0-9]{40}$/.test(commitSha)) {
    return { commitSha, declarationsByIdentity, issues: ["m7v-source-policy-baseline-invalid-sha"] };
  }
  for (const test of discoveredTests) {
    const relativeSpecPath = test.relativeSpecPath ?? test.specPath?.replace(/^src\/tests\/e2e\//, "") ?? test.specFile;
    const file = `src/tests/e2e/${relativeSpecPath}`;
    if (!byFile.has(file)) {
      const result = spawnSync("git", ["show", `${commitSha}:${file}`], {
        cwd: repositoryRoot,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
      if (result.error || result.status !== 0) {
        byFile.set(file, { missing: true });
      } else {
        const sourceFile = ts.createSourceFile(file, result.stdout, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        byFile.set(file, sourceFile.parseDiagnostics.length > 0
          ? { invalid: true }
          : { definitions: scanTestDefinitions(sourceFile) });
      }
    }
    const source = byFile.get(file);
    if (!source || source.missing) {
      issues.push(`m7v-source-policy-baseline-file-unavailable:${file}`);
      continue;
    }
    if (source.invalid) {
      issues.push(`m7v-source-policy-baseline-file-invalid:${file}`);
      continue;
    }
    const titlePath = Array.isArray(test.titlePath) ? test.titlePath : [];
    let definition = source.definitions.byTitlePath.get(titlePath.join("\u0000"));
    if (!definition) {
      const currentTitleExpression = currentSourceEvidence?.get(test.identity)?.definition?.titleExpression;
      const matchingDefinitions = [...source.definitions.byLine.values()].flat().filter((entry) =>
        entry.definition.titleExpression === currentTitleExpression);
      const signatures = new Map(matchingDefinitions.map((entry) => [stable(entry.signature), entry]));
      if (signatures.size === 1) definition = [...signatures.values()][0];
    }
    if (!definition) {
      issues.push(`m7v-source-policy-baseline-identity-unavailable:${test.identity}`);
      continue;
    }
    for (const pattern of source.definitions.unsupportedPatterns) issues.push(`m7v-source-policy-baseline-unsupported-pattern:${file}:${pattern}`);
    declarationsByIdentity.set(test.identity, definition.signature);
  }
  return { commitSha, declarationsByIdentity, issues: unique(issues) };
}

function findSkipGateNode(sourceFile, line, text) {
  let found = null;
  const visit = (node) => {
    if (found) return;
    if (ts.isCallExpression(node) && isSkipGate(node) && sourceLine(sourceFile, node) === line && node.getText(sourceFile) === text) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function expectedProfileIdentities(profile) {
  return (profile?.tests ?? []).map((test) => test.identity);
}

function packageScriptIssues(packageManifest) {
  const issues = [];
  const scripts = packageManifest?.scripts ?? {};
  const normalize = (value) => String(value ?? "").trim().replaceAll("\\", "/").replaceAll("./", "");
  const safe = (value) => !/[;&|<>]/.test(String(value ?? ""));
  const exactTarget = (name, target, mode = null) => {
    const value = normalize(scripts[name]);
    const tokens = value.split(/\s+/).filter(Boolean);
    const targetIndex = tokens.indexOf(target);
    const modeIndex = mode ? tokens.indexOf(mode, targetIndex + 1) : -1;
    if (!value || !safe(value) || tokens[0] !== "node" || targetIndex < 1 || (mode && modeIndex <= targetIndex)) {
      issues.push(`required-package-script-invalid:${name}`);
    }
  };
  const e2e = normalize(scripts["test:e2e"]);
  if (!safe(e2e) || !/^(?:npx\s+)?(?:playwright|node_modules\/\.bin\/playwright)\s+test(?:\s|$)/.test(e2e)) {
    issues.push("required-package-script-invalid:test:e2e");
  }
  exactTarget("dream-loop:capture", "scripts/dream-loop/capture.mjs");
  exactTarget("benchmark:scene-capacity", "scripts/run-scene-capacity-benchmark.mjs");
  exactTarget("evidence:check:m7v", "scripts/run-m7v-qualification.mjs", "validate-policy");
  exactTarget("evidence:require-approved:m7v", "scripts/run-m7v-qualification.mjs", "require-approved");
  exactTarget("evidence:require-qualified:m7v", "scripts/run-m7v-qualification.mjs", "require-qualified");
  return issues;
}

function addIssue(issues, condition, issue) {
  if (!condition) issues.push(issue);
}

function sortedIdentityDiff(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  return {
    added: sorted([...b].filter((identity) => !a.has(identity))),
    removed: sorted([...a].filter((identity) => !b.has(identity))),
  };
}

function compareSourceEvidence(expected, actual) {
  return stable({
    sourcePath: expected.sourcePath,
    definition: expected.definition,
    skipConditions: expected.skipConditions,
    requiredEnvironment: expected.requiredEnvironment,
    requiredBuildFlags: expected.requiredBuildFlags,
  }) === stable({
    sourcePath: actual?.sourcePath,
    definition: actual?.definition,
    skipConditions: actual?.skipConditions,
    requiredEnvironment: actual?.requiredEnvironment,
    requiredBuildFlags: actual?.requiredBuildFlags,
  });
}

function canonicalTestKey(identity) {
  const separator = String(identity).indexOf("::");
  return separator >= 0 ? String(identity).slice(separator + 2) : String(identity);
}

function laneProjectName(lane) {
  return {
    "ordinary-webgl": "chromium",
    "renderer-serial": "chromium-renderer-serial",
    "native-webgpu": "chrome-native-webgpu",
    "production-preview": "chromium-production-preview",
  }[lane] ?? null;
}

function normalizeExecutionSpecPath(file, report) {
  const normalized = String(file ?? "").replaceAll("\\", "/");
  const marker = normalized.lastIndexOf("src/tests/e2e/");
  if (marker >= 0) return normalized.slice(marker + "src/tests/e2e/".length);
  if (isAbsolute(normalized)) {
    const configuredRoot = String(report?.config?.rootDir ?? "").replaceAll("\\", "/");
    if (configuredRoot && isAbsolute(configuredRoot)) {
      const candidate = relative(configuredRoot, normalized).replaceAll("\\", "/");
      if (candidate && !candidate.startsWith("../") && candidate !== "..") return candidate;
    }
    return null;
  }
  return normalized.startsWith("../") || normalized === ".." || !normalized ? null : normalized.replace(/^\.\//, "");
}

function flattenPlaywrightExecutionReport(report) {
  const issues = [];
  const tests = [];
  if (!report || !Array.isArray(report.suites) || !Array.isArray(report.errors) || report.errors.length > 0) {
    return { tests, issues: ["playwright-report-invalid-or-incomplete"] };
  }
  const visit = (suite, titlePath = [], isRoot = false) => {
    const nextPath = isRoot ? titlePath : [...titlePath, String(suite.title ?? "")].filter(Boolean);
    for (const spec of suite.specs ?? []) {
      const specPath = normalizeExecutionSpecPath(spec.file ?? suite.file, report);
      const title = String(spec.title ?? "");
      if (!specPath || !title) {
        issues.push("playwright-report-test-identity-invalid");
        continue;
      }
      const fullTitlePath = [...nextPath, title];
      for (const test of spec.tests ?? []) {
        const projectName = String(test.projectName ?? test.projectId ?? "");
        if (!projectName) {
          issues.push("playwright-report-project-identity-missing");
          continue;
        }
        const identity = `${projectName}::${specPath}::${fullTitlePath.join("::")}`;
        const results = Array.isArray(test.results) ? test.results : null;
        if (!results) {
          issues.push(`playwright-report-results-invalid:${identity}`);
          continue;
        }
        tests.push({
          identity,
          canonicalKey: canonicalTestKey(identity),
          projectName,
          expectedStatus: test.expectedStatus ?? null,
          declaredStatus: test.status ?? null,
          results,
        });
      }
    }
    for (const child of suite.suites ?? []) visit(child, nextPath, false);
  };
  for (const suite of report.suites) visit(suite, [], true);
  const identities = tests.map((test) => test.identity);
  if (new Set(identities).size !== identities.length) issues.push("playwright-report-duplicate-test-identities");
  return { tests, issues: unique(issues) };
}

export function deriveM7vExecutionArtifactEvidence({ lane, artifact, requiredIdentities }) {
  const issues = [];
  const expectedProject = laneProjectName(lane);
  if (!artifact || artifact.schemaVersion !== 1 || artifact.lane !== lane) {
    return { issues: ["execution-artifact-schema-or-lane-invalid"], summary: null, passedIdentities: [] };
  }
  if (!/^[a-f0-9]{40}$/.test(String(artifact.sourceCommitSha ?? ""))) issues.push("execution-artifact-source-commit-invalid");
  if (artifact.projectName !== expectedProject) issues.push("execution-artifact-project-mismatch");
  if (!artifact.browser || artifact.browser.name !== "chromium" || typeof artifact.browser.version !== "string" || !artifact.browser.version) {
    issues.push("execution-artifact-browser-identity-invalid");
  }
  if (typeof artifact.nodeVersion !== "string" || !/^v\d+\.\d+\.\d+$/.test(artifact.nodeVersion)) issues.push("execution-artifact-node-version-invalid");
  const report = artifact.playwrightReport;
  const reportVersion = report?.config?.version;
  const projectConfig = Array.isArray(report?.config?.projects)
    ? report.config.projects.find((project) => project.name === expectedProject)
    : undefined;
  if (!reportVersion || reportVersion !== artifact.playwrightVersion || !Array.isArray(report?.config?.projects) ||
      !projectConfig || projectConfig.retries !== 0) {
    issues.push("execution-artifact-playwright-project-or-version-invalid");
  }
  const flattened = flattenPlaywrightExecutionReport(report);
  issues.push(...flattened.issues);
  const executed = flattened.tests.filter((test) => test.results.length > 0);
  const expectedByKey = new Map(requiredIdentities.map((identity) => [canonicalTestKey(identity), identity]));
  if (expectedByKey.size !== requiredIdentities.length) issues.push("execution-required-identities-duplicate");
  const actualRequired = [];
  let retries = 0;
  let flaky = 0;
  let incomplete = 0;
  let failed = 0;
  let skipped = 0;
  for (const requiredIdentity of requiredIdentities) {
    const key = canonicalTestKey(requiredIdentity);
    const matches = flattened.tests.filter((test) => test.canonicalKey === key);
    if (matches.length !== 1) {
      incomplete += 1;
      issues.push(matches.length === 0 ? `execution-required-identity-missing:${requiredIdentity}` : `execution-required-identity-duplicated:${requiredIdentity}`);
      continue;
    }
    const test = matches[0];
    if (test.projectName !== expectedProject || test.identity !== `${expectedProject}::${key}`) {
      issues.push(`execution-required-project-mismatch:${requiredIdentity}`);
    }
    if (!test.results.length && test.declaredStatus !== "skipped") {
      issues.push(`execution-declared-status-without-results:${requiredIdentity}`);
    }
    if (test.expectedStatus !== "passed") issues.push(`execution-required-expected-status-invalid:${requiredIdentity}`);
    if (test.results.length === 0) {
      incomplete += 1;
      issues.push(`execution-required-result-missing:${requiredIdentity}`);
      continue;
    }
    const finalStatus = test.results.at(-1)?.status;
    const derivedDeclaredStatus = finalStatus === "skipped"
      ? "skipped"
      : finalStatus === test.expectedStatus ? "expected" : "unexpected";
    if (test.declaredStatus !== derivedDeclaredStatus) {
      issues.push(`execution-declared-status-disagrees-with-results:${requiredIdentity}`);
    }
    if (test.results.length > 1) {
      flaky += 1;
      retries += test.results.slice(1).length;
      issues.push(`execution-retried-or-flaky:${requiredIdentity}`);
    }
    const first = test.results[0];
    if (first.retry !== 0) {
      retries += 1;
      issues.push(`execution-retry-nonzero:${requiredIdentity}`);
    }
    if (first.status === "skipped" || test.expectedStatus === "skipped") {
      skipped += 1;
      issues.push(`execution-required-test-skipped:${requiredIdentity}`);
    } else if (test.results.some((result) => result.status !== "passed")) {
      failed += 1;
      issues.push(`execution-required-test-outcome-failed:${requiredIdentity}`);
    }
    if (!Number.isFinite(first.duration) || first.duration <= 0 || !Number.isInteger(first.workerIndex) ||
        !Number.isInteger(first.parallelIndex) || (first.errors?.length ?? 0) > 0) {
      incomplete += 1;
      issues.push(`execution-result-incomplete:${requiredIdentity}`);
    }
    if (first.status === "passed" && test.results.length === 1 && test.expectedStatus === "passed" &&
        Number.isFinite(first.duration) && first.duration > 0 && (first.errors?.length ?? 0) === 0) {
      actualRequired.push(requiredIdentity);
    }
  }
  for (const test of flattened.tests) {
    if (!expectedByKey.has(test.canonicalKey)) issues.push(`execution-unexpected-identity:${test.identity}`);
  }

  const runtimeRows = Array.isArray(artifact.runtimeEvidence) ? artifact.runtimeEvidence : [];
  const runtimeByKey = new Map();
  for (const row of runtimeRows) {
    const key = canonicalTestKey(row?.identity ?? "");
    if (!key || runtimeByKey.has(key)) issues.push(`runtime-evidence-identity-duplicate-or-invalid:${String(row?.identity ?? "")}`);
    else runtimeByKey.set(key, row);
  }
  for (const identity of requiredIdentities) {
    const key = canonicalTestKey(identity);
    const runtime = runtimeByKey.get(key);
    const test = flattened.tests.find((entry) => entry.canonicalKey === key && entry.projectName === expectedProject);
    const actualResult = test?.results?.[0];
    if (!runtime || !test || runtime.projectName !== expectedProject || runtime.sourceCommitSha !== artifact.sourceCommitSha ||
        runtime.retry !== 0 || runtime.workerIndex !== actualResult?.workerIndex || runtime.parallelIndex !== actualResult?.parallelIndex) {
      issues.push(`runtime-evidence-not-linked-to-result:${identity}`);
      continue;
    }
    if (lane === "native-webgpu") {
      if (runtime.rendererFamily !== "webgpu-renderer" || runtime.executionApi !== "webgpu" ||
          runtime.applicationFallback !== false || runtime.webglCompatibilityBackend !== false) {
        issues.push(`native-runtime-identity-invalid:${identity}`);
      }
    } else if (runtime.rendererFamily !== "webgl-renderer" || runtime.executionApi !== "webgl2" ||
        runtime.applicationFallback !== false || runtime.webglCompatibilityBackend !== false) {
      issues.push(`webgl-runtime-identity-invalid:${identity}`);
    }
    if (lane === "production-preview" &&
        (runtime.productionBundleWebGpuExcluded !== true || runtime.urlCannotEnableWebGpu !== true)) {
      issues.push(`production-preview-isolation-unverified:${identity}`);
    }
  }
  if (runtimeByKey.size !== requiredIdentities.length) issues.push("runtime-evidence-coverage-mismatch");

  const summary = {
    coveredIdentities: actualRequired.sort((a, b) => a.localeCompare(b)),
    retries,
    flaky,
    incomplete,
    failed,
    skipped,
    executedIdentities: executed.map((test) => test.identity).sort((a, b) => a.localeCompare(b)),
  };
  return { issues: unique(issues), summary, passedIdentities: summary.coveredIdentities };
}

export function verifyM7vRunnerArtifactProvenance({ lane, descriptor, artifact, artifactContentSha256, proof }) {
  const issues = [];
  if (!proof || proof.status !== "loaded") return ["lane-runner-provenance-unavailable"];
  if (!descriptor || !artifact || !proof.run || !proof.artifact) return ["lane-runner-provenance-incomplete"];
  const expectedSource = String(descriptor.sourceCommitSha ?? "");
  if (proof.repository !== M7V_REPOSITORY || proof.run.repository?.full_name !== M7V_REPOSITORY) issues.push("lane-runner-repository-mismatch");
  if (proof.run.path !== M7V_RUNNER_WORKFLOW_PATH) issues.push("lane-runner-workflow-untrusted");
  if (proof.run.status !== "completed" || proof.run.conclusion !== "success") issues.push("lane-runner-run-not-successful");
  if (proof.run.head_sha !== expectedSource || artifact.sourceCommitSha !== expectedSource || artifact.lane !== lane) issues.push("lane-runner-source-commit-mismatch");
  if (proof.sourceTreeMatchesCurrent !== true) issues.push("lane-runner-source-tree-stale-or-unavailable");
  if (proof.run.id !== descriptor.runId || proof.artifact.id !== descriptor.artifactId || proof.artifact.name !== descriptor.artifactName ||
      proof.artifact.expired !== false) issues.push("lane-runner-artifact-reference-mismatch");
  if (typeof descriptor.sourceCommitSha !== "string" || !/^[a-f0-9]{40}$/.test(descriptor.sourceCommitSha)) issues.push("lane-artifact-source-sha-invalid");
  if (typeof descriptor.archiveSha256 !== "string" || !/^sha256:[a-f0-9]{64}$/.test(descriptor.archiveSha256) ||
      proof.artifact.digest !== descriptor.archiveSha256) issues.push("lane-runner-archive-digest-unverified");
  if (descriptor.contentSha256 !== artifactContentSha256) issues.push("lane-evidence-content-digest-mismatch");
  return unique(issues);
}

export function verifyM7vApprovalReview({ identity, evidenceUrl, decision, currentHeadSha, proof }) {
  const issues = [];
  if (!proof || proof.status !== "loaded") return ["owner-approval-verification-unavailable"];
  const match = /^https:\/\/github\.com\/chau-hm\/view-camera-simulator\/pull\/(\d+)$/.exec(String(evidenceUrl ?? ""));
  if (!match || proof.repository !== M7V_REPOSITORY || proof.repositoryOwner !== M7V_REPOSITORY_OWNER ||
      proof.pullNumber !== Number(match[1])) return ["owner-approval-reference-unverified"];
  if (!decision || typeof decision.approver !== "string" || !["admin", "maintain"].includes(decision.authority) ||
      decision.authority !== proof.actorPermission || decision.scope !== identity || decision.policyRevision !== M7V_POLICY_REVISION) {
    issues.push("owner-approval-declaration-mismatch");
  }
  if (!/^[a-f0-9]{40}$/.test(String(currentHeadSha ?? ""))) return ["owner-approval-current-revision-unavailable"];
  const ownerReviews = (proof.reviews ?? []).filter((review) => review.user?.login === decision?.approver &&
    Number.isFinite(Date.parse(review.submitted_at ?? "")))
    .sort((a, b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at));
  const latest = ownerReviews.at(-1);
  const marker = `M7V-APPROVE ${M7V_POLICY_REVISION} ${sha256(Buffer.from(identity))}`;
  const bodyLines = String(latest?.body ?? "").split(/\r?\n/).map((line) => line.trim());
  if (!decision?.approver || !["admin", "maintain"].includes(proof.actorPermission) ||
      !latest || String(latest.state).toUpperCase() !== "APPROVED" || latest.commit_id !== currentHeadSha || !bodyLines.includes(marker)) {
    issues.push("owner-approval-review-not-current-or-explicit");
  }
  return unique(issues);
}

export function extractOutcomeCoverageIssues(lane, evidence, requiredIdentities, loadedArtifact, runnerProof) {
  const integrityIssues = [];
  const qualificationIssues = [];
  if (!evidence || evidence.status !== "qualified") {
    if (!evidence || !["not-run", "blocked", "not-qualified"].includes(evidence.status)) integrityIssues.push(`lane-evidence-status-invalid:${lane}`);
    if (evidence?.status === "not-run" && (evidence.artifact !== null || (evidence.coveredIdentities?.length ?? 0) > 0 ||
        [evidence.retries, evidence.flaky, evidence.incomplete, evidence.failed, evidence.skipped].some((value) => value !== null))) {
      integrityIssues.push(`lane-not-run-has-claimed-outcomes:${lane}`);
    }
    qualificationIssues.push(`lane-not-qualified:${lane}:${evidence?.status ?? "missing"}`);
    return { integrityIssues, qualificationIssues };
  }
  const descriptor = evidence.artifact;
  if (!descriptor || typeof descriptor !== "object" || !Number.isInteger(descriptor.runId) || !Number.isInteger(descriptor.artifactId) ||
      typeof descriptor.artifactName !== "string" || typeof descriptor.storedPath !== "string" || typeof descriptor.artifactFile !== "string" ||
      !/^([a-f0-9]{64})$/.test(descriptor.contentSha256 ?? "") ||
      !/^[a-f0-9]{40}$/.test(descriptor.sourceCommitSha ?? "")) {
    integrityIssues.push(`lane-artifact-descriptor-invalid:${lane}`);
  }
  const actualArtifact = loadedArtifact instanceof Map ? loadedArtifact.get(lane) : loadedArtifact;
  if (!actualArtifact || !actualArtifact.artifact) {
    integrityIssues.push(`lane-execution-artifact-missing-or-unreadable:${lane}`);
    qualificationIssues.push(`lane-execution-evidence-unverified:${lane}`);
    return { integrityIssues, qualificationIssues };
  }
  if (actualArtifact.sha256 !== descriptor?.contentSha256) integrityIssues.push(`lane-execution-artifact-digest-mismatch:${lane}`);
  const derived = deriveM7vExecutionArtifactEvidence({ lane, artifact: actualArtifact.artifact, requiredIdentities });
  if (derived.issues.length) qualificationIssues.push(...derived.issues.map((issue) => `${issue}:${lane}`));
  if (!identitySetEqual(requiredIdentities, derived.summary?.coveredIdentities ?? [])) qualificationIssues.push(`lane-evidence-coverage-incomplete:${lane}`);
  for (const counter of ["retries", "flaky", "incomplete", "failed", "skipped"]) {
    if (evidence[counter] !== derived.summary?.[counter]) integrityIssues.push(`lane-evidence-counter-not-derived:${lane}:${counter}`);
    if (derived.summary?.[counter] !== 0) qualificationIssues.push(`lane-evidence-outcomes-invalid:${lane}:${counter}`);
  }
  if (!identitySetEqual(requiredIdentities, evidence.coveredIdentities ?? [])) integrityIssues.push(`lane-evidence-covered-identities-not-derived:${lane}`);
  const provenanceIssues = verifyM7vRunnerArtifactProvenance({ lane, descriptor, artifact: actualArtifact.artifact,
    artifactContentSha256: actualArtifact.sha256, proof: runnerProof });
  if (provenanceIssues.length) qualificationIssues.push(...provenanceIssues.map((issue) => `${issue}:${lane}`));
  return { integrityIssues: unique(integrityIssues), qualificationIssues: unique(qualificationIssues) };
}

function resolveContainedFile(repositoryRoot, relativePath, allowedRoot) {
  if (typeof relativePath !== "string" || isAbsolute(relativePath)) return { path: null, issue: "outside" };
  const root = resolve(repositoryRoot, allowedRoot);
  const candidate = resolve(repositoryRoot, relativePath);
  const lexicalRelative = relative(root, candidate);
  if (!lexicalRelative || lexicalRelative.startsWith(`..${sep}`) || lexicalRelative === ".." || isAbsolute(lexicalRelative)) {
    return { path: null, issue: "outside" };
  }
  try {
    const realRoot = realpathSync(root);
    const realCandidate = realpathSync(candidate);
    const realRelative = relative(realRoot, realCandidate);
    if (!realRelative || realRelative.startsWith(`..${sep}`) || realRelative === ".." || isAbsolute(realRelative)) {
      return { path: null, issue: "outside" };
    }
    return { path: realCandidate, issue: null };
  } catch {
    return { path: null, issue: "missing" };
  }
}

export function loadM7vExecutionArtifacts(repositoryRoot, governanceReport) {
  const artifacts = new Map();
  for (const [lane, evidence] of Object.entries(governanceReport?.laneEvidence ?? {})) {
    const descriptor = evidence?.artifact;
    if (!descriptor || evidence.status !== "qualified") continue;
    const resolvedPath = resolveContainedFile(repositoryRoot, descriptor.storedPath, M7V_EXECUTION_ARTIFACT_ROOT);
    if (!resolvedPath.path) {
      const issue = resolvedPath.issue === "outside" ? "artifact-path-outside-policy" : "artifact-missing-or-invalid";
      artifacts.set(lane, { artifact: null, sha256: null, issue: `${issue}:${lane}` });
      continue;
    }
    try {
      const bytes = readFileSync(resolvedPath.path);
      const digest = sha256(bytes);
      if (digest !== descriptor.contentSha256) {
        artifacts.set(lane, { artifact: null, sha256: digest, issue: `artifact-content-digest-mismatch:${lane}` });
        continue;
      }
      const artifact = JSON.parse(bytes.toString("utf8"));
      artifacts.set(lane, { artifact, sha256: digest, bytes });
    } catch {
      artifacts.set(lane, { artifact: null, sha256: null, issue: `artifact-missing-or-invalid:${lane}` });
    }
  }
  return artifacts;
}

function ghApi(path, paginate = false) {
  const args = paginate ? ["api", "--paginate", "--slurp", path] : ["api", path];
  const result = spawnSync("gh", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error("authenticated GitHub verification is unavailable");
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error("authenticated GitHub verification returned malformed JSON");
  }
}

function currentGitHead(repositoryRoot) {
  const result = spawnSync("git", ["rev-parse", "--verify", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" });
  const sha = result.status === 0 ? result.stdout.trim() : "";
  return /^[a-f0-9]{40}$/.test(sha) ? sha : null;
}

function sourceTreeMatchesCurrent(repositoryRoot, sourceCommitSha) {
  if (!/^[a-f0-9]{40}$/.test(String(sourceCommitSha ?? "")) || !currentGitHead(repositoryRoot)) return false;
  const present = spawnSync("git", ["cat-file", "-e", `${sourceCommitSha}^{commit}`], { cwd: repositoryRoot });
  if (present.status !== 0) return false;
  const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", sourceCommitSha, "HEAD"], { cwd: repositoryRoot });
  if (ancestor.status !== 0) return false;
  const diff = spawnSync("git", ["diff", "--quiet", sourceCommitSha, "--", "src", "playwright.config.ts", "playwright.production.config.ts"], { cwd: repositoryRoot });
  if (diff.status !== 0) return false;
  const cached = spawnSync("git", ["diff", "--cached", "--quiet", sourceCommitSha, "--", "src", "playwright.config.ts", "playwright.production.config.ts"], { cwd: repositoryRoot });
  if (cached.status !== 0) return false;
  const status = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all", "--", "src", "playwright.config.ts", "playwright.production.config.ts"], { cwd: repositoryRoot, encoding: "utf8" });
  return status.status === 0 && status.stdout.trim() === "";
}

function pullNumberFromEvidenceUrl(value) {
  const match = /^https:\/\/github\.com\/chau-hm\/view-camera-simulator\/pull\/(\d+)$/.exec(String(value ?? ""));
  return match ? Number(match[1]) : null;
}

function authenticateM7vApprovals(repositoryRoot, matrixRows) {
  const approvedRows = matrixRows.filter((row) => row.approvalStatus === "approved");
  const proofs = new Map();
  if (!approvedRows.length) return { currentHeadSha: currentGitHead(repositoryRoot), proofs };
  const urls = new Map();
  for (const row of approvedRows) {
    const pullNumber = pullNumberFromEvidenceUrl(row.approvalEvidence);
    if (pullNumber) urls.set(pullNumber, row.approvalEvidence);
    else proofs.set(row.identity, { status: "unavailable" });
  }
  let repository;
  try {
    repository = ghApi(`repos/${M7V_REPOSITORY}`);
  } catch {
    for (const row of approvedRows) if (!proofs.has(row.identity)) proofs.set(row.identity, { status: "unavailable" });
    return { currentHeadSha: currentGitHead(repositoryRoot), proofs };
  }
  if (repository?.full_name !== M7V_REPOSITORY || repository?.owner?.login !== M7V_REPOSITORY_OWNER) {
    for (const row of approvedRows) proofs.set(row.identity, { status: "unavailable" });
    return { currentHeadSha: currentGitHead(repositoryRoot), proofs };
  }
  const pullData = new Map();
  for (const [pullNumber] of urls) {
    try {
      const [pull, reviews] = [
        ghApi(`repos/${M7V_REPOSITORY}/pulls/${pullNumber}`),
        ghApi(`repos/${M7V_REPOSITORY}/pulls/${pullNumber}/reviews?per_page=100`, true),
      ];
      pullData.set(pullNumber, {
        pull,
        reviews: Array.isArray(reviews) ? reviews.flat(Infinity) : [],
      });
    } catch {
      pullData.set(pullNumber, null);
    }
  }
  const permissionCache = new Map();
  for (const row of approvedRows) {
    const pullNumber = pullNumberFromEvidenceUrl(row.approvalEvidence);
    const data = pullData.get(pullNumber);
    const login = String(row.approvalDecision?.approver ?? "");
    if (!data || data.pull?.number !== pullNumber || data.pull?.base?.repo?.full_name !== M7V_REPOSITORY || !/^[A-Za-z0-9-]+$/.test(login)) {
      proofs.set(row.identity, { status: "unavailable" });
      continue;
    }
    if (!permissionCache.has(login)) {
      try {
        const result = ghApi(`repos/${M7V_REPOSITORY}/collaborators/${encodeURIComponent(login)}/permission`);
        permissionCache.set(login, result?.permission ?? null);
      } catch {
        permissionCache.set(login, null);
      }
    }
    const actorPermission = permissionCache.get(login);
    proofs.set(row.identity, {
      status: actorPermission ? "loaded" : "unavailable",
      repository: M7V_REPOSITORY,
      repositoryOwner: repository.owner.login,
      pullNumber,
      actorPermission,
      reviews: data.reviews,
    });
  }
  return { currentHeadSha: currentGitHead(repositoryRoot), proofs };
}

function authenticateM7vRunnerArtifact(repositoryRoot, lane, descriptor) {
  if (!descriptor || !Number.isInteger(descriptor.runId) || !Number.isInteger(descriptor.artifactId) ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{2,100}$/.test(String(descriptor.artifactName ?? ""))) return { status: "unavailable" };
  let run;
  let artifacts;
  try {
    run = ghApi(`repos/${M7V_REPOSITORY}/actions/runs/${descriptor.runId}`);
    const response = ghApi(`repos/${M7V_REPOSITORY}/actions/runs/${descriptor.runId}/artifacts?per_page=100`);
    artifacts = response?.artifacts ?? [];
  } catch {
    return { status: "unavailable" };
  }
  const matches = artifacts.filter((item) => item.id === descriptor.artifactId && item.name === descriptor.artifactName);
  if (matches.length !== 1) return { status: "unavailable" };
  const artifactInfo = matches[0];
  const root = mkdtempSync(join(tmpdir(), "m7v-runner-artifact-"));
  try {
    const download = spawnSync("gh", ["run", "download", String(descriptor.runId), "--name", descriptor.artifactName, "--dir", root], {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    if (download.error || download.status !== 0) return { status: "unavailable" };
    const artifactPath = resolveContainedFile(root, descriptor.artifactFile, ".").path;
    const stored = loadM7vExecutionArtifacts(repositoryRoot, { laneEvidence: { [lane]: { status: "qualified", artifact: descriptor } } }).get(lane);
    if (!artifactPath || !stored?.artifact || !stored.bytes) return { status: "unavailable" };
    const downloadedBytes = readFileSync(artifactPath);
    const downloadedDigest = sha256(downloadedBytes);
    if (downloadedDigest !== descriptor.contentSha256 || !downloadedBytes.equals(stored.bytes)) return { status: "unavailable" };
    let artifact;
    try { artifact = JSON.parse(downloadedBytes.toString("utf8")); } catch { return { status: "unavailable" }; }
    return {
      status: "loaded",
      repository: M7V_REPOSITORY,
      sourceTreeMatchesCurrent: sourceTreeMatchesCurrent(repositoryRoot, descriptor.sourceCommitSha),
      run,
      artifact: artifactInfo,
    };
  } catch {
    return { status: "unavailable" };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export function loadM7vTrustedVerificationInputs(repositoryRoot, input, mode) {
  const verifiedApprovalsByIdentity = new Map();
  const verifiedRunnerArtifactsByLane = new Map();
  if (!new Set(["require-approved", "require-qualified"]).has(mode)) {
    return { currentHeadSha: currentGitHead(repositoryRoot), verifiedApprovalsByIdentity, verifiedRunnerArtifactsByLane };
  }
  const approvalEvidence = authenticateM7vApprovals(repositoryRoot, input.matrix?.identities ?? []);
  for (const [identity, proof] of approvalEvidence.proofs) verifiedApprovalsByIdentity.set(identity, proof);
  if (mode === "require-qualified") {
    for (const lane of ["ordinary-webgl", "renderer-serial", "native-webgpu", "production-preview"]) {
      const evidence = input.governanceReport?.laneEvidence?.[lane];
      if (evidence?.status === "qualified") {
        verifiedRunnerArtifactsByLane.set(lane, authenticateM7vRunnerArtifact(repositoryRoot, lane, evidence.artifact));
      }
    }
  }
  return {
    currentHeadSha: approvalEvidence.currentHeadSha,
    verifiedApprovalsByIdentity,
    verifiedRunnerArtifactsByLane,
  };
}

export function evaluateM7vE2eQualification(input) {
  const integrityIssues = [];
  const approvalIssues = [];
  const qualificationIssues = [];
  const { historicalReport, historicalReportSha256, matrix, reconciliation, discoveryProfiles, sourceEvidenceByIdentity,
    sourceDeclarationBaselineByIdentity, sourceDeclarationBaselineCommitSha, sourceDeclarationBaselineIssues = [],
    verifiedApprovalsByIdentity = new Map(), executionArtifactsByLane = new Map(), verifiedRunnerArtifactsByLane = new Map(),
    currentHeadSha = null, packageManifest, governanceReport, playwrightConfigurationEvidence, mode = "validate-policy" } = input;
  const historicalIdentities = historicalReport?.actionPlan?.[2]?.affectedIdentities ?? [];
  const historicalRows = historicalReport?.testInventory ?? [];
  const historySkips = historicalRows.filter((row) => row.historicalM7KStatus?.actualStatus === "skipped").map((row) => row.canonicalIdentity);
  const matrixRows = matrix?.identities ?? [];
  const matrixIdentities = matrixRows.map((row) => row.identity);

  addIssue(integrityIssues, historicalReportSha256 === matrix?.provenance?.historicalM7rReportSha256, "m7r-historical-report-digest-mismatch");
  addIssue(integrityIssues, historicalReport?.provenance?.executionSourceCommitSha === matrix?.provenance?.historicalM7rExecutionSourceCommitSha, "m7r-historical-execution-source-mismatch");
  addIssue(integrityIssues, stable(playwrightConfigurationEvidence) === stable(reconciliation?.playwrightConfigurationEvidence), "m7v-playwright-lane-or-build-flag-contract-drift");
  addIssue(integrityIssues, sourceDeclarationBaselineCommitSha === M7V_SOURCE_DECLARATION_BASELINE_COMMIT &&
    governanceReport?.provenance?.sourceDeclarationBaselineCommitSha === M7V_SOURCE_DECLARATION_BASELINE_COMMIT,
  "m7v-source-declaration-baseline-revision-mismatch");
  addIssue(integrityIssues, governanceReport?.schemaVersion === 2 &&
    governanceReport?.policyRevision === M7V_POLICY_REVISION &&
    governanceReport?.provenance?.evaluatorRevision === M7V_POLICY_REVISION,
  "m7v-policy-revision-mismatch");
  integrityIssues.push(...sourceDeclarationBaselineIssues);
  addIssue(integrityIssues, historicalReport?.summary?.discovered === 278 && historicalReport?.summary?.passed === 118 &&
    historicalReport?.summary?.unexpected === 85 && historicalReport?.summary?.skipped === 75 &&
    historicalReport?.summary?.retries === 0 && historicalReport?.summary?.incomplete === 0,
  "m7r-historical-baseline-mutated");
  addIssue(integrityIssues, historicalReport?.skipAudit?.historicalSkipped === 75 &&
    historicalReport?.skipAudit?.individuallyRechecked === 75 && historicalReport?.skipAudit?.currentSkipped === 75 &&
    historicalReport?.skipAudit?.approvedExclusions === 0, "m7r-historical-skip-audit-mutated");
  addIssue(integrityIssues, historicalIdentities.length === 75 && new Set(historicalIdentities).size === 75, "m7r-historical-action-plan-skip-inventory-invalid");
  addIssue(integrityIssues, identitySetEqual(historicalIdentities, historySkips), "m7r-historical-skips-do-not-match-test-inventory");
  addIssue(integrityIssues, matrixRows.length === 75 && new Set(matrixIdentities).size === 75, "m7v-historical-identity-matrix-incomplete-or-duplicated");
  addIssue(integrityIssues, identitySetEqual(historicalIdentities, matrixIdentities), "m7v-historical-identities-do-not-match-m7r-source");

  const recordById = new Map((reconciliation?.profiles?.standard?.tests ?? []).map((record) => [record.identity, record]));
  const historicalRecordById = new Map(historicalRows.map((record) => [record.canonicalIdentity, record]));
  const matrixById = new Map(matrixRows.map((record) => [record.identity, record]));
  const currentDefaultIds = expectedProfileIdentities(reconciliation?.profiles?.standard);
  const historicalIds = historicalRows.map((record) => record.canonicalIdentity);
  const computedDiff = sortedIdentityDiff(historicalIds, currentDefaultIds);
  const recordedCurrentDiff = reconciliation?.reconciliation?.currentDiff ?? {};
  addIssue(integrityIssues, stable(computedDiff.added) === stable(sorted(recordedCurrentDiff.added ?? [])) &&
    stable(computedDiff.removed) === stable(sorted(recordedCurrentDiff.removed ?? [])), "m7v-discovery-reconciliation-metadata-invalid");
  const recordedM7uAdds = sorted(reconciliation?.reconciliation?.m7uAddedIdentities ?? []);
  addIssue(integrityIssues, stable(recordedM7uAdds) === stable(sorted(M7V_M7U_ADDITIONS)) &&
    M7V_M7U_ADDITIONS.every((identity) => currentDefaultIds.includes(identity)), "m7u-added-identities-not-explicitly-reconciled");
  addIssue(integrityIssues, M7V_M7U_ADDITIONS.every((identity) => computedDiff.added.includes(identity)), "m7u-additions-do-not-reconcile-to-current-inventory");

  for (const [profile, expected] of Object.entries(reconciliation?.profiles ?? {})) {
    const actual = discoveryProfiles?.[profile] ?? [];
    const expectedIds = expectedProfileIdentities(expected);
    const actualIds = actual.map((test) => test.identity);
    const diff = sortedIdentityDiff(expectedIds, actualIds);
    if (diff.added.length || diff.removed.length || expectedIds.length !== actualIds.length || new Set(actualIds).size !== actualIds.length) {
      integrityIssues.push(`m7v-current-discovery-drift:${profile}:added=${diff.added.length}:removed=${diff.removed.length}`);
    }
    const expectedCounts = expected.projectCounts ?? {};
    const actualCounts = actual.reduce((counts, test) => {
      counts[test.project] = (counts[test.project] ?? 0) + 1;
      return counts;
    }, {});
    if (stable(expectedCounts) !== stable(actualCounts)) integrityIssues.push(`m7v-project-discovery-count-drift:${profile}`);
  }

  const actualStandardIds = discoveryProfiles?.standard?.map((test) => test.identity) ?? [];
  const expectedDefaultIds = currentDefaultIds;
  if (!identitySetEqual(actualStandardIds, expectedDefaultIds)) integrityIssues.push("m7v-default-test-inventory-drift");
  for (const identity of actualStandardIds) {
    const current = sourceEvidenceByIdentity.get(identity);
    const baseline = sourceDeclarationBaselineByIdentity?.get(identity);
    if (!current?.declarationSignature || !baseline) {
      integrityIssues.push(`m7v-source-declaration-baseline-unavailable:${identity}`);
      continue;
    }
    if (Array.isArray(current.unsupportedPatterns) && current.unsupportedPatterns.length > 0) {
      for (const pattern of current.unsupportedPatterns) integrityIssues.push(`m7v-unsupported-source-skip-pattern:${identity}:${pattern}`);
    }
    if (stable(current.declarationSignature) !== stable(baseline)) {
      integrityIssues.push(`m7v-source-declaration-changed-from-reviewed-baseline:${identity}`);
    }
  }
  const actualSourceSkipIds = sorted([...sourceEvidenceByIdentity.entries()]
    .filter(([, evidence]) => evidence.skipConditions.length > 0).map(([identity]) => identity));
  const profileGuardRows = reconciliation?.reconciliation?.sourceGuardAudit?.projectConditionalSkipGuards ?? [];
  const profileGuardIds = profileGuardRows.map((row) => row.identity);
  addIssue(integrityIssues, identitySetEqual(actualSourceSkipIds, [...historicalIdentities, ...profileGuardIds]), "m7v-source-skip-identity-set-drift");

  for (const row of matrixRows) {
    const inventoryRecord = historicalRows.find((record) => record.canonicalIdentity === row.identity);
    if (row.historicalCategory !== inventoryRecord?.currentSkipAudit?.proposedCategory) {
      integrityIssues.push(`m7v-historical-category-mutated:${row.identity}`);
    }
    if (row.historicalAnnotationReason !== inventoryRecord?.currentSkipAudit?.reason ||
        row.annotationReasonMatchesSource !== row.actualSkipConditions?.some((condition) => condition.reason === row.historicalAnnotationReason)) {
      integrityIssues.push(`m7v-historical-skip-annotation-reconciliation-invalid:${row.identity}`);
    }
  }

  for (const row of matrixRows) {
    const inventoryRecord = recordById.get(row.identity);
    const evidence = sourceEvidenceByIdentity.get(row.identity);
    const expectedBuildRequirements = deriveM7vBuildFlagRequirements(evidence?.requiredEnvironment ?? [], evidence?.requiredBuildFlags ?? []);
    if (!inventoryRecord) integrityIssues.push(`m7v-matrix-identity-not-in-current-inventory:${row.identity}`);
    if (!evidence || !compareSourceEvidence(row.sourceEvidence, evidence)) {
      integrityIssues.push(`m7v-source-skip-condition-mismatch:${row.identity}`);
    }
    if (row.historicalM7rOutcome !== "skipped") integrityIssues.push(`m7v-historical-outcome-mutated:${row.identity}`);
    if (!M7V_LANES.includes(row.proposedLane)) integrityIssues.push(`m7v-invalid-lane:${row.identity}`);
    if (!Array.isArray(row.requiredEnvironment) || !Array.isArray(row.requiredBuildFlags) ||
        !Array.isArray(row.actualSkipConditions) || row.actualSkipConditions.length === 0) {
      integrityIssues.push(`m7v-required-environment-missing:${row.identity}`);
    }
    if (stable(row.actualSkipConditions) !== stable(evidence?.skipConditions) ||
        stable(row.requiredEnvironment) !== stable(evidence?.requiredEnvironment) ||
        stable(row.requiredBuildFlags) !== stable(expectedBuildRequirements.requiredBuildFlags) ||
        stable(row.conditionalBuildFlagAssignments) !== stable(expectedBuildRequirements.conditionalBuildFlagAssignments) ||
        row.actualSkipCondition !== row.actualSkipConditions?.map((gate) => `${gate.scope}: ${gate.condition ?? gate.sourceText}`).join(" ; ")) {
      integrityIssues.push(`m7v-source-condition-requirements-mismatch:${row.identity}`);
    }
    const sourceLane = row.historicalCategory === "development-or-research-only" ? "research-development" : "native-webgpu";
    if (row.proposedLane !== sourceLane) integrityIssues.push(`m7v-source-lane-assignment-inconsistent:${row.identity}`);
    if (row.proposedLane === "native-webgpu") {
      if (row.laneRequirement !== "conditional-mandatory" || row.requiredPlaywrightProject !== "chrome-native-webgpu" ||
          row.nativeRuntimeRequirement?.executionApi !== "webgpu" || row.nativeRuntimeRequirement?.acceptWebGlCompatibilityBackend !== false ||
          row.nativeRuntimeRequirement?.rendererFamily !== "webgpu-renderer" || row.nativeRuntimeRequirement?.headless !== false ||
          row.nativeRuntimeRequirement?.applicationFallback !== false ||
          !row.requiredEnvironment?.some((name) => /NATIVE_WEBGPU_REQUIRED$/.test(name)) ||
          !String(row.executionEntrypoint ?? "").includes("--project=chrome-native-webgpu")) {
        integrityIssues.push(`m7v-native-lane-obligation-incomplete:${row.identity}`);
      }
    } else if (row.proposedLane === "research-development") {
      if (row.laneRequirement !== "research-only" || !row.executionEntrypoint ||
          !row.requiredEnvironment?.length ||
          (row.identity.includes("dream-loop-capture.spec.ts") && !String(row.executionEntrypoint).startsWith("npm run dream-loop:capture -- --pilot <" ) ) ||
          (row.identity.includes("scene-capacity-benchmark.spec.ts") && row.executionEntrypoint !== "npm run benchmark:scene-capacity")) {
        integrityIssues.push(`m7v-research-lane-entrypoint-missing:${row.identity}`);
      }
    }
    if (row.approvalStatus === "approved" && (
      typeof row.approvalEvidence !== "string" ||
      !/^https:\/\/github\.com\/chau-hm\/view-camera-simulator\/pull\/\d+$/.test(row.approvalEvidence) ||
      !row.approvalDecision ||
      typeof row.approvalDecision.approver !== "string" || row.approvalDecision.approver.trim().length < 2 ||
      !["admin", "maintain"].includes(row.approvalDecision.authority) ||
      row.approvalDecision.scope !== row.identity ||
      row.approvalDecision.policyRevision !== M7V_POLICY_REVISION ||
      typeof row.approvalDecision.rationale !== "string" || row.approvalDecision.rationale.trim().length < 12
    )) {
      integrityIssues.push(`m7v-approval-evidence-missing:${row.identity}`);
    }
    if (row.approvalStatus === "pending" && (row.approvalEvidence !== null || row.approvalDecision !== null)) {
      integrityIssues.push(`m7v-pending-approval-has-evidence:${row.identity}`);
    }
    if (row.approvalStatus === "rejected" && (
      typeof row.approvalEvidence !== "string" ||
      !/^https:\/\/github\.com\/chau-hm\/view-camera-simulator\/pull\/\d+$/.test(row.approvalEvidence) ||
      !row.approvalDecision || row.approvalDecision.scope !== row.identity || row.approvalDecision.policyRevision !== M7V_POLICY_REVISION
    )) integrityIssues.push(`m7v-rejection-evidence-missing:${row.identity}`);
    if (!["pending", "approved", "rejected"].includes(row.approvalStatus)) integrityIssues.push(`m7v-invalid-approval-state:${row.identity}`);
    if (row.currentValidationStatus !== "not-run" && row.currentValidationStatus !== "blocked" &&
        row.currentValidationStatus !== "validated" && row.currentValidationStatus !== "unresolved") {
      integrityIssues.push(`m7v-invalid-validation-state:${row.identity}`);
    }
    if (row.currentValidationStatus === "validated" && row.validationEvidence == null) {
      integrityIssues.push(`m7v-validation-evidence-missing:${row.identity}`);
    }
  }

  const standardByIdentity = new Map((reconciliation?.profiles?.standard?.tests ?? []).map((test) => [test.identity, test]));
  const nativeByUnprojectedIdentity = new Map((reconciliation?.profiles?.native?.tests ?? []).map((test) => [
    `${test.relativeSpecPath}::${test.titlePath.join("::")}`,
    test,
  ]));
  for (const guard of profileGuardRows) {
    const source = sourceEvidenceByIdentity.get(guard.identity);
    const ordinary = standardByIdentity.get(guard.identity);
    const native = nativeByUnprojectedIdentity.get(`${ordinary?.relativeSpecPath}::${ordinary?.titlePath?.join("::")}`);
    if (!source || !compareSourceEvidence(guard.sourceEvidence, source) || source.skipConditions.length === 0) {
      integrityIssues.push(`m7v-profile-conditional-source-guard-mismatch:${guard.identity}`);
    }
    if (!ordinary || ordinary.project !== "chromium" || ordinary.lane !== "ordinary-webgl" || !native || native.project !== "chrome-native-webgpu") {
      integrityIssues.push(`m7v-profile-conditional-skip-boundary-invalid:${guard.identity}`);
    }
    if (guard.historicalM7rOutcome !== historicalRecordById.get(guard.identity)?.currentActualStatus ||
        guard.standardProjectDisposition !== "ordinary-webgl-covered" ||
        guard.nativeProjectDisposition !== "source-guarded-not-part-of-native-required-capture") {
      integrityIssues.push(`m7v-profile-conditional-skip-classification-invalid:${guard.identity}`);
    }
    const nativeGateInSource = source?.skipConditions.some((condition) =>
      /native(?:WebGpu)?Required|nativeWebGPURequired/i.test(condition.condition ?? "")) ?? false;
    if (!nativeGateInSource || !(source?.requiredEnvironment ?? []).some((name) => /NATIVE_WEBGPU_REQUIRED$/.test(name))) {
      integrityIssues.push(`m7v-profile-conditional-skip-is-not-native-gated:${guard.identity}`);
    }
    if (source?.skipConditions.length !== 1 || !["nativeRequired", "nativeWebGpuRequired"].includes(source.skipConditions[0]?.condition ?? "")) {
      integrityIssues.push(`m7v-profile-conditional-skip-not-exclusive-to-native-project:${guard.identity}`);
    }
  }

  for (const test of reconciliation?.profiles?.standard?.tests ?? []) {
    const row = matrixById.get(test.identity);
    const expectedLane = row?.proposedLane ?? (test.project === "chromium-renderer-serial" ? "renderer-serial" : "ordinary-webgl");
    const expectedRequirement = row?.laneRequirement ?? "mandatory";
    if (test.lane !== expectedLane) integrityIssues.push(`m7v-current-lane-assignment-drift:${test.identity}`);
    if (test.laneRequirement !== expectedRequirement) integrityIssues.push(`m7v-current-lane-requirement-drift:${test.identity}`);
    if (!M7V_LANES.includes(test.lane)) integrityIssues.push(`m7v-current-test-lane-missing:${test.identity}`);
    if ((test.project === "chromium" && !row && test.lane !== "ordinary-webgl") ||
        (test.project === "chromium-renderer-serial" && test.lane !== "renderer-serial")) {
      integrityIssues.push(`m7v-default-project-lane-mismatch:${test.identity}`);
    }
  }

  const laneCounts = (reconciliation?.profiles?.standard?.tests ?? []).reduce((counts, test) => {
    counts[test.lane] = (counts[test.lane] ?? 0) + 1;
    return counts;
  }, {});
  addIssue(integrityIssues, stable(laneCounts) === stable(reconciliation?.reconciliation?.laneAssignmentCounts), "m7v-lane-assignment-counts-invalid");

  integrityIssues.push(...packageScriptIssues(packageManifest));
  for (const [target, available] of Object.entries(input.packageScriptTargetAvailability ?? {})) {
    if (available !== true) integrityIssues.push(`required-package-script-target-missing:${target}`);
  }

  const authorization = governanceReport?.qualification ?? {};
  addIssue(integrityIssues, authorization.broadE2e === "not-qualified" && authorization.m7 === "partially-qualified" &&
    authorization.m8Entry === "denied" && authorization.spontaneousExternalGpuDeviceLoss === "blocked" &&
    authorization.productionGroundGlass === "WebGL-only" && authorization.productionWebGpu === "disabled",
  "m7v-qualification-boundaries-mutated");
  addIssue(integrityIssues, governanceReport?.historicalM7r?.discovered === 278 && governanceReport?.historicalM7r?.passed === 118 &&
    governanceReport?.historicalM7r?.unexpected === 85 && governanceReport?.historicalM7r?.skipped === 75,
  "m7v-report-historical-counts-mutated");

  const pendingApprovals = matrixRows.filter((row) => row.approvalStatus === "pending");
  const rejectedApprovals = matrixRows.filter((row) => row.approvalStatus === "rejected");
  const approvalSummary = {
    pending: pendingApprovals.length,
    approved: matrixRows.filter((row) => row.approvalStatus === "approved").length,
    rejected: rejectedApprovals.length,
  };
  if (pendingApprovals.length > 0) approvalIssues.push(`owner-approval-pending:${pendingApprovals.length}`);
  if (rejectedApprovals.length > 0) approvalIssues.push(`owner-approval-rejected:${rejectedApprovals.length}`);
  for (const row of matrixRows.filter((entry) => entry.approvalStatus === "approved")) {
    const proof = verifiedApprovalsByIdentity.get(row.identity);
    const verification = verifyM7vApprovalReview({
      identity: row.identity,
      evidenceUrl: row.approvalEvidence,
      decision: row.approvalDecision,
      currentHeadSha,
      proof,
    });
    if (verification.length) approvalIssues.push(...verification.map((issue) => `${issue}:${row.identity}`));
  }

  const allCurrentTests = reconciliation?.profiles?.standard?.tests ?? [];
  const requiredIdentitiesByLane = Object.fromEntries(M7V_LANES.map((lane) => [
    lane,
    allCurrentTests.filter((test) => test.lane === lane).map((test) => test.identity),
  ]));
  const nativeRequiredKeys = new Set(requiredIdentitiesByLane["native-webgpu"].map(canonicalTestKey));
  requiredIdentitiesByLane["native-webgpu"] = expectedProfileIdentities(reconciliation?.profiles?.native)
    .filter((identity) => nativeRequiredKeys.has(canonicalTestKey(identity)));
  requiredIdentitiesByLane["production-preview"] = expectedProfileIdentities(reconciliation?.profiles?.production);
  const laneEvidence = governanceReport?.laneEvidence ?? {};
  for (const lane of M7V_LANES) {
    if (!identitySetEqual(requiredIdentitiesByLane[lane] ?? [], laneEvidence[lane]?.requiredIdentities ?? [])) {
      integrityIssues.push(`lane-required-identities-not-derived:${lane}`);
    }
  }
  if (!identitySetEqual(requiredIdentitiesByLane["production-preview"], laneEvidence["production-preview"]?.requiredIdentities ?? [])) {
    integrityIssues.push("lane-required-identities-not-derived:production-preview");
  }
  for (const lane of ["ordinary-webgl", "renderer-serial", "native-webgpu", "production-preview"]) {
    const laneArtifact = executionArtifactsByLane instanceof Map ? executionArtifactsByLane.get(lane) : executionArtifactsByLane?.[lane];
    const runnerProof = verifiedRunnerArtifactsByLane instanceof Map ? verifiedRunnerArtifactsByLane.get(lane) : verifiedRunnerArtifactsByLane?.[lane];
    const laneIssues = extractOutcomeCoverageIssues(lane, laneEvidence[lane], requiredIdentitiesByLane[lane] ?? [], laneArtifact, runnerProof);
    qualificationIssues.push(...laneIssues.qualificationIssues);
    integrityIssues.push(...laneIssues.integrityIssues);
  }
  const qualificationStatus = governanceReport?.qualification?.broadE2e;
  if (qualificationStatus !== "not-qualified") qualificationIssues.push("broad-e2e-qualification-must-remain-not-qualified");

  const modeIssues = mode === "require-approved"
    ? [...approvalIssues]
    : mode === "require-qualified"
      ? [...approvalIssues, ...qualificationIssues]
      : mode === "validate-policy" ? [] : ["m7v-unknown-cli-mode"];
  const policyIntegrityStatus = integrityIssues.length === 0 ? "passed" : "failed";
  const approvalStatus = approvalIssues.length === 0 ? "approved" : "pending-approval";
  const laneQualificationStatus = qualificationIssues.length === 0 ? "qualified" : "not-qualified";
  return {
    mode,
    integrityIssues: unique(integrityIssues),
    approvalIssues: unique(approvalIssues),
    qualificationIssues: unique(qualificationIssues),
    modeIssues: unique(modeIssues),
    policyIntegrityStatus,
    approvalStatus,
    laneQualificationStatus,
    qualificationStatus,
    approvalSummary,
    laneCounts,
    requiredIdentitiesByLane,
    currentInventoryCount: currentDefaultIds.length,
    m7rCurrentDiff: computedDiff,
    passed: modeIssues.length === 0 && integrityIssues.length === 0,
  };
}

export function loadM7vPolicyInputs(repositoryRoot = projectRoot) {
  const historicalPath = resolve(repositoryRoot, "docs/architecture/GROUND_GLASS_M7R_BROAD_E2E_QUALIFICATION_RECOVERY_REPORT.json");
  const matrixPath = resolve(repositoryRoot, "docs/architecture/ground-glass-m7v-skip-governance/historical-75-identity-matrix.json");
  const reconciliationPath = resolve(repositoryRoot, "docs/architecture/ground-glass-m7v-skip-governance/current-inventory-reconciliation.json");
  const governanceReportPath = resolve(repositoryRoot, "docs/architecture/GROUND_GLASS_M7V_E2E_SKIP_GOVERNANCE_REPORT.json");
  const historicalBytes = readFileSync(historicalPath);
  const packageManifest = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
  const requiredPackageTargets = [
    "scripts/run-m7v-qualification.mjs",
    "scripts/dream-loop/capture.mjs",
    "scripts/run-scene-capacity-benchmark.mjs",
  ];
  const historicalReport = JSON.parse(historicalBytes.toString("utf8"));
  const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
  const reconciliation = JSON.parse(readFileSync(reconciliationPath, "utf8"));
  const governanceReport = JSON.parse(readFileSync(governanceReportPath, "utf8"));
  return {
    historicalReport,
    historicalReportSha256: sha256(historicalBytes),
    matrix,
    reconciliation,
    governanceReport,
    packageManifest,
    packageScriptTargetAvailability: Object.fromEntries(requiredPackageTargets.map((path) => [path, existsSync(resolve(repositoryRoot, path))])),
    playwrightConfigurationEvidence: collectM7vPlaywrightConfigurationEvidence(repositoryRoot),
  };
}

export function summarizeM7vInventory(profiles) {
  return Object.fromEntries(Object.entries(profiles).map(([name, tests]) => {
    const projectCounts = tests.reduce((counts, test) => {
      counts[test.project] = (counts[test.project] ?? 0) + 1;
      return counts;
    }, {});
    return [name, { discovered: tests.length, projectCounts, identities: tests.map((test) => test.identity) }];
  }));
}
