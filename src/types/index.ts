/**
 * Type definitions for semantic-release-jira plugin
 */

export interface CollectedIssues {
  issues: Set<string>;
  sources: {
    branch: number;
    commits: number;
    pullRequests: number;
  };
}

export interface GitHubPullRequest {
  body: string | undefined;
  merged: boolean;
  number: number;
  state: string;
}

export interface JiraIssue {
  key: string;
  projectKey: string;
  summary?: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
  };
}

export interface JiraVersion {
  id: string;
  name: string;
  projectId: string;
}

export interface PluginConfig {
  /**
   * Maximum number of concurrent HTTP requests
   * @default 10
   */
  concurrency?: number;

  /**
   * Whether to create versions in Jira
   * @default false
   */
  createVersions?: boolean;

  /**
   * Custom regex pattern for matching Jira issues
   * @default "[A-Z][A-Z0-9]+-\\d+"
   */
  customIssuePattern?: string;

  /**
   * Dry run mode - log actions without executing them
   * @default false
   */
  dryRun?: boolean;

  /**
   * Fail the release if Jira operations error
   * If false, logs errors but continues release
   * @default false
   */
  failOnJiraError?: boolean;

  /**
   * Jira API token for authentication (optional)
   * Required for write operations (transitionIssues, createVersions)
   */
  jiraApiToken?: string;

  /**
   * Jira server URL (required)
   * @example "https://company.atlassian.net"
   */
  jiraServerUrl: string;

  /**
   * Jira username for authentication (optional)
   * Required for write operations (transitionIssues, createVersions)
   */
  jiraUsername?: string;

  // NEW - Reliability Configuration

  /**
   * Validate SSL/TLS certificates
   * Set to false for self-signed certificates (not recommended for production)
   * @default true
   */
  rejectUnauthorized?: boolean;

  /**
   * Number of retry attempts for failed HTTP requests
   * @default 3
   */
  retries?: number;

  /**
   * Initial retry delay in milliseconds (uses exponential backoff)
   * @default 1000 (1 second)
   */
  retryDelay?: number;

  /**
   * HTTP timeout in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  // NEW - Feature Flags

  /**
   * Whether to transition issues to done status
   * @default false
   */
  transitionIssues?: boolean;

  /**
   * Custom status name to transition issues to
   * If not set, will fuzzy match against "done", "closed", "completed", "resolved"
   * @default undefined
   */
  transitionToStatus?: string;

  // NEW - TLS Configuration

  /**
   * Custom prefix for version names
   * If not set, uses repository name
   * @default repository name
   */
  versionPrefix?: string;
}

/**
 * Result type for operations that can succeed or fail
 * Used for error handling without throwing exceptions
 */
export type Result<T, E = string> =
  | { data: T; success: true }
  | { error: E; success: false };

export interface SemanticReleaseContext {
  branch: {
    main?: string;
    name: string;
  };
  commits: Array<{
    hash: string;
    message: string;
  }>;
  cwd: string;
  env: Record<string, string | undefined>;
  logger: {
    error: (message: string, ...arguments_: unknown[]) => void;
    log: (message: string, ...arguments_: unknown[]) => void;
    success: (message: string, ...arguments_: unknown[]) => void;
  };
  nextRelease: {
    notes: string;
    type: string;
    version: string;
  };
}

/**
 * Validated plugin configuration with all defaults applied
 */
export interface ValidatedPluginConfig {
  concurrency: number;

  // Optional with defaults applied
  createVersions: boolean;
  customIssuePattern?: string;
  dryRun: boolean;
  failOnJiraError: boolean;
  jiraApiToken?: string;
  // Required fields (validated)
  jiraServerUrl: string;
  // Optional without defaults
  jiraUsername?: string;
  rejectUnauthorized: boolean;
  retries: number;

  retryDelay: number;
  timeout: number;
  transitionIssues: boolean;
  transitionToStatus?: string;
  versionPrefix?: string;
}
