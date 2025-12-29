import { describe, it } from "vitest";

import { parseCommitsForIssues } from "~/parsers/commit-parser.js";

import {
  createMockCommit,
  createMockCommits,
  expectEmptySet,
  expectSetToContain,
  STANDARD_ISSUE_PATTERN,
} from "./test-utils.js";

/* eslint-disable vitest/expect-expect */
describe("parseCommitsForIssues", () => {
  const issuePattern = STANDARD_ISSUE_PATTERN;

  it("should extract issue from conventional commit", () => {
    const commits = [
      createMockCommit("fix(api): resolve timeout issue\n\nCloses PROJECT-123"),
    ];
    const issues = parseCommitsForIssues(commits, issuePattern);
    expectSetToContain(issues, "PROJECT-123");
  });

  it("should extract multiple issues from single commit", () => {
    const commits = [
      createMockCommit(
        "feat: implement new feature\n\nCloses PROJECT-123, PROJECT-456",
      ),
    ];
    const issues = parseCommitsForIssues(commits, issuePattern);
    expectSetToContain(issues, "PROJECT-123", "PROJECT-456");
  });

  it("should extract issues from multiple commits", () => {
    const commits = createMockCommits([
      "fix: resolve PROJECT-123",
      "feat: add TEAM-456",
    ]);
    const issues = parseCommitsForIssues(commits, issuePattern);
    expectSetToContain(issues, "PROJECT-123", "TEAM-456");
  });

  it("should deduplicate issues across commits", () => {
    const commits = createMockCommits([
      "fix: resolve PROJECT-123",
      "chore: update PROJECT-123",
    ]);
    const issues = parseCommitsForIssues(commits, issuePattern);
    expectSetToContain(issues, "PROJECT-123");
  });

  it("should handle commits with no issues", () => {
    const commits = [createMockCommit("chore: update dependencies")];
    const issues = parseCommitsForIssues(commits, issuePattern);
    expectEmptySet(issues);
  });

  it("should extract issues from commit body", () => {
    const commits = [
      createMockCommit(
        "feat: add new feature\n\nThis fixes a bug reported in PROJECT-789.\nAlso addresses TEAM-101.",
      ),
    ];
    const issues = parseCommitsForIssues(commits, issuePattern);
    expectSetToContain(issues, "PROJECT-789", "TEAM-101");
  });

  it("should extract issues from footer references", () => {
    const commits = [
      createMockCommit(
        "fix: resolve timeout\n\nResolves: PROJECT-555\nRef: TEAM-666",
      ),
    ];
    const issues = parseCommitsForIssues(commits, issuePattern);
    expectSetToContain(issues, "PROJECT-555", "TEAM-666");
  });

  it("should handle numeric project keys", () => {
    const commits = [createMockCommit("fix: resolve ABC123-456")];
    const issues = parseCommitsForIssues(commits, issuePattern);
    expectSetToContain(issues, "ABC123-456");
  });
});
