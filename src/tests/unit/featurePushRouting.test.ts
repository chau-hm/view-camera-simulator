import { describe, expect, it, vi } from "vitest";
import {
  classifyFeaturePush,
  type RoutingApi,
} from "../../../scripts/feature-push-routing.ts";

const repository = "chau-hm/view-camera-simulator";
const branch = "feature/example-change";
const headSha = "a".repeat(40);

function pushEvent(overrides: Record<string, unknown> = {}) {
  return {
    ref: `refs/heads/${branch}`,
    after: headSha,
    deleted: false,
    repository: { full_name: repository },
    ...overrides,
  };
}

function pullRequest(number: number, overrides: Record<string, unknown> = {}) {
  return {
    number,
    state: "open",
    head: {
      ref: branch,
      sha: headSha,
      repo: { full_name: repository },
    },
    base: {
      ref: number === 7 ? "main" : "integration/test",
      repo: { full_name: repository },
    },
    ...overrides,
  };
}

function workflowRun(number: number, pullRequestNumber: number) {
  return {
    id: number,
    event: "pull_request",
    head_sha: headSha,
    pull_requests: [{
      number: pullRequestNumber,
      head: {
        ref: branch,
        sha: headSha,
        repo: { full_name: repository },
      },
      base: {
        ref: pullRequestNumber === 7 ? "main" : "integration/test",
        repo: { full_name: repository },
      },
    }],
  };
}

function apiFixture(overrides: Partial<RoutingApi> = {}): RoutingApi {
  return {
    listOpenPullRequests: vi.fn().mockResolvedValue([pullRequest(7)]),
    listWorkflowRuns: vi.fn().mockResolvedValue([workflowRun(70, 7)]),
    listWorkflowJobs: vi.fn().mockResolvedValue([{ name: "ci", status: "in_progress", conclusion: null }]),
    ...overrides,
  };
}

const noWait = { maxWaitMs: 0, pollIntervalMs: 0 };

