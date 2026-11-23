import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const BASE_REPOSITORY = "chau-hm/view-camera-simulator";
const WORKFLOW_FILE = "pages.yml";
const ZERO_SHA = "0000000000000000000000000000000000000000";
const MAX_PAGES = 25;
const MAX_OPEN_PULL_REQUESTS_TO_CHECK = 10;
const MAX_RUNS_TO_CHECK_PER_PULL_REQUEST = 10;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_PR_CHECK_WAIT_MS = 30_000;
const PR_CHECK_POLL_INTERVAL_MS = 2_000;

type JsonObject = Record<string, unknown>;

export type FeaturePushDecision = "run-ci" | "covered-by-pr" | "no-commit";

export interface RoutingResult {
  decision: FeaturePushDecision;
  reason: string;
  pullRequestNumbers: number[];
  workflowRunIds: number[];
}

export interface RoutingApi {
  listOpenPullRequests(input: { repository: string; head: string }): Promise<unknown[]>;
  listWorkflowRuns(input: { repository: string; headSha: string }): Promise<unknown[]>;
  listWorkflowJobs(input: { repository: string; runId: number }): Promise<unknown[]>;
}

export interface RoutingOptions {
  maxWaitMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

function asObject(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
}

function repositoryMatches(actualValue: unknown, expectedValue: unknown): boolean {
  const actual = asObject(actualValue);
  const expected = asObject(expectedValue);
  const actualId = asNumber(actual?.id);
  const expectedId = asNumber(expected?.id);

  if (actualId !== undefined && expectedId !== undefined) return actualId === expectedId;
  return asString(actual?.full_name) !== undefined && actual?.full_name === expected?.full_name;
}

function result(decision: FeaturePushDecision, reason: string, pullRequestNumbers: number[] = [], workflowRunIds: number[] = []): RoutingResult {
  return { decision, reason, pullRequestNumbers, workflowRunIds };
}

function isCurrentPullRequest(value: unknown, branch: string, headSha: string): value is JsonObject {
  const pullRequest = asObject(value);
  const head = asObject(pullRequest?.head);
  const headRepository = asObject(head?.repo);
  const base = asObject(pullRequest?.base);
  const baseRepository = asObject(base?.repo);

  return pullRequest?.state === "open"
    && asNumber(pullRequest.number) !== undefined
    && head?.ref === branch
    && head?.sha === headSha
    && headRepository?.full_name === BASE_REPOSITORY
    && asString(base?.ref) !== undefined
    && baseRepository?.full_name === BASE_REPOSITORY;
}

function runBelongsToPullRequest(run: unknown, pullRequest: JsonObject, branch: string, headSha: string): run is JsonObject {
  const workflowRun = asObject(run);
  const associations = workflowRun?.pull_requests;
  if (!Array.isArray(associations)) return false;

  const expectedNumber = asNumber(pullRequest.number);
  const expectedHead = asObject(pullRequest.head);
  const expectedHeadRepository = asObject(expectedHead?.repo);
  const expectedBase = asObject(pullRequest.base);
  const expectedBaseRepository = asObject(expectedBase?.repo);
  const expectedBaseRef = asString(expectedBase?.ref);

  return workflowRun?.event === "pull_request"
    && workflowRun.head_sha === headSha
    && associations.some((association) => {
      const associatedPullRequest = asObject(association);
      const head = asObject(associatedPullRequest?.head);
      const headRepository = asObject(head?.repo);
      const base = asObject(associatedPullRequest?.base);
      const baseRepository = asObject(base?.repo);

      return associatedPullRequest?.number === expectedNumber
        && head?.ref === branch
        && head?.sha === headSha
        && repositoryMatches(headRepository, expectedHeadRepository)
        && base?.ref === expectedBaseRef
        && repositoryMatches(baseRepository, expectedBaseRepository);
    });
}

function hasStartedSuccessfulCi(jobs: unknown[]): boolean {
  return jobs.some((value) => {
    const job = asObject(value);
    if (job?.name !== "ci") return false;
    if (job.status === "in_progress") return true;
    return job.status === "completed" && job.conclusion === "success";
  });
}

function isBranchDeletion(event: JsonObject): boolean {
  return event.deleted === true || event.after === ZERO_SHA;
}

/**
 * Suppress feature-push CI only when every current open same-repository PR for
 * the branch has an actual `ci` job running or successfully completed for the
 * exact pushed source SHA. Every uncertain or unavailable result runs CI.
 */
export async function classifyFeaturePush(
  eventName: string,
  eventValue: unknown,
  api: RoutingApi,
  options: RoutingOptions = {},
): Promise<RoutingResult> {
  const event = asObject(eventValue);
  if (eventName !== "push" || !event) return result("run-ci", "not-a-push-event");
  if (isBranchDeletion(event)) return result("no-commit", "branch-deleted");

  const eventRepository = asObject(event.repository);
  const repository = asString(eventRepository?.full_name);
  if (repository !== BASE_REPOSITORY) return result("run-ci", "non-canonical-or-fork-repository");

  const ref = asString(event.ref);
  if (!ref?.startsWith("refs/heads/")) return result("run-ci", "not-a-branch-ref");
  const branch = ref.slice("refs/heads/".length);
  if (branch === "main" || branch === "production") return result("run-ci", "protected-branch");

  const headSha = asString(event.after);
  if (!headSha || !/^[a-f0-9]{40}$/i.test(headSha)) return result("run-ci", "missing-or-invalid-push-sha");

  let pullRequests: unknown[];
  try {
    const owner = BASE_REPOSITORY.split("/")[0];
    pullRequests = await api.listOpenPullRequests({ repository: BASE_REPOSITORY, head: `${owner}:${branch}` });
  } catch {
    return result("run-ci", "pull-request-lookup-unavailable");
  }

  if (!Array.isArray(pullRequests)) return result("run-ci", "invalid-pull-request-response");
  if (pullRequests.length === 0) return result("run-ci", "no-open-pr-for-branch");
  if (pullRequests.length > MAX_OPEN_PULL_REQUESTS_TO_CHECK) return result("run-ci", "too-many-open-prs-to-classify");
  if (!pullRequests.every((pullRequest) => isCurrentPullRequest(pullRequest, branch, headSha))) {
    return result("run-ci", "open-pr-does-not-match-current-push");
  }

  const validPullRequests = pullRequests.map((pullRequest) => asObject(pullRequest)!);
  const pullRequestNumbers = validPullRequests.map((pullRequest) => asNumber(pullRequest.number)!);
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolveSleep) => setTimeout(resolveSleep, milliseconds)));
  const deadline = now() + (options.maxWaitMs ?? MAX_PR_CHECK_WAIT_MS);

  while (true) {
    let workflowRuns: unknown[];
    try {
      workflowRuns = await api.listWorkflowRuns({ repository: BASE_REPOSITORY, headSha });

      const verifiedRunIds = new Set<number>();
      const verifiedPullRequests = new Set<number>();
      const jobsByRunId = new Map<number, unknown[]>();

      for (const pullRequest of validPullRequests) {
        const pullRequestNumber = asNumber(pullRequest.number)!;
        const candidateRuns = workflowRuns.filter((run) => runBelongsToPullRequest(run, pullRequest, branch, headSha));
        if (candidateRuns.length > MAX_RUNS_TO_CHECK_PER_PULL_REQUEST) {
          return result("run-ci", "too-many-pr-runs-to-classify", pullRequestNumbers);
        }

        for (const candidateRun of candidateRuns) {
          const runId = asNumber(asObject(candidateRun)?.id);
          if (runId === undefined) continue;

          let jobs = jobsByRunId.get(runId);
          if (!jobs) {
            jobs = await api.listWorkflowJobs({ repository: BASE_REPOSITORY, runId });
            jobsByRunId.set(runId, jobs);
          }

          if (hasStartedSuccessfulCi(jobs)) {
            verifiedRunIds.add(runId);
            verifiedPullRequests.add(pullRequestNumber);
            break;
          }
        }
      }

      if (verifiedPullRequests.size === validPullRequests.length) {
        return result("covered-by-pr", "exact-head-pr-ci-running-or-passed", pullRequestNumbers, [...verifiedRunIds]);
      }
    } catch {
      return result("run-ci", "pr-validation-lookup-unavailable", pullRequestNumbers);
    }

    if (now() >= deadline) return result("run-ci", "exact-head-pr-ci-not-established", pullRequestNumbers);
    await sleep(Math.min(options.pollIntervalMs ?? PR_CHECK_POLL_INTERVAL_MS, Math.max(0, deadline - now())));
  }
}

