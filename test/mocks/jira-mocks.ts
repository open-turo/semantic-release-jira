/**
 * Jira HTTP mock utilities for testing
 *
 * Factory functions for creating nock() HTTP mocks for common Jira API patterns.
 *
 * @example
 * ```typescript
 * // Mock complete Jira workflow
 * const scopes = mockJiraFullWorkflow({
 *   serverUrl: 'https://company.atlassian.net',
 *   username: 'user@example.com',
 *   issues: [
 *     { key: 'PROJ-123', summary: 'Add feature' },
 *     { key: 'PROJ-456', summary: 'Fix bug' }
 *   ],
 *   includeTransitions: true
 * });
 *
 * // ... run your tests ...
 *
 * // Verify all mocks were called
 * expectAllScopesAreDone(scopes);
 * ```
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import nock from "nock";

/**
 * Options for configuring Jira authentication mocks
 */
export interface JiraMockOptions {
  apiToken?: string;
  serverUrl: string;
  username?: string;
}

/**
 * Options for configuring mock issue data
 */
export interface MockIssueOptions {
  key: string;
  statusId?: string;
  statusName?: string;
  summary?: string;
}

/**
 * Options for configuring a full Jira workflow mock
 */
export interface MockJiraFullWorkflowOptions {
  apiToken?: string;
  includeTransitions?: boolean;
  includeVersions?: boolean;
  issues: MockIssueOptions[];
  projectKey?: string;
  serverUrl: string;
  username?: string;
  versionName?: string;
}

/**
 * Default Jira server configuration for tests
 */
export const DEFAULT_TEST_JIRA_CONFIG = {
  apiToken: "test-api-token",
  serverUrl: "https://test.atlassian.net",
  username: "test@example.com",
} as const;

/**
 * Mock Jira authentication endpoint
 *
 * Mocks GET /rest/api/2/myself which verifies credentials
 *
 * @param options - Authentication configuration
 * @returns nock.Scope for assertion verification
 *
 * @example
 * ```typescript
 * const authScope = mockJiraAuth({
 *   serverUrl: 'https://company.atlassian.net',
 *   username: 'user@example.com'
 * });
 * ```
 */
export function mockJiraAuth(options: JiraMockOptions): nock.Scope {
  const { serverUrl, username = "test@example.com" } = options;
  return nock(serverUrl)
    .get("/rest/api/2/myself")
    .reply(200, { emailAddress: username });
}

/**
 * Mock a Jira endpoint that returns an error
 *
 * Convenience function for testing error scenarios.
 *
 * @param serverUrl - Jira server URL
 * @param endpoint - API endpoint path
 * @param statusCode - HTTP status code
 * @param errorMessage - Error message
 * @returns nock.Scope for assertion verification
 *
 * @example
 * ```typescript
 * const scope = mockJiraError(
 *   'https://company.atlassian.net',
 *   '/rest/api/2/issue/PROJ-123',
 *   404,
 *   'Issue does not exist'
 * );
 * ```
 */
export function mockJiraError(
  serverUrl: string,
  endpoint: string,
  statusCode: number,
  errorMessage: string,
): nock.Scope {
  return nock(serverUrl)
    .get(endpoint)
    .reply(statusCode, createJiraErrorResponse(errorMessage));
}

/**
 * Convenience function to mock a complete Jira workflow
 *
 * Creates all necessary mocks for a typical test scenario including:
 * - Authentication
 * - Issue verification
 * - Issue summaries
 * - Transitions (optional)
 * - Version creation (optional)
 *
 * @param options - Full workflow configuration
 * @returns Array of nock.Scope for assertion verification
 *
 * @example
 * ```typescript
 * const scopes = mockJiraFullWorkflow({
 *   serverUrl: 'https://company.atlassian.net',
 *   username: 'user@example.com',
 *   issues: [
 *     { key: 'PROJ-123', summary: 'Add feature' },
 *     { key: 'PROJ-456', summary: 'Fix bug' }
 *   ],
 *   includeTransitions: true,
 *   includeVersions: true,
 *   projectKey: 'PROJ',
 *   versionName: 'v1.2.0'
 * });
 * ```
 */
export function mockJiraFullWorkflow(
  options: MockJiraFullWorkflowOptions,
): nock.Scope[] {
  const scopes: nock.Scope[] = [
    mockJiraAuth(options),
    mockJiraIssueVerification(
      options.serverUrl,
      options.issues.map((issue) => issue.key),
    ),
    mockJiraIssueSummaries(options.serverUrl, options.issues),
  ];

  if (options.includeTransitions) {
    scopes.push(mockJiraTransitions(options.serverUrl, options.issues));
  }

  if (options.includeVersions && options.projectKey && options.versionName) {
    scopes.push(
      mockJiraVersionCreation(
        options.serverUrl,
        options.projectKey,
        options.versionName,
        options.issues.map((issue) => issue.key),
      ),
    );
  }

  return scopes;
}

