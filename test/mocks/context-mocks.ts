/**
 * Semantic-release context mock utilities for testing
 *
 * Factory functions for creating mocked semantic-release contexts with flexible configuration.
 *
 * @example
 * ```typescript
 * // Create context with custom commits
 * const context = createMockContext({
 *   commits: [
 *     { hash: 'abc123', message: 'feat(PROJ-123): add feature' }
 *   ],
 *   version: '2.0.0'
 * });
 *
 * // Create context for single issue scenario
 * const context = createMockContextWithIssue('PROJ-123');
 * ```
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import { vi } from "vitest";

import type { SemanticReleaseContext } from "~/types/index.js";

/**
 * Commit data for mock context
 */
export interface MockCommit {
  hash: string;
  message: string;
}

/**
 * Options for configuring a mock semantic-release context
 */
export interface MockContextOptions {
  branch?: { main?: string; name: string } | string;
  commits?: MockCommit[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  nextRelease?: {
    notes?: string;
    type?: string;
    version?: string;
  };
  releaseType?: string;
  version?: string;
}

/**
 * Create a mock semantic-release context with flexible configuration
 *
 * Provides sensible defaults while allowing customization of any field.
 * All logger functions are mocked with vitest.
 *
 * @param options - Configuration options for the context
 * @returns Fully typed SemanticReleaseContext
 *
 * @example
 * ```typescript
 * // Default context (2 commits)
 * const context = createMockContext();
 *
 * // Custom version and commits
 * const context = createMockContext({
 *   version: '2.0.0',
 *   commits: [
 *     { hash: 'abc123', message: 'feat: major feature' }
 *   ]
 * });
 *
 * // Custom environment variables
 * const context = createMockContext({
 *   env: {
 *     GITHUB_REPOSITORY: 'owner/repo',
 *     GITHUB_TOKEN: 'ghp_token123'
 *   }
 * });
 * ```
 */
export function createMockContext(
  options: MockContextOptions = {},
): SemanticReleaseContext {
  // Support both string (just branch name) and full branch object
  const branch =
    typeof options.branch === "string"
      ? { main: "main", name: options.branch }
      : (options.branch ?? { main: "main", name: "main" });

  return {
    branch,
    commits: options.commits ?? [
      {
        hash: "abc123",
        message: "feat(PROJ-123): add new feature",
      },
      {
        hash: "def456",
        message: "fix(PROJ-456): fix critical bug",
      },
    ],
    // eslint-disable-next-line sonarjs/publicly-writable-directories
    cwd: options.cwd ?? "/tmp/test-repo",
    env: options.env ?? {},
    logger: {
      error: vi.fn(),
      log: vi.fn(),
      success: vi.fn(),
    },
    nextRelease: {
      notes: options.nextRelease?.notes ?? "",
      type: options.nextRelease?.type ?? options.releaseType ?? "minor",
      version: options.nextRelease?.version ?? options.version ?? "1.2.0",
    },
  };
}

/**
 * Create a mock context for read-only mode (no credentials)
 *
 * Convenience function for testing scenarios without authentication.
 *
 * @param options - Additional context options
 * @returns SemanticReleaseContext
 *
 * @example
 * ```typescript
 * const context = createMockContextReadOnly();
 * ```
 */
export function createMockContextReadOnly(
  options: MockContextOptions = {},
): SemanticReleaseContext {
  return createMockContext({
    ...options,
    env: {
      ...options.env,
      // Explicitly no GitHub or Jira credentials
    },
  });
}

/**
 * Create a mock context for single-issue test scenarios
 *
 * Convenience function that creates a context with one commit referencing
 * the specified issue key.
 *
 * @param issueKey - Jira issue key (e.g., 'PROJ-123')
 * @param commitMessage - Optional custom commit message (will include issue key if not provided)
 * @returns SemanticReleaseContext with single commit
 *
 * @example
 * ```typescript
 * // Default commit message
 * const context = createMockContextWithIssue('PROJ-123');
 * // Commit: "feat(PROJ-123): test commit"
 *
 * // Custom commit message
 * const context = createMockContextWithIssue(
 *   'PROJ-123',
 *   'fix(PROJ-123): fix critical bug'
 * );
 * ```
 */
export function createMockContextWithIssue(
  issueKey: string,
  commitMessage?: string,
): SemanticReleaseContext {
  return createMockContext({
    commits: [
      {
        hash: "abc123",
        message: commitMessage ?? `feat(${issueKey}): test commit`,
      },
    ],
  });
}

/**
 * Create a mock context with multiple specific issues
 *
 * Convenience function that creates a context with commits for each issue key.
 *
 * @param issueKeys - Array of Jira issue keys
 * @param options - Additional context options
 * @returns SemanticReleaseContext with commits for each issue
 *
 * @example
 * ```typescript
 * const context = createMockContextWithIssues([
 *   'PROJ-123',
 *   'PROJ-456',
 *   'PROJ-789'
 * ]);
 * ```
 */
export function createMockContextWithIssues(
  issueKeys: string[],
  options: MockContextOptions = {},
): SemanticReleaseContext {
  const commits = issueKeys.map((key, index) => ({
    hash: `hash${index}`,
    message: `feat(${key}): implement feature`,
  }));

  return createMockContext({
    ...options,
    commits,
  });
}
