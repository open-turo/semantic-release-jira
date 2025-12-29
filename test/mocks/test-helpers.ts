/**
 * Test helper utilities
 *
 * Assertion and validation helpers for common test patterns.
 *
 * @example
 * ```typescript
 * // Check log output
 * expectLogContains(context.logger, 'configuration validated');
 *
 * // Verify no errors
 * expectNoErrorLogs(context.logger);
 *
 * // Verify nock scopes
 * expectAllScopesAreDone([authScope, issueScope, summaryScope]);
 * ```
 */

import type nock from "nock";
import type { Mock } from "vitest";

// eslint-disable-next-line import/no-extraneous-dependencies
import { cleanAll, disableNetConnect, enableNetConnect } from "nock";
// eslint-disable-next-line import/no-extraneous-dependencies
import { expect, vi } from "vitest";

import type { SemanticReleaseContext } from "~/types/index.js";
import type { Logger } from "~/utils/logger.js";

/**
 * Mock logger with call tracking
 */
export interface MockLoggerWithCalls extends Logger {
  errorCalls: string[];
  logCalls: string[];
  successCalls: string[];
}

/**
 * Create a mock logger with call tracking for testing
 *
 * Returns a logger that implements the Logger interface and tracks
 * all calls to error, log, and success methods in arrays for assertion.
 *
 * @returns Mock logger with call arrays
 *
 * @example
 * ```typescript
 * const mockLogger = createMockLogger();
 * const logger = new StructuredLogger(mockLogger);
 *
 * logger.log("Test message");
 *
 * expect(mockLogger.logCalls).toHaveLength(1);
 * expect(mockLogger.logCalls[0]).toBe("Test message");
 * ```
 */
export function createMockLogger(): MockLoggerWithCalls {
  const errorCalls: string[] = [];
  const logCalls: string[] = [];
  const successCalls: string[] = [];

  return {
    error: vi.fn((message: string) => {
      errorCalls.push(message);
    }),
    errorCalls,
    log: vi.fn((message: string) => {
      logCalls.push(message);
    }),
    logCalls,
    success: vi.fn((message: string) => {
      successCalls.push(message);
    }),
    successCalls,
  };
}

/**
 * Assert that all nock HTTP mocks were called
 *
 * Verifies that every nock scope's expected HTTP calls were made.
 * Fails the test if any mock was not fully consumed.
 *
 * @param scopes - Array of nock.Scope instances to verify
 *
 * @example
 * ```typescript
 * const scopes = mockJiraFullWorkflow({
 *   serverUrl: 'https://company.atlassian.net',
 *   issues: [{ key: 'PROJ-123' }]
 * });
 *
 * await plugin.verifyConditions(config, context);
 *
 * expectAllScopesAreDone(scopes);
 * ```
 */
export function expectAllScopesAreDone(scopes: nock.Scope[]): void {
  for (const scope of scopes) {
    expect(scope.isDone()).toBeTruthy();
  }
}

/**
 * Assert that logger.error was called with specific text
 *
 * Searches through error calls for the specified text.
 * Fails the test if the text is not found in any error call.
 *
 * @param logger - Semantic-release logger instance
 * @param text - Text to search for in error logs
 *
 * @example
 * ```typescript
 * const context = createMockContext();
 * await plugin.verifyConditions(invalidConfig, context);
 *
 * expectErrorLogContains(context.logger, 'Invalid configuration');
 * ```
 */
export function expectErrorLogContains(
  logger: SemanticReleaseContext["logger"],
  text: string,
): void {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const errorCalls = (logger.error as Mock).mock.calls;

  const found = errorCalls.some((call) =>
    call.some(
      (argument: unknown) =>
        typeof argument === "string" && argument.includes(text),
    ),
  );

  expect(found).toBe(true);
}

/**
 * Assert that logger output contains a specific text string
 *
 * Searches through all log and success calls for the specified text.
 * Fails the test if the text is not found in any log call.
 *
 * @param logger - Semantic-release logger instance
 * @param text - Text to search for in log output
 *
 * @example
 * ```typescript
 * const context = createMockContext();
 * await plugin.verifyConditions(config, context);
 *
 * expectLogContains(context.logger, 'configuration validated');
 * expectLogContains(context.logger, 'Found 2 Jira issues');
 * ```
 */
export function expectLogContains(
  logger: SemanticReleaseContext["logger"],
  text: string,
): void {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const logCalls = (logger.log as Mock).mock.calls;
  const successCalls = logger.success
    ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (logger.success as Mock).mock.calls
    : [];
  const allCalls = [...logCalls, ...successCalls];

  const found = allCalls.some((call) =>
    call.some(
      (argument: unknown) =>
        typeof argument === "string" && argument.includes(text),
    ),
  );

  expect(found).toBe(true);
}

/**
 * Assert that no error logs were recorded
 *
 * Fails the test if logger.error was called at any point.
 * Useful for verifying successful execution without errors.
 *
 * @param logger - Semantic-release logger instance
 *
 * @example
 * ```typescript
 * const context = createMockContext();
 * await plugin.verifyConditions(config, context);
 *
 * expectNoErrorLogs(context.logger);
 * ```
 */
export function expectNoErrorLogs(
  logger: SemanticReleaseContext["logger"],
): void {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  expect((logger.error as Mock).mock.calls).toHaveLength(0);
}

/**
 * Setup function for nock-based HTTP mocking
 *
 * Disables all network connections except localhost (for Octokit internals).
 * Call this in beforeEach hooks for tests using nock.
 *
 * @example
 * ```typescript
 * beforeEach(() => {
 *   setupNockEnvironment();
 * });
 * ```
 */
export function setupNockEnvironment(): void {
  disableNetConnect();
  enableNetConnect("127.0.0.1");
}

/**
 * Teardown function for nock-based HTTP mocking
 *
 * Cleans all pending nock mocks and re-enables network connections.
 * Call this in afterEach hooks for tests using nock.
 *
 * @example
 * ```typescript
 * afterEach(() => {
 *   teardownNockEnvironment();
 * });
 * ```
 */
export function teardownNockEnvironment(): void {
  cleanAll();
  enableNetConnect();
}