type FetchResponseLike = Pick<Response, "ok" | "status" | "headers" | "json">;
type FetchLike = (input: string, init: RequestInit) => Promise<FetchResponseLike>;

class GitHubApiResponseError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("GitHub API request failed");
    this.status = status;
  }
}

function nextPageUrl(linkHeader: string | null): string | undefined {
  if (!linkHeader) return undefined;

  for (const link of linkHeader.split(/,(?=\s*<)/)) {
    const match = link.match(/^\s*<([^>]+)>\s*;(.*)$/);
    if (match && /(?:^|;)\s*rel\s*=\s*"?next"?(?:\s*;|$)/.test(match[2])) return match[1];
  }

  return undefined;
}

function createGitHubApi(apiUrl: string, repository: string, token: string, fetchImpl: FetchLike = fetch): RoutingApi {
  const apiBase = new URL(apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`);
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) throw new Error("Invalid repository identifier");

  async function list(urlValue: URL, collectionKey?: string): Promise<unknown[]> {
    const items: unknown[] = [];
    let url: string | undefined = urlValue.toString();
    let pageCount = 0;

    while (url) {
      const requestUrl: URL = new URL(url, apiBase);
      if (requestUrl.origin !== apiBase.origin) throw new Error("Unexpected pagination origin");

      const response = await fetchImpl(requestUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new GitHubApiResponseError(response.status);

      const payload = await response.json();
      const pageItems = collectionKey ? asObject(payload)?.[collectionKey] : payload;
      if (!Array.isArray(pageItems)) throw new Error("Unexpected GitHub API response");
      items.push(...pageItems);

      pageCount += 1;
      const next = nextPageUrl(response.headers.get("link"));
      if (next && pageCount >= MAX_PAGES) throw new Error("GitHub API pagination limit reached");
      url = next ? new URL(next, requestUrl).toString() : undefined;
    }

    return items;
  }

  return {
    listOpenPullRequests({ head }) {
      const url = new URL(`repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, apiBase);
      url.search = new URLSearchParams({ state: "open", head, per_page: "100" }).toString();
      return list(url);
    },
    listWorkflowRuns({ headSha }) {
      const url = new URL(
        `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(WORKFLOW_FILE)}/runs`,
        apiBase,
      );
      url.search = new URLSearchParams({ event: "pull_request", head_sha: headSha, per_page: "100" }).toString();
      return list(url, "workflow_runs");
    },
    listWorkflowJobs({ runId }) {
      const url = new URL(
        `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs/${runId}/jobs`,
        apiBase,
      );
      url.search = new URLSearchParams({ per_page: "100" }).toString();
      return list(url, "jobs");
    },
  };
}

