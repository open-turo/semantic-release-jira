import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { validateConfig } from "~/config/validate.js";

import {
  DEFAULT_VALUES,
  ENV_VAR_SETS,
  MINIMAL_CONFIG,
  setEnvironmentVariables,
} from "./test-helpers.js";

describe("validateConfig - Environment Variable Integration", () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = { ...originalEnvironment };
  });

  afterEach(() => {
    process.env = originalEnvironment;
  });

  describe("Environment variable loading", () => {
    it("should load jiraServerUrl from environment variable", () => {
      setEnvironmentVariables(ENV_VAR_SETS.minimal);
      const config = validateConfig({});

      expect(config.jiraServerUrl).toBe(
        ENV_VAR_SETS.minimal.SEMANTIC_RELEASE_JIRA_SERVER_URL,
      );
    });

    it("should load string options from environment variables", () => {
      setEnvironmentVariables(ENV_VAR_SETS.allStrings);
      const config = validateConfig({});

      expect(config).toMatchObject({
        customIssuePattern: String.raw`[A-Z]+-\d+`,
        jiraApiToken: "env-token",
        jiraServerUrl: "https://env.atlassian.net",
        jiraUsername: "env@example.com",
        transitionToStatus: "In Progress",
        versionPrefix: "EnvService",
      });
    });

    it("should load boolean options from environment variables", () => {
      setEnvironmentVariables(ENV_VAR_SETS.allBooleans);
      const config = validateConfig({});

      expect(config).toMatchObject({
        createVersions: true,
        dryRun: true,
        failOnJiraError: true,
        rejectUnauthorized: false,
        transitionIssues: true,
      });
    });

    it("should load numeric options from environment variables", () => {
      setEnvironmentVariables(ENV_VAR_SETS.allNumbers);
      const config = validateConfig({});

      expect(config).toMatchObject({
        concurrency: 5,
        retries: 5,
        retryDelay: 2000,
        timeout: 60_000,
      });
    });

    it("should load all 15 environment variables together", () => {
      const allEnvironmentVariables = {
        SEMANTIC_RELEASE_JIRA_API_TOKEN: "all-token",
        SEMANTIC_RELEASE_JIRA_CONCURRENCY: "20",
        SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS: "true",
        SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN: String.raw`ALL-\d+`,
        SEMANTIC_RELEASE_JIRA_DRY_RUN: "true",
        SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR: "true",
        SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED: "false",
        SEMANTIC_RELEASE_JIRA_RETRIES: "7",
        SEMANTIC_RELEASE_JIRA_RETRY_DELAY: "3000",
        SEMANTIC_RELEASE_JIRA_SERVER_URL: "https://all.atlassian.net",
        SEMANTIC_RELEASE_JIRA_TIMEOUT: "45000",
        SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES: "true",
        SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS: "All Done",
        SEMANTIC_RELEASE_JIRA_USERNAME: "all@example.com",
        SEMANTIC_RELEASE_JIRA_VERSION_PREFIX: "AllService",
      };

      setEnvironmentVariables(allEnvironmentVariables);
      const config = validateConfig({});

      expect(config).toMatchObject({
        concurrency: 20,
        createVersions: true,
        customIssuePattern: String.raw`ALL-\d+`,
        dryRun: true,
        failOnJiraError: true,
        jiraApiToken: "all-token",
        jiraServerUrl: "https://all.atlassian.net",
        jiraUsername: "all@example.com",
        rejectUnauthorized: false,
        retries: 7,
        retryDelay: 3000,
        timeout: 45_000,
        transitionIssues: true,
        transitionToStatus: "All Done",
        versionPrefix: "AllService",
      });
    });
  });

  describe("Environment variable precedence", () => {
    it("should prioritize environment variable over config file for jiraServerUrl", () => {
      setEnvironmentVariables(ENV_VAR_SETS.minimal);
      const config = validateConfig({
        jiraServerUrl: "https://config.atlassian.net",
      });

      expect(config.jiraServerUrl).toBe(
        ENV_VAR_SETS.minimal.SEMANTIC_RELEASE_JIRA_SERVER_URL,
      );
    });

    it("should prioritize environment variables over config file for all options", () => {
      setEnvironmentVariables({
        ...ENV_VAR_SETS.withCredentials,
        SEMANTIC_RELEASE_JIRA_CONCURRENCY: "15",
        SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES: "true",
      });

      const config = validateConfig({
        concurrency: 5,
        jiraApiToken: "config-token",
        jiraServerUrl: "https://config.atlassian.net",
        jiraUsername: "config@example.com",
        transitionIssues: false,
      });

      expect(config).toMatchObject({
        concurrency: 15,
        jiraApiToken: "env-token",
        jiraServerUrl: "https://env.atlassian.net",
        jiraUsername: "env@example.com",
        transitionIssues: true,
      });
    });

    it("should use config file value when environment variable is not set", () => {
      const config = validateConfig({
        ...MINIMAL_CONFIG,
        jiraApiToken: "config-token",
        jiraUsername: "config@example.com",
        transitionIssues: true,
      });

      expect(config.jiraServerUrl).toBe(MINIMAL_CONFIG.jiraServerUrl);
      expect(config.jiraUsername).toBe("config@example.com");
      expect(config.transitionIssues).toBe(true);
    });
  });

  describe("Default values", () => {
    it("should apply defaults when neither env var nor config file sets value", () => {
      setEnvironmentVariables(ENV_VAR_SETS.minimal);
      const config = validateConfig({});

      expect(config).toMatchObject({
        concurrency: DEFAULT_VALUES.concurrency,
        createVersions: DEFAULT_VALUES.createVersions,
        dryRun: DEFAULT_VALUES.dryRun,
        failOnJiraError: DEFAULT_VALUES.failOnJiraError,
        rejectUnauthorized: DEFAULT_VALUES.rejectUnauthorized,
        retries: DEFAULT_VALUES.retries,
        retryDelay: DEFAULT_VALUES.retryDelay,
        timeout: DEFAULT_VALUES.timeout,
        transitionIssues: DEFAULT_VALUES.transitionIssues,
      });
    });

    it("should not apply defaults when environment variable sets value", () => {
      setEnvironmentVariables({
        ...ENV_VAR_SETS.minimal,
        SEMANTIC_RELEASE_JIRA_CONCURRENCY: "25",
        SEMANTIC_RELEASE_JIRA_DRY_RUN: "true",
      });

      const config = validateConfig({});

      expect(config).toMatchObject({
        concurrency: 25,
        dryRun: true,
      });
    });
  });

  describe("Type validation", () => {
    it.each([
      {
        envVar: "SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES",
        value: "not-a-boolean",
      },
      { envVar: "SEMANTIC_RELEASE_JIRA_CONCURRENCY", value: "not-a-number" },
    ])(
      "should throw error if $envVar has invalid value",
      ({ envVar, value }) => {
        setEnvironmentVariables({
          ...ENV_VAR_SETS.minimal,
          [envVar]: value,
        });

        expect(() => validateConfig({})).toThrow(
          "Invalid environment variables",
        );
      },
    );

    it("should accept '1' and '0' for boolean values", () => {
      setEnvironmentVariables({
        ...ENV_VAR_SETS.withCredentials,
        SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS: "0",
        SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES: "1",
      });

      const config = validateConfig({});

      expect(config).toMatchObject({
        createVersions: false,
        transitionIssues: true,
      });
    });
  });

  describe("Enhanced error messages", () => {
    it("should mention environment variable in jiraServerUrl error", () => {
      expect(() => validateConfig({})).toThrow(
        "SEMANTIC_RELEASE_JIRA_SERVER_URL",
      );
    });

    it("should mention environment variables in credentials error", () => {
      setEnvironmentVariables({
        ...ENV_VAR_SETS.minimal,
        SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES: "true",
      });

      expect(() => validateConfig({})).toThrow(
        "SEMANTIC_RELEASE_JIRA_USERNAME",
      );
      expect(() => validateConfig({})).toThrow(
        "SEMANTIC_RELEASE_JIRA_API_TOKEN",
      );
    });
  });

  describe("Edge cases", () => {
    it("should treat empty string environment variables as empty strings (not undefined)", () => {
      setEnvironmentVariables({
        ...ENV_VAR_SETS.minimal,
        SEMANTIC_RELEASE_JIRA_VERSION_PREFIX: "",
      });

      const config = validateConfig({});

      expect(config.versionPrefix).toBe("");
    });

    it.each([
      {
        envVar: "SEMANTIC_RELEASE_JIRA_SERVER_URL",
        error: "Invalid jiraServerUrl",
        value: "not-a-url",
      },
      {
        envVar: "SEMANTIC_RELEASE_JIRA_CONCURRENCY",
        error: "Invalid concurrency: must be between 1 and 100",
        value: "150",
      },
      {
        envVar: "SEMANTIC_RELEASE_JIRA_RETRIES",
        error: "Invalid retries: must be between 0 and 10",
        value: "15",
      },
    ])(
      "should validate $envVar against existing validators",
      ({ envVar, error, value }) => {
        setEnvironmentVariables({
          ...ENV_VAR_SETS.minimal,
          [envVar]: value,
        });

        expect(() => validateConfig({})).toThrow(error);
      },
    );

    it("should allow credentials from environment variables for write operations", () => {
      setEnvironmentVariables({
        ...ENV_VAR_SETS.withCredentials,
        SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS: "true",
        SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES: "true",
      });

      const config = validateConfig({});

      expect(config).toMatchObject({
        createVersions: true,
        jiraApiToken: "env-token",
        jiraUsername: "env@example.com",
        transitionIssues: true,
      });
    });
  });
});