describe("feature push validation routing", () => {
  it("keeps a feature push on full CI when no open PR exists", async () => {
    const api = apiFixture({ listOpenPullRequests: vi.fn().mockResolvedValue([]) });

    await expect(classifyFeaturePush("push", pushEvent(), api, noWait)).resolves.toMatchObject({
      decision: "run-ci",
      reason: "no-open-pr-for-branch",
    });
    expect(api.listWorkflowRuns).not.toHaveBeenCalled();
  });

  it("resumes full validation for a branch push after its PR has closed", async () => {
    const api = apiFixture({ listOpenPullRequests: vi.fn().mockResolvedValue([]) });

    await expect(classifyFeaturePush("push", pushEvent(), api, noWait)).resolves.toMatchObject({
      decision: "run-ci",
      reason: "no-open-pr-for-branch",
    });
  });

  it("keeps full CI when the current PR has no matching workflow run yet", async () => {
    const api = apiFixture({ listWorkflowRuns: vi.fn().mockResolvedValue([]) });

    await expect(classifyFeaturePush("push", pushEvent(), api, noWait)).resolves.toMatchObject({
      decision: "run-ci",
      reason: "exact-head-pr-ci-not-established",
    });
  });

  it("suppresses only after an exact-head PR ci job has started", async () => {
    const api = apiFixture();

    await expect(classifyFeaturePush("push", pushEvent(), api, noWait)).resolves.toMatchObject({
      decision: "covered-by-pr",
      reason: "exact-head-pr-ci-running-or-passed",
      pullRequestNumbers: [7],
      workflowRunIds: [70],
    });
  });

  it("accepts a completed successful PR ci job as coverage", async () => {
    const api = apiFixture({
      listWorkflowJobs: vi.fn().mockResolvedValue([{ name: "ci", status: "completed", conclusion: "success" }]),
    });

    await expect(classifyFeaturePush("push", pushEvent(), api, noWait)).resolves.toMatchObject({
      decision: "covered-by-pr",
    });
  });

  it.each([
    [{ name: "ci", status: "queued", conclusion: null }],
    [{ name: "ci", status: "completed", conclusion: "failure" }],
    [{ name: "ci", status: "completed", conclusion: "cancelled" }],
    [{ name: "ci", status: "completed", conclusion: "skipped" }],
    [{ name: "build", status: "completed", conclusion: "success" }],
  ])("does not suppress when the PR ci job is not active or successful: %o", async (job) => {
    const api = apiFixture({ listWorkflowJobs: vi.fn().mockResolvedValue([job]) });

    await expect(classifyFeaturePush("push", pushEvent(), api, noWait)).resolves.toMatchObject({
      decision: "run-ci",
    });
  });

  it("fails open when a PR head is stale relative to the pushed revision", async () => {
    const stalePullRequest = pullRequest(7, {
      head: { ref: branch, sha: "b".repeat(40), repo: { full_name: repository } },
    });
    const api = apiFixture({ listOpenPullRequests: vi.fn().mockResolvedValue([stalePullRequest]) });

    await expect(classifyFeaturePush("push", pushEvent(), api, noWait)).resolves.toMatchObject({
      decision: "run-ci",
      reason: "open-pr-does-not-match-current-push",
    });
  });

  it("does not trust a same-SHA workflow run associated with a different PR", async () => {
    const api = apiFixture({
      listWorkflowRuns: vi.fn().mockResolvedValue([workflowRun(70, 99)]),
    });

    await expect(classifyFeaturePush("push", pushEvent(), api, noWait)).resolves.toMatchObject({
      decision: "run-ci",
      reason: "exact-head-pr-ci-not-established",
    });
  });

  it("requires exact validation evidence for every open PR, including integration targets", async () => {
    const secondPullRequest = pullRequest(8);
    const allValidated = apiFixture({
      listOpenPullRequests: vi.fn().mockResolvedValue([pullRequest(7), secondPullRequest]),
      listWorkflowRuns: vi.fn().mockResolvedValue([workflowRun(70, 7), workflowRun(80, 8)]),
    });
    await expect(classifyFeaturePush("push", pushEvent(), allValidated, noWait)).resolves.toMatchObject({
      decision: "covered-by-pr",
      pullRequestNumbers: [7, 8],
      workflowRunIds: [70, 80],
    });

    const oneUnvalidated = apiFixture({
      listOpenPullRequests: vi.fn().mockResolvedValue([pullRequest(7), secondPullRequest]),
      listWorkflowRuns: vi.fn().mockResolvedValue([workflowRun(70, 7)]),
    });
    await expect(classifyFeaturePush("push", pushEvent(), oneUnvalidated, noWait)).resolves.toMatchObject({
      decision: "run-ci",
    });
  });

  it("waits for a just-triggered PR run and fails open when it never appears", async () => {
    const api = apiFixture({
      listWorkflowRuns: vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([workflowRun(70, 7)]),
    });
    await expect(classifyFeaturePush("push", pushEvent(), api, {
      maxWaitMs: 100,
      pollIntervalMs: 1,
      sleep: async () => undefined,
    })).resolves.toMatchObject({ decision: "covered-by-pr" });

    const missingRun = apiFixture({ listWorkflowRuns: vi.fn().mockResolvedValue([]) });
    await expect(classifyFeaturePush("push", pushEvent(), missingRun, noWait)).resolves.toMatchObject({
      decision: "run-ci",
      reason: "exact-head-pr-ci-not-established",
    });
  });

  it("fails open on API, permission, or rate-limit errors", async () => {
    const api = apiFixture({ listOpenPullRequests: vi.fn().mockRejectedValue(new Error("403")) });

    await expect(classifyFeaturePush("push", pushEvent(), api, noWait)).resolves.toMatchObject({
      decision: "run-ci",
      reason: "pull-request-lookup-unavailable",
    });
  });

  it("fails open for fork-originated pushes", async () => {
    const api = apiFixture();

    await expect(classifyFeaturePush("push", pushEvent({
      repository: { full_name: "contributor/view-camera-simulator" },
    }), api, noWait)).resolves.toMatchObject({
      decision: "run-ci",
      reason: "non-canonical-or-fork-repository",
    });
    expect(api.listOpenPullRequests).not.toHaveBeenCalled();
  });

  it("does not run full validation for a branch deletion", async () => {
    const api = apiFixture();

    await expect(classifyFeaturePush("push", pushEvent({ deleted: true, after: "0".repeat(40) }), api, noWait)).resolves.toMatchObject({
      decision: "no-commit",
      reason: "branch-deleted",
    });
    expect(api.listOpenPullRequests).not.toHaveBeenCalled();
  });

  it("does not classify PR, main, production, or manual events as suppressible feature pushes", async () => {
    const api = apiFixture();

    await expect(classifyFeaturePush("pull_request", pushEvent(), api, noWait)).resolves.toMatchObject({ decision: "run-ci" });
    await expect(classifyFeaturePush("push", pushEvent({ ref: "refs/heads/main" }), api, noWait)).resolves.toMatchObject({ decision: "run-ci" });
    await expect(classifyFeaturePush("push", pushEvent({ ref: "refs/heads/production" }), api, noWait)).resolves.toMatchObject({ decision: "run-ci" });
    await expect(classifyFeaturePush("workflow_dispatch", pushEvent(), api, noWait)).resolves.toMatchObject({ decision: "run-ci" });
    expect(api.listOpenPullRequests).not.toHaveBeenCalled();
  });
});
