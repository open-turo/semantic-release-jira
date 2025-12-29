/**
 * GitHub client mock utilities for testing
 *
 * Factory functions for creating mocked Octokit clients with predefined responses.
 *
 * @example
 * ```typescript
 * // Mock client with merged PR
 * const client = createMockGitHubClientWithMergedPR(
 *   123,
 *   'Fixes PROJ-123\n\nCloses PROJ-456'
 * );
 *
 * // Use in test
 * const result = await fetchPullRequestsForCommits(client, ...);
 * ```
 */

import type { Octokit } from "@octokit/rest";

// eslint-disable-next-line import/no-extraneous-dependencies
import { vi } from "vitest";

/**
 * Mock pull request data structure
 */
export interface MockPullRequest {
  body?: string;
  merged_at?: null | string;
  number: number;
  state: string;
}

/**
 * Default merged timestamp for test PRs
 */
const DEFAULT_MERGED_AT = "2023-01-01T00:00:00Z";

/**
 * Create a mock GitHub client with custom PR responses
 *
 * Provides full control over sequential responses for multiple API calls.
 * Each element in prResponses represents one API call response.
 *
 * @param prResponses - Array of PR arrays (one per API call)
 * @returns Mocked Octokit client
 *
 * @example
 * ```typescript
 * // Mock client that returns different PRs on successive calls
 * const client = createMockGitHubClient([
 *   [{ number: 123, body: 'First PR', state: 'closed', merged_at: '2023-01-01' }],
 *   [{ number: 456, body: 'Second PR', state: 'closed', merged_at: '2023-01-02' }]
 * ]);
 * ```
 */
export function createMockGitHubClient(
  prResponses: MockPullRequest[][] = [],
): Octokit {
  const mockFunction = vi.fn();

  // Setup sequential responses
  for (const response of prResponses) {
    mockFunction.mockResolvedValueOnce({ data: response });
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    repos: {
      listPullRequestsAssociatedWithCommit: mockFunction,
    },
  } as unknown as Octokit;
}

/**
 * Create a mock GitHub client that throws an error
 *
 * Useful for testing error handling scenarios.
 *
 * @param error - Error to throw when API is called
 * @returns Mocked Octokit client
 *
 * @example
 * ```typescript
 * const client = createMockGitHubClientWithError(
 *   new Error('API rate limit exceeded')
 * );
 * ```
 */
export function createMockGitHubClientWithError(error: Error): Octokit {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    repos: {
      listPullRequestsAssociatedWithCommit: vi.fn().mockRejectedValue(error),
    },
  } as unknown as Octokit;
}

/**
 * Create a mock GitHub client with a single merged pull request
 *
 * Convenience function for the common case of one merged PR.
 *
 * @param number - Pull request number
 * @param body - Pull request body (description)
 * @returns Mocked Octokit client
 *
 * @example
 * ```typescript
 * const client = createMockGitHubClientWithMergedPR(
 *   123,
 *   'feat: add feature\n\nCloses PROJ-123'
 * );
 * ```
 */
export function createMockGitHubClientWithMergedPR(
  number: number,
  body: string,
): Octokit {
  return createMockGitHubClient([[createMergedPR(number, body)]]);
}

/**
 * Create a mock GitHub client with multiple pull requests
 *
 * Each PR will be returned in a separate API call response.
 *
 * @param prs - Array of PR configurations
 * @returns Mocked Octokit client
 *
 * @example
 * ```typescript
 * const client = createMockGitHubClientWithMultiplePRs([
 *   { number: 123, body: 'First PR' },
 *   { number: 456, body: 'Second PR' }
 * ]);
 * ```
 */
export function createMockGitHubClientWithMultiplePRs(
  prs: Array<{ body: string; number: number }>,
): Octokit {
  return createMockGitHubClient(
    prs.map((pr) => [createMergedPR(pr.number, pr.body)]),
  );
}

/**
 * Create a mock GitHub client that returns no pull requests
 *
 * Convenience function for testing scenarios with no associated PRs.
 *
 * @returns Mocked Octokit client
 *
 * @example
 * ```typescript
 * const client = createMockGitHubClientWithNoPRs();
 * ```
 */
export function createMockGitHubClientWithNoPRs(): Octokit {
  return createMockGitHubClient([[]]);
}

/**
 * Create a mock GitHub client with an unmerged pull request
 *
 * Useful for testing scenarios where PRs exist but aren't merged.
 *
 * @param number - Pull request number
 * @param body - Pull request body
 * @returns Mocked Octokit client
 *
 * @example
 * ```typescript
 * const client = createMockGitHubClientWithUnmergedPR(123, 'WIP: feature');
 * ```
 */
export function createMockGitHubClientWithUnmergedPR(
  number: number,
  body: string,
): Octokit {
  return createMockGitHubClient([
    [
      {
        body,
        merged_at: undefined,
        number,
        state: "open",
      },
    ],
  ]);
}

/**
 * Create a mock merged PR with defaults
 *
 * Helper to reduce boilerplate when creating merged PR mocks.
 *
 * @param number - Pull request number
 * @param body - Pull request body
 * @returns MockPullRequest with merged state
 */
function createMergedPR(number: number, body: string): MockPullRequest {
  return {
    body,
    merged_at: DEFAULT_MERGED_AT,
    number,
    state: "closed",
  };
}
