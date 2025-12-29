import { describe, expect, it } from "vitest";

import type { GitHubPullRequest } from "~/types/index.js";

import {
  collectIssues,
  groupIssuesByProject,
  parseIssueKeys,
} from "~/parsers/issue-collector.js";

import {
  createIssueKeySet,
  createMockCommit,
  createMockIssue,
  createMockPullRequest,
  expectSetToContain,
  STANDARD_ISSUE_PATTERN,
} from "./test-utils.js";

describe("collectIssues", () => {
  const issuePattern = STANDARD_ISSUE_PATTERN;

  it("should collect issues from all sources", () => {
    const commits = [createMockCommit("fix: resolve PROJECT-123")];
    const branchName = "feature/TEAM-456-add-feature";
    const prs = [createMockPullRequest("Fixes BUG-789")];

    const result = collectIssues(commits, branchName, prs, issuePattern);

    expectSetToContain(result.issues, "PROJECT-123", "TEAM-456", "BUG-789");
    expect(result.sources.commits).toBe(1);
    expect(result.sources.branch).toBe(1);
    expect(result.sources.pullRequests).toBe(1);
  });

  // eslint-disable-next-line vitest/expect-expect
  it("should deduplicate issues across sources", () => {
    const commits = [createMockCommit("fix: resolve PROJECT-123")];
    const branchName = "feature/PROJECT-123-add-feature";
    const prs = [createMockPullRequest("Fixes PROJECT-123")];

    const result = collectIssues(commits, branchName, prs, issuePattern);

    expectSetToContain(result.issues, "PROJECT-123");
  });

  it("should handle no issues found", () => {
    const commits = [createMockCommit("chore: update dependencies")];
    const branchName = "main";
    const prs: GitHubPullRequest[] = [];

    const result = collectIssues(commits, branchName, prs, issuePattern);

    expect(result.issues.size).toBe(0);
    expect(result.sources.commits).toBe(0);
    expect(result.sources.branch).toBe(0);
    expect(result.sources.pullRequests).toBe(0);
  });
});

describe("parseIssueKeys", () => {
  it("should parse issue keys into structured format", () => {
    const keys = createIssueKeySet("PROJECT-123", "TEAM-456");
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(2);
    expect(issues[0]).toEqual(createMockIssue("PROJECT-123", "PROJECT"));
    expect(issues[1]).toEqual(createMockIssue("TEAM-456", "TEAM"));
  });

  it("should handle empty set", () => {
    const keys = createIssueKeySet();
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(0);
  });

  it("should handle numeric project keys", () => {
    const keys = createIssueKeySet("ABC123-456");
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual(createMockIssue("ABC123-456", "ABC123"));
  });
});

describe("groupIssuesByProject", () => {
  it("should group issues by project key", () => {
    const issues = [
      createMockIssue("PROJECT-123", "PROJECT"),
      createMockIssue("PROJECT-456", "PROJECT"),
      createMockIssue("TEAM-789", "TEAM"),
    ];
    const grouped = groupIssuesByProject(issues);

    expect(grouped.size).toBe(2);
    expect(grouped.get("PROJECT")).toHaveLength(2);
    expect(grouped.get("TEAM")).toHaveLength(1);
  });

  it("should handle single project", () => {
    const issues = [
      createMockIssue("PROJECT-123", "PROJECT"),
      createMockIssue("PROJECT-456", "PROJECT"),
    ];
    const grouped = groupIssuesByProject(issues);

    expect(grouped.size).toBe(1);
    expect(grouped.get("PROJECT")).toHaveLength(2);
  });

  it("should handle empty array", () => {
    const grouped = groupIssuesByProject([]);
    expect(grouped.size).toBe(0);
  });
});
