import { describe, it } from "vitest";

import { parsePullRequestsForIssues } from "~/parsers/pr-parser.js";

import {
  createMockPullRequest,
  expectEmptySet,
  expectSetToContain,
  STANDARD_ISSUE_PATTERN,
} from "./test-utils.js";

/* eslint-disable vitest/expect-expect */
describe("parsePullRequestsForIssues", () => {
  const issuePattern = STANDARD_ISSUE_PATTERN;

  it("should extract issue from PR body", () => {
    const prs = [createMockPullRequest("This PR fixes PROJECT-123")];
    const issues = parsePullRequestsForIssues(prs, issuePattern);
    expectSetToContain(issues, "PROJECT-123");
  });

  it("should extract multiple issues from single PR", () => {
    const prs = [
      createMockPullRequest("Fixes PROJECT-123 and resolves TEAM-456"),
    ];
    const issues = parsePullRequestsForIssues(prs, issuePattern);
    expectSetToContain(issues, "PROJECT-123", "TEAM-456");
  });

  it("should extract issues from multiple PRs", () => {
    const prs = [
      createMockPullRequest("Fixes PROJECT-123", { number: 1 }),
      createMockPullRequest("Resolves TEAM-456", { number: 2 }),
    ];
    const issues = parsePullRequestsForIssues(prs, issuePattern);
    expectSetToContain(issues, "PROJECT-123", "TEAM-456");
  });

  it("should deduplicate issues across PRs", () => {
    const prs = [
      createMockPullRequest("Fixes PROJECT-123", { number: 1 }),
      createMockPullRequest("Updates PROJECT-123", { number: 2 }),
    ];
    const issues = parsePullRequestsForIssues(prs, issuePattern);
    expectSetToContain(issues, "PROJECT-123");
  });

  it("should handle PR with undefined body", () => {
    const prs = [createMockPullRequest()];
    const issues = parsePullRequestsForIssues(prs, issuePattern);
    expectEmptySet(issues);
  });

  it("should handle PR with empty body", () => {
    const prs = [createMockPullRequest("")];
    const issues = parsePullRequestsForIssues(prs, issuePattern);
    expectEmptySet(issues);
  });

  it("should handle empty PR list", () => {
    const issues = parsePullRequestsForIssues([], issuePattern);
    expectEmptySet(issues);
  });
});