/**
 * Mock Jira issue summary endpoints
 *
 * Mocks GET /rest/api/2/issue/{key}?fields=summary for multiple issues
 *
 * @param serverUrl - Jira server URL
 * @param issues - Array of issue configurations
 * @returns nock.Scope for assertion verification
 *
 * @example
 * ```typescript
 * const scope = mockJiraIssueSummaries(
 *   'https://company.atlassian.net',
 *   [
 *     { key: 'PROJ-123', summary: 'Add feature' },
 *     { key: 'PROJ-456', summary: 'Fix bug' }
 *   ]
 * );
 * ```
 */
export function mockJiraIssueSummaries(
  serverUrl: string,
  issues: MockIssueOptions[],
): nock.Scope {
  let scope = nock(serverUrl);
  for (const issue of issues) {
    scope = scope
      .get(`/rest/api/2/issue/${issue.key}?fields=summary`)
      .reply(200, {
        fields: { summary: issue.summary ?? "Test summary" },
        key: issue.key,
      });
  }
  return scope;
}

/**
 * Mock Jira issue verification endpoints
 *
 * Mocks GET /rest/api/2/issue/{key}?fields=key for multiple issues
 *
 * @param serverUrl - Jira server URL
 * @param issues - Array of issue keys to verify
 * @returns nock.Scope for assertion verification
 *
 * @example
 * ```typescript
 * const scope = mockJiraIssueVerification(
 *   'https://company.atlassian.net',
 *   ['PROJ-123', 'PROJ-456']
 * );
 * ```
 */
export function mockJiraIssueVerification(
  serverUrl: string,
  issues: string[],
): nock.Scope {
  let scope = nock(serverUrl);
  for (const key of issues) {
    scope = scope
      .get(`/rest/api/2/issue/${key}?fields=key`)
      .reply(200, { key });
  }
  return scope;
}

/**
 * Mock Jira issue transition endpoints
 *
 * Mocks GET /rest/api/2/issue/{key}/transitions and POST to transition issues
 *
 * @param serverUrl - Jira server URL
 * @param issues - Array of issue configurations with optional status info
 * @returns nock.Scope for assertion verification
 *
 * @example
 * ```typescript
 * const scope = mockJiraTransitions(
 *   'https://company.atlassian.net',
 *   [
 *     { key: 'PROJ-123', statusId: '31', statusName: 'Done' },
 *     { key: 'PROJ-456' } // Uses default status
 *   ]
 * );
 * ```
 */
export function mockJiraTransitions(
  serverUrl: string,
  issues: MockIssueOptions[],
): nock.Scope {
  let scope = nock(serverUrl);
  for (const issue of issues) {
    const statusId = issue.statusId ?? "31";
    const statusName = issue.statusName ?? "Done";

    scope = scope
      .get(`/rest/api/2/issue/${issue.key}/transitions`)
      .reply(200, {
        transitions: [
          {
            id: statusId,
            name: statusName,
            to: { id: "10001", name: statusName },
          },
        ],
      })
      .post(`/rest/api/2/issue/${issue.key}/transitions`, {
        transition: { id: statusId },
      })
      .reply(204);
  }
  return scope;
}

/**
 * Mock Jira version creation endpoints
 *
 * Mocks project lookup, version creation, and issue updates
 *
 * @param serverUrl - Jira server URL
 * @param projectKey - Project key (e.g., 'PROJ')
 * @param versionName - Version name to create
 * @param issueKeys - Issue keys to associate with version
 * @returns nock.Scope for assertion verification
 *
 * @example
 * ```typescript
 * const scope = mockJiraVersionCreation(
 *   'https://company.atlassian.net',
 *   'PROJ',
 *   'v1.2.0',
 *   ['PROJ-123', 'PROJ-456']
 * );
 * ```
 */
export function mockJiraVersionCreation(
  serverUrl: string,
  projectKey: string,
  versionName: string,
  issueKeys: string[],
): nock.Scope {
  let scope = nock(serverUrl)
    .get(`/rest/api/2/project/${projectKey}`)
    .reply(200, { id: "10000", key: projectKey })
    .get(`/rest/api/2/project/${projectKey}/versions`)
    .reply(200, [])
    .post("/rest/api/2/version")
    .reply(200, { id: "20000", name: versionName });

  for (const key of issueKeys) {
    scope = scope.put(`/rest/api/2/issue/${key}`).reply(204);
  }

  return scope;
}

/**
 * Create a mock Jira error response
 *
 * Helper to create consistent error responses for testing.
 *
 * @param message - Error message
 * @returns Jira API error response object
 */
function createJiraErrorResponse(message: string): {
  errorMessages: string[];
} {
  return { errorMessages: [message] };
}
