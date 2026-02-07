import { describe, it } from "vitest";

import { parseBranchForIssues } from "~/parsers/branch-parser.js";

import {
  expectEmptySet,
  expectSetToContain,
  STANDARD_ISSUE_PATTERN,
} from "./test-utils.js";

/* eslint-disable vitest/expect-expect */
describe("parseBranchForIssues", () => {
  const issuePattern = STANDARD_ISSUE_PATTERN;

  it("should extract issue from feature branch", () => {
    const issues = parseBranchForIssues(
      "feature/PROJECT-123-add-login",
      issuePattern,
    );
    expectSetToContain(issues, "PROJECT-123");
  });

  it("should extract issue from bugfix branch", () => {
    const issues = parseBranchForIssues(
      "bugfix/TEAM-456-fix-bug",
      issuePattern,
    );
    expectSetToContain(issues, "TEAM-456");
  });

  it("should handle main branch with no issues", () => {
    const issues = parseBranchForIssues("main", issuePattern);
    expectEmptySet(issues);
  });

  it("should handle develop branch with no issues", () => {
    const issues = parseBranchForIssues("develop", issuePattern);
    expectEmptySet(issues);
  });

  it("should extract multiple issues from branch name", () => {
    const issues = parseBranchForIssues(
      "feature/PROJECT-123-TEAM-456-combined",
      issuePattern,
    );
    expectSetToContain(issues, "PROJECT-123", "TEAM-456");
  });

  it("should handle branch with issue at start", () => {
    const issues = parseBranchForIssues("PROJECT-789", issuePattern);
    expectSetToContain(issues, "PROJECT-789");
  });

  it("should match lowercase issue keys and normalize to uppercase", () => {
    const issues = parseBranchForIssues(
      "feature/project-123-add-feature",
      issuePattern,
    );
    expectSetToContain(issues, "PROJECT-123");
  });

  it("should match mixed case issue keys from branch name", () => {
    const issues = parseBranchForIssues(
      "c/devops-13046_test_semantic-release-jira",
      issuePattern,
    );
    expectSetToContain(issues, "DEVOPS-13046");
  });
});
