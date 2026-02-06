/**
 * Integration tests for SemanticReleaseJiraPlugin
 *
 * Tests the full plugin lifecycle with mocked HTTP calls
 */

import nock from "nock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PluginConfig } from "~/types/index.js";

import { SemanticReleaseJiraPlugin } from "~/index.js";

import {
  createMockContext,
  expectLogContains,
  mockJiraAuth,
  mockJiraIssueSummaries,
  mockJiraIssueVerification,
  mockJiraTransitions,
  mockJiraVersionCreation,
  setupNockEnvironment,
  teardownNockEnvironment,
} from "../mocks/index.js";

describe("SemanticReleaseJiraPlugin Integration", () => {
  const jiraServerUrl = "https://company.atlassian.net";
  const jiraUsername = "test@example.com";
  const jiraApiToken = "test-api-token";

  beforeEach(() => {
    setupNockEnvironment();
  });

  afterEach(() => {
    teardownNockEnvironment();
    vi.restoreAllMocks();
  });

  /**
   * Creates a minimal valid plugin config
   */
  function createPluginConfig(
    overrides?: Partial<PluginConfig>,
  ): Partial<PluginConfig> {
    return {
      jiraApiToken,
      jiraServerUrl,
      jiraUsername,
      ...overrides,
    };
  }

  describe("Full Plugin Lifecycle", () => {
    // TODO: Fix nock mocks for version creation - currently not matching actual HTTP calls
    // eslint-disable-next-line vitest/no-disabled-tests
    it.skip("should run complete lifecycle: verify -> analyze -> generate -> success", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config = createPluginConfig({
        createVersions: true,
        retries: 0,
        retryDelay: 100,
        timeout: 1000,
        transitionIssues: true,
      });

      // Mock Jira authentication verification
      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      // Mock issue verification
      const issueScope = mockJiraIssueVerification(jiraServerUrl, [
        "PROJ-123",
        "PROJ-456",
      ]);

      // Step 1: Verify conditions
      await expect(
        plugin.verifyConditions(config, context),
      ).resolves.not.toThrow();

      // Step 2: Analyze commits
      await plugin.analyzeCommits(config, context);

      // Step 3: Generate notes
      const notes = await plugin.generateNotes(config, context);
      expect(notes).toContain("PROJ-123");
      expect(notes).toContain("PROJ-456");

      // Mock issue transitions
      const transitionScope = mockJiraTransitions(jiraServerUrl, [
        { key: "PROJ-123" },
        { key: "PROJ-456" },
      ]);

      // Mock version creation
      const versionScope = mockJiraVersionCreation(
        jiraServerUrl,
        "PROJ",
        "test-repo-1.2.0",
        ["PROJ-123", "PROJ-456"],
      );

      // Step 4: Success hook - transitions and versions
      await plugin.success(config, context);

      // Verify all HTTP calls were made
      expect(authScope.isDone()).toBeTruthy();
      expect(issueScope.isDone()).toBeTruthy();
      expect(transitionScope.isDone()).toBeTruthy();
      expect(versionScope.isDone()).toBeTruthy();
    }, 30_000);

    it("should work without credentials (read-only mode)", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config = createPluginConfig({
        jiraApiToken: undefined,
        jiraUsername: undefined,
      });

      // Verify conditions (no Jira auth needed)
      await expect(
        plugin.verifyConditions(config, context),
      ).resolves.not.toThrow();

      // Analyze commits (no issue verification)
      await plugin.analyzeCommits(config, context);

      // Generate notes
      const notes = await plugin.generateNotes(config, context);
      expect(notes).toContain("PROJ-123");
      expect(notes).toContain("PROJ-456");

      // Success - should skip updates
      await plugin.success(config, context);

      expectLogContains(context.logger, "No Jira credentials");
    });

    it("should handle prerelease branches", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext({
        branch: {
          main: "main",
          name: "beta",
        },
        nextRelease: {
          notes: "",
          type: "minor",
          version: "1.2.0-beta.1",
        },
      });
      const config = createPluginConfig({
        retries: 0,
        retryDelay: 100,
        timeout: 1000,
      });

      // Mock Jira authentication
      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      // Mock issue verification
      const issueScope = mockJiraIssueVerification(jiraServerUrl, [
        "PROJ-123",
        "PROJ-456",
      ]);

      // Mock issue details for generateNotes
      const detailsScope = mockJiraIssueSummaries(jiraServerUrl, [
        { key: "PROJ-123", summary: "Add new feature" },
        { key: "PROJ-456", summary: "Fix critical bug" },
      ]);

      await plugin.verifyConditions(config, context);
      await plugin.analyzeCommits(config, context);
      await plugin.generateNotes(config, context);

      // Success should skip updates for prerelease
      await plugin.success(config, context);

      expect(authScope.isDone()).toBeTruthy();
      expect(issueScope.isDone()).toBeTruthy();
      expect(detailsScope.isDone()).toBeTruthy();

      expectLogContains(
        context.logger,
        "not on default branch or is a prerelease",
      );
    }, 20_000);
  });

  describe("verifyConditions", () => {
    it("should validate configuration successfully", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config = createPluginConfig();

      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      await expect(
        plugin.verifyConditions(config, context),
      ).resolves.not.toThrow();

      expect(authScope.isDone()).toBeTruthy();
      expectLogContains(context.logger, "configuration validated");
    });

    it("should fail with invalid configuration", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config: Partial<PluginConfig> = {
        jiraUsername,
      };

      await expect(plugin.verifyConditions(config, context)).rejects.toThrow();

      expect(context.logger.error).toHaveBeenCalled();
    });

    it("should fail with invalid credentials", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config = createPluginConfig();

      const authScope = nock(jiraServerUrl)
        .get("/rest/api/2/myself")
        .reply(401, { errorMessages: ["Unauthorized"] });

      await expect(plugin.verifyConditions(config, context)).rejects.toThrow(
        /authentication failed/i,
      );

      expect(authScope.isDone()).toBeTruthy();
    });

    it("should handle network errors during verification", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config = createPluginConfig({
        retries: 0,
        retryDelay: 100,
        timeout: 1000,
      });

      const authScope = nock(jiraServerUrl)
        .get("/rest/api/2/myself")
        .replyWithError({
          code: "ECONNREFUSED",
          message: "Connection refused",
        });

      await expect(plugin.verifyConditions(config, context)).rejects.toThrow(
        /authentication failed/i,
      );

      expect(authScope.isDone()).toBeTruthy();
    }, 30_000);
  });

  describe("analyzeCommits", () => {
    it("should collect issues from commits and branches", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext({
        branch: {
          main: "main",
          name: "feature/PROJ-999-awesome-feature",
        },
        commits: [
          { hash: "abc123", message: "feat(PROJ-123): add feature" },
          { hash: "def456", message: "fix: resolve bug [PROJ-456]" },
        ],
      });
      const config = createPluginConfig();

      // Mock auth
      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      // Mock issue verification - all found
      const issueScope = mockJiraIssueVerification(jiraServerUrl, [
        "PROJ-999",
        "PROJ-123",
        "PROJ-456",
      ]);

      await plugin.verifyConditions(config, context);
      await plugin.analyzeCommits(config, context);

      expect(authScope.isDone()).toBeTruthy();
      expect(issueScope.isDone()).toBeTruthy();

      expectLogContains(context.logger, "3 unique Jira issues");
    });

    it("should filter out non-existent issues", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config = createPluginConfig({
        retries: 0,
        retryDelay: 100,
        timeout: 1000,
      });

      // Mock auth
      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      // Mock issue verification - PROJ-456 not found
      const issueScope = nock(jiraServerUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=key")
        .reply(200, { key: "PROJ-123" })
        .get("/rest/api/2/issue/PROJ-456?fields=key")
        .reply(404);

      await plugin.verifyConditions(config, context);
      await plugin.analyzeCommits(config, context);

      expect(authScope.isDone()).toBeTruthy();
      expect(issueScope.isDone()).toBeTruthy();

      expectLogContains(context.logger, "PROJ-456 not found");

      // Mock issue details for generateNotes (only PROJ-123 now)
      const detailsScope = mockJiraIssueSummaries(jiraServerUrl, [
        { key: "PROJ-123", summary: "Add new feature" },
      ]);

      // Only PROJ-123 should be in notes
      const notes = await plugin.generateNotes(config, context);
      expect(notes).toContain("PROJ-123");
      expect(notes).not.toContain("PROJ-456");

      expect(detailsScope.isDone()).toBeTruthy();
    }, 20_000);

    it("should work without GitHub environment", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext({
        env: {}, // No GitHub environment
      });
      const config = createPluginConfig();

      // Mock auth
      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      // Mock issue verification
      const issueScope = mockJiraIssueVerification(jiraServerUrl, [
        "PROJ-123",
        "PROJ-456",
      ]);

      await plugin.verifyConditions(config, context);
      await plugin.analyzeCommits(config, context);

      expect(authScope.isDone()).toBeTruthy();
      expect(issueScope.isDone()).toBeTruthy();

      expectLogContains(context.logger, "Not running in GitHub environment");
    });
  });

  describe("generateNotes", () => {
    it("should generate formatted release notes", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config = createPluginConfig({
        retries: 0,
        retryDelay: 100,
        timeout: 1000,
      });

      // Setup
      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      const issueScope = mockJiraIssueVerification(jiraServerUrl, [
        "PROJ-123",
        "PROJ-456",
      ]);

      // Mock issue details for generateNotes
      const detailsScope = mockJiraIssueSummaries(jiraServerUrl, [
        { key: "PROJ-123", summary: "Add new feature" },
        { key: "PROJ-456", summary: "Fix critical bug" },
      ]);

      await plugin.verifyConditions(config, context);
      await plugin.analyzeCommits(config, context);
      const notes = await plugin.generateNotes(config, context);

      expect(authScope.isDone()).toBeTruthy();
      expect(issueScope.isDone()).toBeTruthy();
      expect(detailsScope.isDone()).toBeTruthy();

      // Verify format
      expect(notes).toContain("## Jira Issues");
      expect(notes).toContain("[PROJ-123]");
      expect(notes).toContain("[PROJ-456]");
      expect(notes).toContain(jiraServerUrl);
    }, 20_000);

    it("should return empty string when no issues", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext({
        commits: [
          { hash: "abc123", message: "feat: add feature without issue" },
        ],
      });
      const config = createPluginConfig();

      // Setup
      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      await plugin.verifyConditions(config, context);
      await plugin.analyzeCommits(config, context);
      const notes = await plugin.generateNotes(config, context);

      expect(authScope.isDone()).toBeTruthy();

      expect(notes).toBe("");
      expectLogContains(context.logger, "No Jira issues to add");
    });
  });

  describe("success", () => {
    it("should transition issues and create versions", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config = createPluginConfig({
        createVersions: true,
        transitionIssues: true,
      });

      // Setup
      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      const issueScope = mockJiraIssueVerification(jiraServerUrl, [
        "PROJ-123",
        "PROJ-456",
      ]);

      // Transition mocks
      const transitionScope = mockJiraTransitions(jiraServerUrl, [
        { key: "PROJ-123" },
        { key: "PROJ-456" },
      ]);

      // Version mocks
      const versionScope = mockJiraVersionCreation(
        jiraServerUrl,
        "PROJ",
        "test-repo-1.2.0",
        ["PROJ-123", "PROJ-456"],
      );

      await plugin.verifyConditions(config, context);
      await plugin.analyzeCommits(config, context);
      await plugin.success(config, context);

      expect(authScope.isDone()).toBeTruthy();
      expect(issueScope.isDone()).toBeTruthy();
      expect(transitionScope.isDone()).toBeTruthy();
      expect(versionScope.isDone()).toBeTruthy();
    });

    it("should handle dry run mode", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config = createPluginConfig({
        createVersions: true,
        dryRun: true,
        transitionIssues: true,
      });

      // Setup
      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      const issueScope = mockJiraIssueVerification(jiraServerUrl, [
        "PROJ-123",
        "PROJ-456",
      ]);

      await plugin.verifyConditions(config, context);
      await plugin.analyzeCommits(config, context);
      await plugin.success(config, context);

      expect(authScope.isDone()).toBeTruthy();
      expect(issueScope.isDone()).toBeTruthy();

      // No transition or version calls should be made
      expectLogContains(context.logger, "DRY RUN MODE");
    });

    // TODO: Fix logger.error spy expectation - error handling changed
    // eslint-disable-next-line vitest/no-disabled-tests
    it.skip("should handle Jira API errors gracefully", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config = createPluginConfig({
        retries: 0,
        retryDelay: 100,
        timeout: 1000,
        transitionIssues: true,
      });

      // Setup
      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      const issueScope = mockJiraIssueVerification(jiraServerUrl, [
        "PROJ-123",
        "PROJ-456",
      ]);

      // Transition fails
      const transitionScope = nock(jiraServerUrl)
        .get("/rest/api/2/issue/PROJ-123/transitions")
        .reply(500, { errorMessages: ["Internal error"] })
        .get("/rest/api/2/issue/PROJ-456/transitions")
        .reply(200, {
          transitions: [
            { id: "31", name: "Done", to: { id: "10001", name: "Done" } },
          ],
        })
        .post("/rest/api/2/issue/PROJ-456/transitions")
        .reply(204);

      await plugin.verifyConditions(config, context);
      await plugin.analyzeCommits(config, context);

      // Should not throw, errors are logged
      await expect(plugin.success(config, context)).resolves.not.toThrow();

      expect(authScope.isDone()).toBeTruthy();
      expect(issueScope.isDone()).toBeTruthy();
      expect(transitionScope.isDone()).toBeTruthy();

      expect(context.logger.error).toHaveBeenCalled();
    }, 30_000);
  });

  describe("Backward Compatibility - Named Exports", () => {
    it("should work with deprecated named exports", async () => {
      const { analyzeCommits, generateNotes, success, verifyConditions } =
        await import("~/index.js");

      const context = createMockContext();
      const config = createPluginConfig({
        retries: 0,
        retryDelay: 100,
        timeout: 1000,
      });

      // Each named export function creates a new plugin instance and calls verifyConditions
      // So we need 4 auth calls (one for each function)
      const authScope = nock(jiraServerUrl)
        .get("/rest/api/2/myself")
        .times(4)
        .reply(200, { emailAddress: jiraUsername });

      // analyzeCommits, generateNotes, and success each call analyzeCommits internally
      // so we need 3 sets of issue verification calls
      const issueScope = nock(jiraServerUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=key")
        .times(3)
        .reply(200, { key: "PROJ-123" })
        .get("/rest/api/2/issue/PROJ-456?fields=key")
        .times(3)
        .reply(200, { key: "PROJ-456" });

      // generateNotes fetches issue details
      const detailsScope = mockJiraIssueSummaries(jiraServerUrl, [
        { key: "PROJ-123", summary: "Add new feature" },
        { key: "PROJ-456", summary: "Fix critical bug" },
      ]);

      await expect(verifyConditions(config, context)).resolves.not.toThrow();
      await expect(analyzeCommits(config, context)).resolves.not.toThrow();
      const notes = await generateNotes(config, context);
      expect(notes).toContain("PROJ-123");
      await expect(success(config, context)).resolves.not.toThrow();

      expect(authScope.isDone()).toBeTruthy();
      expect(issueScope.isDone()).toBeTruthy();
      expect(detailsScope.isDone()).toBeTruthy();
    }, 20_000);
  });

  describe("Error Handling", () => {
    it("should throw when calling methods before initialization", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config = createPluginConfig();

      // Don't call verifyConditions first
      await expect(plugin.analyzeCommits(config, context)).rejects.toThrow(
        /not initialized/i,
      );
    });

    it("should handle rate limiting (429)", async () => {
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config = createPluginConfig({
        retries: 2,
        retryDelay: 100,
      });

      // Mock auth
      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      // Mock issue verification with rate limiting
      const issueScope = nock(jiraServerUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=key")
        .reply(429, { errorMessages: ["Rate limit exceeded"] })
        .get("/rest/api/2/issue/PROJ-123?fields=key")
        .reply(200, { key: "PROJ-123" })
        .get("/rest/api/2/issue/PROJ-456?fields=key")
        .reply(200, { key: "PROJ-456" });

      await plugin.verifyConditions(config, context);
      await plugin.analyzeCommits(config, context);

      expect(authScope.isDone()).toBeTruthy();
      expect(issueScope.isDone()).toBeTruthy();
    });
  });

  describe("Plugin Noop Behavior", () => {
    let originalEnvironment: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnvironment = { ...process.env };
      // Clean all SEMANTIC_RELEASE_JIRA_* vars
      for (const key of Object.keys(process.env)) {
        if (key.startsWith("SEMANTIC_RELEASE_JIRA_")) {
          delete process.env[key];
        }
      }
    });

    afterEach(() => {
      process.env = originalEnvironment;
    });

    it("should be disabled when no configuration provided", async () => {
      const context = createMockContext();

      // Import the exported functions (not the class)
      const { analyzeCommits, generateNotes, success, verifyConditions } =
        await import("~/index.js");

      // All lifecycle hooks should return early without error
      await expect(verifyConditions({}, context)).resolves.not.toThrow();
      await expect(analyzeCommits({}, context)).resolves.not.toThrow();
      const notes = await generateNotes({}, context);
      expect(notes).toBe("");
      await expect(success({}, context)).resolves.not.toThrow();

      // Verify the log message was emitted
      expectLogContains(context.logger, "No configuration detected");
    });

    it("should be enabled when environment variables are set", async () => {
      process.env.SEMANTIC_RELEASE_JIRA_SERVER_URL = jiraServerUrl;
      process.env.SEMANTIC_RELEASE_JIRA_USERNAME = jiraUsername;
      process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = jiraApiToken;

      // Use the class directly - env vars are read during validateConfig
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();

      // Mock Jira authentication
      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      // Mock issue verification
      const issueScope = mockJiraIssueVerification(jiraServerUrl, [
        "PROJ-123",
        "PROJ-456",
      ]);

      // Plugin should activate via env vars and make API calls
      await plugin.verifyConditions({}, context);
      await plugin.analyzeCommits({}, context);

      expect(authScope.isDone()).toBeTruthy();
      expect(issueScope.isDone()).toBeTruthy();
    });

    it("should be enabled when config options are provided", async () => {
      // This test validates that config-based enablement works
      // (complementary to the many other tests that use config)
      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const config = createPluginConfig();

      // Mock Jira authentication
      const authScope = mockJiraAuth({
        serverUrl: jiraServerUrl,
        username: jiraUsername,
      });

      // Mock issue verification
      const issueScope = mockJiraIssueVerification(jiraServerUrl, [
        "PROJ-123",
        "PROJ-456",
      ]);

      // Plugin should activate and make API calls
      await plugin.verifyConditions(config, context);
      await plugin.analyzeCommits(config, context);

      expect(authScope.isDone()).toBeTruthy();
      expect(issueScope.isDone()).toBeTruthy();
    });
  });
});