function writeOutputs(outputPath: string | undefined, value: RoutingResult): void {
  if (!outputPath) return;
  const lines = [
    `decision=${value.decision}`,
    `reason=${value.reason}`,
    `pull_requests=${value.pullRequestNumbers.join(",")}`,
    `workflow_runs=${value.workflowRunIds.join(",")}`,
  ];
  appendFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
}

async function runCli(): Promise<void> {
  let route = result("run-ci", "routing-unavailable");

  try {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    const apiUrl = process.env.GITHUB_API_URL;
    const repository = process.env.GITHUB_REPOSITORY;
    const token = process.env.GITHUB_TOKEN;
    if (!eventPath || !apiUrl || !repository || !token) throw new Error("Missing routing environment");

    const event = JSON.parse(readFileSync(eventPath, "utf8")) as unknown;
    route = await classifyFeaturePush(
      process.env.GITHUB_EVENT_NAME ?? "",
      event,
      createGitHubApi(apiUrl, repository, token),
    );
  } catch {
    route = result("run-ci", "routing-unavailable");
  }

  try {
    writeOutputs(process.env.GITHUB_OUTPUT, route);
  } catch {
    // Missing outputs are treated as uncertain by the downstream gate, which runs full CI.
  }

  console.log(`Feature push routing: ${route.decision} (${route.reason})`);
  if (route.pullRequestNumbers.length > 0) console.log(`Matching open PR numbers: ${route.pullRequestNumbers.join(",")}`);
  if (route.workflowRunIds.length > 0) console.log(`Verified PR workflow run IDs: ${route.workflowRunIds.join(",")}`);
}

const invokedFile = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedFile) await runCli();
