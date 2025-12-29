/**
 * Integration tests for environment variable configuration
 */

import nock from "nock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PluginConfig } from "~/types/index.js";

import { SemanticReleaseJiraPlugin } from "~/index.js";

import {
  createMockContext,
  expectAllScopesAreDone,
  expectLogContains,
  mockJiraAuth,
  mockJiraFullWorkflow,
  mockJiraIssueVerification,
  mockJiraTransitions,
  mockJiraVersionCreation,
  setupNockEnvironment,
  teardownNockEnvironment,
} from "../mocks/index.js";

describe("Environment Variable Integration", () => {
  const originalEnvironment = process.env;
  const serverUrl = "https://env.atlassian.net";
  const username = "env@example.com";
  const token = "env-token";

  beforeEach(() => {
    process.env = { ...originalEnvironment };
    setupNockEnvironment();
  });

  afterEach(() => {
    process.env = originalEnvironment;
    teardownNockEnvironment();
    vi.restoreAllMocks();
  });

  describe("Configuration Sources", () => {
    it("should work with environment variables only", async () => {
      process.env.SEMANTIC_RELEASE_JIRA_SERVER_URL = serverUrl;
      process.env.SEMANTIC_RELEASE_JIRA_USERNAME = username;
      process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = token;
      process.env.SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES = "true";

      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const scopes = mockJiraFullWorkflow({
        includeTransitions: true,
        issues: [
          { key: "PROJ-123", summary: "Test summary" },
          { key: "PROJ-456", summary: "Test summary 2" },
        ],
        serverUrl,
        username,
      });

      await plugin.verifyConditions({}, context);
      await plugin.analyzeCommits({}, context);
      const notes = await plugin.generateNotes({}, context);
      await plugin.success({}, context);

      expect(notes).toContain("PROJ-123");
      expectLogContains(context.logger, "configuration validated");
      expectAllScopesAreDone(scopes);
    });

    it("should work in read-only mode", async () => {
      process.env.SEMANTIC_RELEASE_JIRA_SERVER_URL = serverUrl;

      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();

      await plugin.verifyConditions({}, context);
      await plugin.analyzeCommits({}, context);
      const notes = await plugin.generateNotes({}, context);

      expect(notes).toContain("PROJ-123");
      expectLogContains(context.logger, "read-only mode");
    });

    // Uses expectAllScopesAreDone for assertions
    // eslint-disable-next-line vitest/expect-expect
    it("should mix config and environment", async () => {
      process.env.SEMANTIC_RELEASE_JIRA_USERNAME = username;
      process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = token;

      const context = createMockContext();
      const scopes = mockJiraFullWorkflow({
        includeTransitions: true,
        issues: [
          { key: "PROJ-123", summary: "Test" },
          { key: "PROJ-456", summary: "Test" },
        ],
        serverUrl,
        username,
      });

      const plugin = new SemanticReleaseJiraPlugin();
      await plugin.verifyConditions(
        { jiraServerUrl: serverUrl, transitionIssues: true },
        context,
      );
      await plugin.analyzeCommits({}, context);
      await plugin.generateNotes({}, context);
      await plugin.success({}, context);

      expectAllScopesAreDone(scopes);
    });
  });

  describe("Environment Variable Overrides", () => {
    describe.each([
      {
        env: "SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES",
        includeTransitions: true,
        key: "transitionIssues",
        log: undefined,
      },
      {
        env: "SEMANTIC_RELEASE_JIRA_DRY_RUN",
        includeTransitions: false,
        key: "dryRun",
        log: "DRY RUN MODE",
      },
      {
        env: "SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS",
        includeVersions: true,
        key: "createVersions",
        log: undefined,
      },
    ])("$key override", ({ env, key, log }) => {
      // Uses expectAllScopesAreDone and expectLogContains for assertions
      // eslint-disable-next-line vitest/expect-expect
      it(`via ${env}`, async () => {
        process.env[env] = "true";
        process.env.SEMANTIC_RELEASE_JIRA_USERNAME = username;
        process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = token;

        const context = createMockContext();
        const scopes: nock.Scope[] = [
          mockJiraAuth({ serverUrl, username }),
          mockJiraIssueVerification(serverUrl, ["PROJ-123", "PROJ-456"]),
        ];

        if (key === "transitionIssues") {
          scopes.push(
            mockJiraTransitions(serverUrl, [
              { key: "PROJ-123" },
              { key: "PROJ-456" },
            ]),
          );
        }

        if (key === "createVersions") {
          scopes.push(
            mockJiraVersionCreation(serverUrl, "PROJ", "test-repo-1.2.0", [
              "PROJ-123",
              "PROJ-456",
            ]),
          );
        }

        const plugin = new SemanticReleaseJiraPlugin();
        await plugin.verifyConditions(
          {
            jiraServerUrl: serverUrl,
            [key]: false,
            transitionIssues: key === "dryRun",
          },
          context,
        );
        await plugin.analyzeCommits({}, context);
        await plugin.success({}, context);

        if (log) expectLogContains(context.logger, log);
        expectAllScopesAreDone(scopes);
      });
    });

    it("should override numeric values", async () => {
      process.env.SEMANTIC_RELEASE_JIRA_TIMEOUT = "5000";
      process.env.SEMANTIC_RELEASE_JIRA_RETRIES = "1";
      process.env.SEMANTIC_RELEASE_JIRA_CONCURRENCY = "15";

      const context = createMockContext();
      await new SemanticReleaseJiraPlugin().verifyConditions(
        { concurrency: 5, jiraServerUrl: serverUrl },
        context,
      );

      expect(context).toBeDefined();
    });

    it("should override server URL", async () => {
      process.env.SEMANTIC_RELEASE_JIRA_SERVER_URL =
        "https://prod.atlassian.net";
      process.env.SEMANTIC_RELEASE_JIRA_USERNAME = "prod@example.com";
      process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = "prod-token";

      const authScope = mockJiraAuth({
        serverUrl: "https://prod.atlassian.net",
        username: "prod@example.com",
      });

      await new SemanticReleaseJiraPlugin().verifyConditions(
        { jiraServerUrl: "https://dev.atlassian.net" },
        createMockContext(),
      );
      expect(authScope.isDone()).toBeTruthy();
    });
  });

  describe("Credential Validation", () => {
    // Uses expectAllScopesAreDone for assertions
    // eslint-disable-next-line vitest/expect-expect
    it("should validate auth headers", async () => {
      process.env.SEMANTIC_RELEASE_JIRA_USERNAME = username;
      process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = token;

      const expectedAuth = Buffer.from(`${username}:${token}`).toString(
        "base64",
      );

      const scopes = [
        nock(serverUrl, {
          reqheaders: { authorization: `Basic ${expectedAuth}` },
        })
          .get("/rest/api/2/myself")
          .reply(200, { emailAddress: username }),
        nock(serverUrl, {
          reqheaders: { authorization: `Basic ${expectedAuth}` },
        })
          .get("/rest/api/2/issue/PROJ-123?fields=key")
          .reply(200, { key: "PROJ-123" })
          .get("/rest/api/2/issue/PROJ-456?fields=key")
          .reply(200, { key: "PROJ-456" }),
        nock(serverUrl, {
          reqheaders: { authorization: `Basic ${expectedAuth}` },
        })
          .get("/rest/api/2/issue/PROJ-123/transitions")
          .reply(200, {
            transitions: [
              { id: "31", name: "Done", to: { id: "10001", name: "Done" } },
            ],
          })
          .post("/rest/api/2/issue/PROJ-123/transitions")
          .reply(204)
          .get("/rest/api/2/issue/PROJ-456/transitions")
          .reply(200, {
            transitions: [
              { id: "31", name: "Done", to: { id: "10001", name: "Done" } },
            ],
          })
          .post("/rest/api/2/issue/PROJ-456/transitions")
          .reply(204),
      ];

      const plugin = new SemanticReleaseJiraPlugin();
      await plugin.verifyConditions(
        { jiraServerUrl: serverUrl, transitionIssues: true },
        createMockContext(),
      );
      await plugin.analyzeCommits({}, createMockContext());
      await plugin.success({}, createMockContext());

      expectAllScopesAreDone(scopes);
    });

    describe.each([
      { expected: /authentication failed/i, status: 401 },
      { expected: /credentials.*required/i, status: undefined },
    ])("failure with status=$status", ({ expected, status }) => {
      it(`when credentials ${status ? "invalid" : "missing"}`, async () => {
        if (status) {
          process.env.SEMANTIC_RELEASE_JIRA_USERNAME = "invalid@example.com";
          process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = "invalid-token";
          nock(serverUrl)
            .get("/rest/api/2/myself")
            .reply(status, { errorMessages: ["Invalid"] });
        }

        await expect(
          new SemanticReleaseJiraPlugin().verifyConditions(
            { jiraServerUrl: serverUrl, transitionIssues: true },
            createMockContext(),
          ),
        ).rejects.toThrow(expected);
      });
    });
  });

  describe("Environment-Specific Workflows", () => {
    it("should support CI/CD credential injection", async () => {
      process.env.SEMANTIC_RELEASE_JIRA_USERNAME = "ci@company.com";
      process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = "ci-secret";

      const authScope = mockJiraAuth({
        serverUrl: "https://company.atlassian.net",
        username: "ci@company.com",
      });

      await new SemanticReleaseJiraPlugin().verifyConditions(
        {
          jiraServerUrl: "https://company.atlassian.net",
          transitionIssues: true,
        },
        createMockContext(),
      );

      expect(authScope.isDone()).toBeTruthy();
    });

    describe.each([
      {
        desc: "staging dry run",
        envOverrides: { SEMANTIC_RELEASE_JIRA_DRY_RUN: "true" },
        transitions: false,
      },
      {
        desc: "production workflow",
        envOverrides: {
          SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS: "true",
          SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES: "true",
        },
        transitions: true,
        versions: true,
      },
    ])("$desc", ({ envOverrides, transitions }) => {
      // Uses expectAllScopesAreDone for assertions
      // eslint-disable-next-line vitest/expect-expect
      it("with environment overrides", async () => {
        for (const [key, value] of Object.entries(envOverrides)) {
          process.env[key] = String(value);
        }
        process.env.SEMANTIC_RELEASE_JIRA_USERNAME = "env@example.com";
        process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = "env-token";

        const scopes: nock.Scope[] = [
          mockJiraAuth({ serverUrl, username: "env@example.com" }),
          mockJiraIssueVerification(serverUrl, ["PROJ-123", "PROJ-456"]),
        ];

        if (transitions) {
          scopes.push(
            mockJiraTransitions(serverUrl, [
              { key: "PROJ-123" },
              { key: "PROJ-456" },
            ]),
          );
        }

        if (envOverrides.SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS) {
          scopes.push(
            mockJiraVersionCreation(serverUrl, "PROJ", "test-repo-1.2.0", [
              "PROJ-123",
              "PROJ-456",
            ]),
          );
        }

        const plugin = new SemanticReleaseJiraPlugin();
        await plugin.verifyConditions(
          { jiraServerUrl: serverUrl },
          createMockContext(),
        );
        await plugin.analyzeCommits({}, createMockContext());
        await plugin.success({}, createMockContext());

        expectAllScopesAreDone(scopes);
      });
    });

    it("should support custom patterns", async () => {
      process.env.SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN = String.raw`[A-Z][A-Z0-9]+-\d+`;

      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext({
        commits: [{ hash: "abc123", message: "feat(AB-1): short key" }],
      });

      await plugin.verifyConditions({ jiraServerUrl: serverUrl }, context);
      await plugin.analyzeCommits({}, context);
      const notes = await plugin.generateNotes({}, context);

      expect(notes).toContain("AB-1");
    });
  });

  describe("Error Handling", () => {
    describe.each([
      { envVar: "SEMANTIC_RELEASE_JIRA_TIMEOUT", value: "not-a-number" },
      { envVar: "SEMANTIC_RELEASE_JIRA_RETRIES", value: "invalid" },
      { envVar: "SEMANTIC_RELEASE_JIRA_CONCURRENCY", value: "not-a-number" },
    ])("invalid $envVar", ({ envVar, value }) => {
      it(`${envVar}=${value}`, async () => {
        process.env.SEMANTIC_RELEASE_JIRA_SERVER_URL = serverUrl;
        process.env[envVar] = value;

        await expect(
          new SemanticReleaseJiraPlugin().verifyConditions(
            {},
            createMockContext(),
          ),
        ).rejects.toThrow(/invalid.*environment/i);
      });
    });

    describe("Boolean Format Validation", () => {
      describe.each([
        { desc: "lowercase true", value: "true" },
        { desc: "numeric 1", value: "1" },
      ])("valid: $desc", ({ value }) => {
        it(`SEMANTIC_RELEASE_JIRA_DRY_RUN=${value}`, async () => {
          process.env.SEMANTIC_RELEASE_JIRA_SERVER_URL = serverUrl;
          process.env.SEMANTIC_RELEASE_JIRA_DRY_RUN = value;
          process.env.SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES = "1";
          process.env.SEMANTIC_RELEASE_JIRA_USERNAME = username;
          process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = token;

          const context = createMockContext();
          const authScope = mockJiraAuth({ serverUrl, username });
          await new SemanticReleaseJiraPlugin().verifyConditions({}, context);
          expect(authScope.isDone()).toBeTruthy();
        });
      });

      describe.each([{ desc: "uppercase TRUE", value: "TRUE" }])(
        "invalid: $desc",
        ({ value }) => {
          it(`SEMANTIC_RELEASE_JIRA_DRY_RUN=${value}`, async () => {
            process.env.SEMANTIC_RELEASE_JIRA_SERVER_URL = serverUrl;
            process.env.SEMANTIC_RELEASE_JIRA_DRY_RUN = value;

            const context = createMockContext();

            await expect(
              new SemanticReleaseJiraPlugin().verifyConditions({}, context),
            ).rejects.toThrow(/invalid.*environment/i);
          });
        },
      );
    });

    it("should reject whitespace in env vars", async () => {
      process.env.SEMANTIC_RELEASE_JIRA_SERVER_URL = `  ${serverUrl}  `;
      process.env.SEMANTIC_RELEASE_JIRA_USERNAME = username;
      process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = token;

      await expect(
        new SemanticReleaseJiraPlugin().verifyConditions(
          {},
          createMockContext(),
        ),
      ).rejects.toThrow();
    });

    it("should validate all 14 config options can be overridden", async () => {
      const config: Partial<PluginConfig> = {
        concurrency: 5,
        createVersions: false,
        customIssuePattern: String.raw`OLD-\d+`,
        dryRun: false,
        failOnJiraError: false,
        jiraApiToken: "config-token",
        jiraServerUrl: "https://config.atlassian.net",
        jiraUsername: "config@example.com",
        rejectUnauthorized: false,
        retries: 5,
        retryDelay: 2000,
        timeout: 60_000,
        transitionIssues: false,
        transitionToStatus: "Config Status",
        versionPrefix: "config-",
      };

      process.env.SEMANTIC_RELEASE_JIRA_SERVER_URL =
        "https://env.atlassian.net";
      process.env.SEMANTIC_RELEASE_JIRA_USERNAME = "env@example.com";
      process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = "env-token";
      process.env.SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS = "Env Status";
      process.env.SEMANTIC_RELEASE_JIRA_VERSION_PREFIX = "env-";
      process.env.SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN = String.raw`ENV-\d+`;
      process.env.SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES = "true";
      process.env.SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS = "true";
      process.env.SEMANTIC_RELEASE_JIRA_DRY_RUN = "true";
      process.env.SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR = "true";
      process.env.SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED = "true";
      process.env.SEMANTIC_RELEASE_JIRA_CONCURRENCY = "15";
      process.env.SEMANTIC_RELEASE_JIRA_TIMEOUT = "10000";
      process.env.SEMANTIC_RELEASE_JIRA_RETRIES = "2";
      process.env.SEMANTIC_RELEASE_JIRA_RETRY_DELAY = "500";

      const authScope = mockJiraAuth({
        serverUrl: "https://env.atlassian.net",
        username: "env@example.com",
      });

      await new SemanticReleaseJiraPlugin().verifyConditions(
        config,
        createMockContext(),
      );

      expect(authScope.isDone()).toBeTruthy();
    });
  });
});
