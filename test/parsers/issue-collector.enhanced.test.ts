/**
 * Enhanced tests for issue parsing with validation
 * These tests cover Task 16 - Input Validation for parseIssueKeys
 */

import { describe, expect, it } from "vitest";

import { parseIssueKeys } from "~/parsers/issue-collector.js";

import { createIssueKeySet, createMockIssue } from "./test-utils.js";

describe("parseIssueKeys - Enhanced with Validation", () => {
  it("should parse valid issue keys", () => {
    const keys = createIssueKeySet("ABC-456", "PROJECT-123", "TEAM-789");
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(3);
    expect(issues[0]).toEqual(createMockIssue("ABC-456", "ABC"));
    expect(issues[1]).toEqual(createMockIssue("PROJECT-123", "PROJECT"));
    expect(issues[2]).toEqual(createMockIssue("TEAM-789", "TEAM"));
  });

  it("should filter out invalid issue key formats", () => {
    const keys = createIssueKeySet(
      "123-456",
      "ABC-DEF",
      "NO-DASH",
      "PROJECT-123",
      "project-456",
      "VALID-789",
    );
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(2);
    expect(issues[0]).toEqual(createMockIssue("PROJECT-123", "PROJECT"));
    expect(issues[1]).toEqual(createMockIssue("VALID-789", "VALID"));
  });

  it("should handle malformed keys safely", () => {
    const keys = createIssueKeySet(
      "",
      "-",
      "-123",
      "NODASH",
      "PROJECT-",
      "PROJECT-123",
    );
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual(createMockIssue("PROJECT-123", "PROJECT"));
  });

  it("should handle keys with multiple dashes correctly", () => {
    const keys = createIssueKeySet(
      "A-B-C-123",
      "PROJECT-123",
      "PROJECT-SUB-456",
    );
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual(createMockIssue("PROJECT-123", "PROJECT"));
  });

  it("should extract correct project key", () => {
    const keys = createIssueKeySet("ABC-123", "MYPROJECT-456", "X1Y2Z3-789");
    const issues = parseIssueKeys(keys);

    expect(issues[0].projectKey).toBe("ABC");
    expect(issues[1].projectKey).toBe("MYPROJECT");
    expect(issues[2].projectKey).toBe("X1Y2Z3");
  });

  it("should handle empty set", () => {
    const keys = createIssueKeySet();
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(0);
  });

  it("should handle set with only invalid keys", () => {
    const keys = createIssueKeySet(
      "-123",
      "also-invalid",
      "invalid",
      "PROJECT-",
      "project-123",
    );
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(0);
  });

  it("should handle mixed case project keys correctly", () => {
    const keys = createIssueKeySet(
      "ANOTHER-456",
      "PROJECT-123",
      "Project-123",
      "project-123",
    );
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(2);
    expect(issues[0]).toEqual(createMockIssue("ANOTHER-456", "ANOTHER"));
    expect(issues[1]).toEqual(createMockIssue("PROJECT-123", "PROJECT"));
  });

  it("should handle very long project keys", () => {
    const keys = createIssueKeySet("SHORT-789", "VERYLONGPROJECTKEY123-456");
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(2);
    expect(issues[0].projectKey).toBe("SHORT");
    expect(issues[1].projectKey).toBe("VERYLONGPROJECTKEY123");
  });

  it("should handle very large issue numbers", () => {
    const keys = createIssueKeySet("ABC-1", "PROJECT-999999999");
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(2);
    expect(issues[0]).toEqual(createMockIssue("ABC-1", "ABC"));
    expect(issues[1]).toEqual(createMockIssue("PROJECT-999999999", "PROJECT"));
  });

  it("should handle special characters in keys correctly", () => {
    const keys = createIssueKeySet(
      "PRO@ECT-456",
      "PROJECT_SUB-123",
      "PROJECT-123",
      "PROJECT#-789",
    );
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual(createMockIssue("PROJECT-123", "PROJECT"));
  });

  it("should preserve original key format", () => {
    const keys = createIssueKeySet("ABC123-456", "XYZ-789");
    const issues = parseIssueKeys(keys);

    expect(issues[0].key).toBe("ABC123-456");
    expect(issues[1].key).toBe("XYZ-789");
  });

  it("should handle duplicate keys (set deduplication)", () => {
    const keys = createIssueKeySet("ABC-456", "PROJECT-123", "PROJECT-123");
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(2);
  });

  it("should handle keys with leading/trailing whitespace", () => {
    const keys = createIssueKeySet(
      " PROJECT-123",
      "PROJECT-123 ",
      "PROJECT-123",
    );
    const issues = parseIssueKeys(keys);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toEqual(createMockIssue("PROJECT-123", "PROJECT"));
  });
});
