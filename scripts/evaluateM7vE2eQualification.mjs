import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const ts = require("typescript");

export const M7V_POLICY_REVISION = "m7v-e2e-skip-governance-v1";
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
    ["test.describe", "test.describe.serial", "test.describe.parallel"].includes(callName(call.expression)) &&
    typeof call.arguments[0] !== "undefined" && callbackArgument(call, -1) !== null;
}

function isSkipGate(call) {
  return ts.isCallExpression(call) && callName(call.expression) === "test.skip" && !callbackArgument(call, 1);
}

function sourceLine(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function serializeSkipGate(gate, sourceFile) {
  const call = gate.node;
  return {
    line: sourceLine(sourceFile, call),
    scope: gate.scope,
    sourceText: call.getText(sourceFile),
    condition: call.arguments[0]?.getText(sourceFile) ?? null,
    reason: typeof call.arguments[1]?.text === "string" ? call.arguments[1].text : null,
  };
}

function collectBodySkipGates(body) {
  const gates = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && (isTestDefinition(node) || isDescribeDefinition(node))) return;
    if (ts.isCallExpression(node) && isSkipGate(node)) gates.push({ node, scope: "test" });
    ts.forEachChild(node, visit);
  };
  if (body) visit(body);
  return gates;
}

function scanTestDefinitions(sourceFile) {
  const byLine = new Map();
  const record = (call, inheritedGates) => {
    const body = callbackArgument(call, -1)?.body;
    const line = sourceLine(sourceFile, call);
    const definition = {
      line,
      callName: callName(call.expression),
      titleExpression: call.arguments[0]?.getText(sourceFile) ?? "",
    };
    const gates = [
      ...inheritedGates,
      ...collectBodySkipGates(body),
    ].map((gate) => serializeSkipGate(gate, sourceFile));
    const entries = byLine.get(line) ?? [];
    entries.push({ definition, skipConditions: gates });
    byLine.set(line, entries);
  };
  const scanNested = (node, inheritedGates) => {
    if (ts.isBlock(node)) {
      scanStatements(node.statements, inheritedGates);
      return;
    }
    if (ts.isCallExpression(node) && isDescribeDefinition(node)) {
      const body = callbackArgument(node, -1)?.body;
      if (body && ts.isBlock(body)) scanStatements(body.statements, inheritedGates);
      return;
    }
    if (ts.isCallExpression(node) && isTestDefinition(node)) {
      record(node, inheritedGates);
      return;
    }
    if (ts.isCallExpression(node) && isSkipGate(node)) return;
    ts.forEachChild(node, (child) => scanNested(child, inheritedGates));
  };
  const scanStatements = (statements, inheritedGates) => {
    let activeGates = [...inheritedGates];
    for (const statement of statements) {
      if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && isSkipGate(statement.expression)) {
        activeGates = [...activeGates, { node: statement.expression, scope: "suite" }];
        continue;
      }
      if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && isDescribeDefinition(statement.expression)) {
        const body = callbackArgument(statement.expression, -1)?.body;
        if (body && ts.isBlock(body)) scanStatements(body.statements, activeGates);
        continue;
      }
      if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && isTestDefinition(statement.expression)) {
        record(statement.expression, activeGates);
        continue;
      }
      scanNested(statement, activeGates);
    }
  };
  scanStatements(sourceFile.statements, []);
  return byLine;
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
    const definitions = entry.definitions.get(line) ?? [];
    if (definitions.length !== 1) {
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
      ...required,
    });
  }
  return evidenceByIdentity;
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

function extractOutcomeCoverageIssues(lane, evidence, requiredIdentities) {
  const issues = [];
  if (!evidence || evidence.status !== "qualified") {
    issues.push(`lane-not-qualified:${lane}:${evidence?.status ?? "missing"}`);
    return issues;
  }
  if (!evidence.artifact || !Array.isArray(evidence.coveredIdentities) ||
      !identitySetEqual(requiredIdentities, evidence.coveredIdentities)) {
    issues.push(`lane-evidence-coverage-incomplete:${lane}`);
  }
  if (evidence.retries !== 0 || evidence.flaky !== 0 || evidence.incomplete !== 0 ||
      evidence.failed !== 0 || evidence.skipped !== 0) {
    issues.push(`lane-evidence-outcomes-invalid:${lane}`);
  }
  if (lane === "native-webgpu" && (
    evidence.rendererFamily !== "webgpu-renderer" || evidence.executionApi !== "webgpu" ||
    evidence.applicationFallback !== false || evidence.webglCompatibilityBackend !== false
  )) {
    issues.push("native-lane-runtime-identity-unverified");
  }
  if (lane === "ordinary-webgl" && evidence.executionApi !== "webgl2") {
    issues.push("ordinary-webgl-lane-runtime-identity-unverified");
  }
  if (lane === "production-preview" && evidence.executionApi !== "webgl2") {
    issues.push("production-preview-webgl-isolation-unverified");
  }
  return issues;
}

