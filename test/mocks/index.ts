/**
 * Mock utilities for semantic-release-jira tests
 *
 * Centralized exports for all test mock utilities.
 * Import from this file to access any mock factory or helper function.
 *
 * @example
 * ```typescript
 * import {
 *   mockJiraFullWorkflow,
 *   createMockGitHubClientWithMergedPR,
 *   createMockContext,
 *   expectLogContains,
 *   expectAllScopesAreDone
 * } from '../mocks/index.js';
 * ```
 */

// Context mock utilities
export {
  createMockContext,
  createMockContextReadOnly,
  createMockContextWithIssue,
  createMockContextWithIssues,
} from "./context-mocks.js";

export type { MockCommit, MockContextOptions } from "./context-mocks.js";

// GitHub mock utilities
export {
  createMockGitHubClient,
  createMockGitHubClientWithError,
  createMockGitHubClientWithMergedPR,
  createMockGitHubClientWithMultiplePRs,
  createMockGitHubClientWithNoPRs,
  createMockGitHubClientWithUnmergedPR,
} from "./github-mocks.js";

export type { MockPullRequest } from "./github-mocks.js";

// Jira mock utilities
export {
  DEFAULT_TEST_JIRA_CONFIG,
  mockJiraAuth,
  mockJiraError,
  mockJiraFullWorkflow,
  mockJiraIssueSummaries,
  mockJiraIssueVerification,
  mockJiraTransitions,
  mockJiraVersionCreation,
} from "./jira-mocks.js";

export type {
  JiraMockOptions,
  MockIssueOptions,
  MockJiraFullWorkflowOptions,
} from "./jira-mocks.js";

// Test helper utilities
export {
  createMockLogger,
  expectAllScopesAreDone,
  expectErrorLogContains,
  expectLogCallCount,
  expectLogContains,
  expectNoErrorLogs,
  getLogMessages,
  setupNockEnvironment,
  teardownNockEnvironment,
} from "./test-helpers.js";

export type { MockLoggerWithCalls } from "./test-helpers.js";
