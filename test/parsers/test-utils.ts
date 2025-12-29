/**
 * Test utilities for parser tests
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { expect } from "vitest";

import type { GitHubPullRequest } from "~/types/index.js";

/**
 * Standard issue pattern used across all parser tests
 */
// eslint-disable-next-line sonarjs/slow-regex
export const STANDARD_ISSUE_PATTERN = /[A-Z][A-Z0-9]+-\d+/g;

/**
 * Creates a set of issue keys for testing
 */
export function createIssueKeySet(...keys: string[]): Set<string> {
  return new Set(keys);
}

/**
 * Creates a mock commit for testing
 */
export function createMockCommit(message: string): { message: string } {
  return { message };
}

/**
 * Creates multiple mock commits for testing
 */
export function createMockCommits(
  messages: string[],
): Array<{ message: string }> {
  return messages.map((message) => createMockCommit(message));
}

/**
 * Creates a mock issue object for testing
 */
export function createMockIssue(
  key: string,
  projectKey: string,
): { key: string; projectKey: string } {
  return { key, projectKey };
}

/**
 * Creates a mock GitHub pull request for testing
 */
export function createMockPullRequest(
  body?: string,
  options?: {
    merged?: boolean;
    number?: number;
    state?: "closed" | "open";
  },
): GitHubPullRequest {
  return {
    body,
    merged: options?.merged ?? true,
    number: options?.number ?? 1,
    state: options?.state ?? "closed",
  };
}

/**
 * Creates multiple mock GitHub pull requests for testing
 */
export function createMockPullRequests(
  bodies: Array<string | undefined>,
): GitHubPullRequest[] {
  return bodies.map((body, index) =>
    createMockPullRequest(body, { number: index + 1 }),
  );
}

/**
 * Assert that a Set is empty
 */
export function expectEmptySet(set: Set<string>): void {
  expect(set.size).toBe(0);
}

/**
 * Assert that a Set contains exactly the expected values
 */
export function expectSetToContain(
  set: Set<string>,
  ...values: string[]
): void {
  expect(set.size).toBe(values.length);
  for (const value of values) {
    expect(set.has(value)).toBe(true);
  }
}