export function evaluateM7vE2eQualification(input) {
  const integrityIssues = [];
  const approvalIssues = [];
  const qualificationIssues = [];
  const { historicalReport, historicalReportSha256, matrix, reconciliation, discoveryProfiles, sourceEvidenceByIdentity, packageManifest, governanceReport, playwrightConfigurationEvidence, mode = "validate-policy" } = input;
  const historicalIdentities = historicalReport?.actionPlan?.[2]?.affectedIdentities ?? [];
  const historicalRows = historicalReport?.testInventory ?? [];
  const historySkips = historicalRows.filter((row) => row.historicalM7KStatus?.actualStatus === "skipped").map((row) => row.canonicalIdentity);
  const matrixRows = matrix?.identities ?? [];
  const matrixIdentities = matrixRows.map((row) => row.identity);

  addIssue(integrityIssues, historicalReportSha256 === matrix?.provenance?.historicalM7rReportSha256, "m7r-historical-report-digest-mismatch");
  addIssue(integrityIssues, historicalReport?.provenance?.executionSourceCommitSha === matrix?.provenance?.historicalM7rExecutionSourceCommitSha, "m7r-historical-execution-source-mismatch");
  addIssue(integrityIssues, stable(playwrightConfigurationEvidence) === stable(reconciliation?.playwrightConfigurationEvidence), "m7v-playwright-lane-or-build-flag-contract-drift");
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
      !/^https:\/\/github\.com\/chau-hm\/view-camera-simulator\/(?:pull|issues)\/\d+/.test(row.approvalEvidence) ||
      !row.approvalDecision ||
      typeof row.approvalDecision.approver !== "string" || row.approvalDecision.approver.trim().length < 2 ||
      typeof row.approvalDecision.authority !== "string" || row.approvalDecision.authority.trim().length < 3 ||
      typeof row.approvalDecision.scope !== "string" || !row.approvalDecision.scope.includes(row.identity) ||
      typeof row.approvalDecision.rationale !== "string" || row.approvalDecision.rationale.trim().length < 12 ||
      !Number.isFinite(Date.parse(row.approvalDecision.decidedAt ?? ""))
    )) {
      integrityIssues.push(`m7v-approval-evidence-missing:${row.identity}`);
    }
    if (row.approvalStatus === "pending" && (row.approvalEvidence !== null || row.approvalDecision !== null)) {
      integrityIssues.push(`m7v-pending-approval-has-evidence:${row.identity}`);
    }
    if (row.approvalStatus === "rejected" && (
      typeof row.approvalEvidence !== "string" ||
      !/^https:\/\/github\.com\/chau-hm\/view-camera-simulator\/(?:pull|issues)\/\d+/.test(row.approvalEvidence) ||
      !row.approvalDecision || typeof row.approvalDecision.scope !== "string" || !row.approvalDecision.scope.includes(row.identity)
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

  const allCurrentTests = reconciliation?.profiles?.standard?.tests ?? [];
  const requiredIdentitiesByLane = Object.fromEntries(M7V_LANES.map((lane) => [
    lane,
    allCurrentTests.filter((test) => test.lane === lane).map((test) => test.identity),
  ]));
  requiredIdentitiesByLane["production-preview"] = expectedProfileIdentities(reconciliation?.profiles?.production);
  const laneEvidence = governanceReport?.laneEvidence ?? {};
  for (const lane of ["ordinary-webgl", "renderer-serial", "native-webgpu", "production-preview"]) {
    qualificationIssues.push(...extractOutcomeCoverageIssues(lane, laneEvidence[lane], requiredIdentitiesByLane[lane] ?? []));
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
