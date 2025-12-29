/**
 * Test helpers for configuration validation tests
 *
 * Provides reusable utilities for setting up test environments,
 * creating test configurations, and asserting validation results.
 */

import type { PluginConfig } from "~/types/index.js";

/**
 * Minimal valid configuration for basic tests
 */
export const MINIMAL_CONFIG: Partial<PluginConfig> = {
  jiraServerUrl: "https://company.atlassian.net",
};

/**
 * Default values that should be applied when not specified
 */
export const DEFAULT_VALUES = {
  concurrency: 10,
  createVersions: false,
  dryRun: false,
  failOnJiraError: false,
  rejectUnauthorized: true,
  retries: 3,
  retryDelay: 1000,
  timeout: 30_000,
  transitionIssues: false,
} as const;

/**
 * Sets multiple environment variables from a config-like object
 */
export function setEnvironmentVariables(
  environment: Partial<Record<string, string>>,
): void {
  for (const [key, value] of Object.entries(environment)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Sample ReDoS patterns for testing
 */
export const REDOS_PATTERNS = {
  deeplyNested: "((a+)+)+",
  greedyBacktrack: "(x+x+)+y",
  multipleNested: "(.*)*(.*)*",
  nestedCharClass: "([a-zA-Z]+)*",
  nestedPlus: "(a+)+b",
  nestedStar: "(a*)*b",
} as const;

/**
 * Sample safe regex patterns for testing
 */
export const SAFE_PATTERNS = {
  alternation: String.raw`(PROJECT|TEAM)-\d+`,
  charClassQuantifier: String.raw`[A-Z]{2,5}-\d{1,4}`,
  simple: String.raw`[A-Z]+-\d+`,
  simpleAlternationQuantifier: String.raw`(PROJ|TEAM)*-\d+`,
  singleLevel: String.raw`[A-Z]+\d+`,
} as const;

/**
 * Common environment variable sets for testing
 */
export const ENV_VAR_SETS = {
  allBooleans: {
    SEMANTIC_RELEASE_JIRA_API_TOKEN: "token",
    SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS: "true",
    SEMANTIC_RELEASE_JIRA_DRY_RUN: "true",
    SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR: "true",
    SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED: "false",
    SEMANTIC_RELEASE_JIRA_SERVER_URL: "https://env.atlassian.net",
    SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES: "true",
    SEMANTIC_RELEASE_JIRA_USERNAME: "user@example.com",
  },
  allNumbers: {
    SEMANTIC_RELEASE_JIRA_CONCURRENCY: "5",
    SEMANTIC_RELEASE_JIRA_RETRIES: "5",
    SEMANTIC_RELEASE_JIRA_RETRY_DELAY: "2000",
    SEMANTIC_RELEASE_JIRA_SERVER_URL: "https://env.atlassian.net",
    SEMANTIC_RELEASE_JIRA_TIMEOUT: "60000",
  },
  allStrings: {
    SEMANTIC_RELEASE_JIRA_API_TOKEN: "env-token",
    SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN: String.raw`[A-Z]+-\d+`,
    SEMANTIC_RELEASE_JIRA_SERVER_URL: "https://env.atlassian.net",
    SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS: "In Progress",
    SEMANTIC_RELEASE_JIRA_USERNAME: "env@example.com",
    SEMANTIC_RELEASE_JIRA_VERSION_PREFIX: "EnvService",
  },
  minimal: {
    SEMANTIC_RELEASE_JIRA_SERVER_URL: "https://env.atlassian.net",
  },
  withCredentials: {
    SEMANTIC_RELEASE_JIRA_API_TOKEN: "env-token",
    SEMANTIC_RELEASE_JIRA_SERVER_URL: "https://env.atlassian.net",
    SEMANTIC_RELEASE_JIRA_USERNAME: "env@example.com",
  },
} as const;
