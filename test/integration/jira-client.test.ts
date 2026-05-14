/**
 * Integration tests for Jira client functions
 *
 * Tests all Jira API operations with mocked HTTP calls
 */

import nock from "nock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { JiraClient } from "~/jira/client.js";

import {
  setupNockEnvironment,
  teardownNockEnvironment,
} from "../mocks/index.js";

describe("Jira Client Integration", () => {
  const serverUrl = "https://company.atlassian.net";
  const username = "test@example.com";
  const apiToken = "test-api-token";

  beforeEach(() => {
    setupNockEnvironment();
  });

  afterEach(() => {
    teardownNockEnvironment();
  });

  describe("JiraClient constructor", () => {
    it("should create client with authentication", () => {
      const jira = new JiraClient({
        apiToken,
        serverUrl,
        username,
      });

      expect(jira).toBeInstanceOf(JiraClient);
    });

    it("should create client without authentication", () => {
      const jira = new JiraClient({
        serverUrl,
      });

      expect(jira).toBeInstanceOf(JiraClient);
    });

    it("should create client with custom timeout", () => {
      const jira = new JiraClient({
        serverUrl,
        timeout: 60_000,
      });

      expect(jira).toBeInstanceOf(JiraClient);
    });

    it("should create client with custom retry configuration", () => {
      const jira = new JiraClient({
        retries: 5,
        retryDelay: 2000,
        serverUrl,
      });

      expect(jira).toBeDefined();
      // Retry configuration is internal to axios-retry
    });
  });

  describe("getIssueDetails", () => {
    it("should fetch issue summary successfully", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=summary")
        .reply(200, {
          fields: {
            summary: "Implement user authentication",
          },
          key: "PROJ-123",
        });

      const jira = new JiraClient({ serverUrl });
      const details = await jira.getIssueDetails("PROJ-123");

      expect(details).toEqual({
        key: "PROJ-123",
        summary: "Implement user authentication",
      });
      expect(scope.isDone()).toBeTruthy();
    });

    it("should return null when issue not found (404)", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-999?fields=summary")
        .reply(404, {
          errorMessages: ["Issue does not exist or you do not have permission"],
        });

      const jira = new JiraClient({ serverUrl });
      const details = await jira.getIssueDetails("PROJ-999");

      expect(details).toBeUndefined();
      expect(scope.isDone()).toBeTruthy();
    });

    it("should return null on network error", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=summary")
        .replyWithError({
          code: "ECONNREFUSED",
          message: "Connection refused",
        });

      const jira = new JiraClient({ retries: 0, serverUrl });
      const details = await jira.getIssueDetails("PROJ-123");

      expect(details).toBeUndefined();
      expect(scope.isDone()).toBeTruthy();
    });

    it("should return null on 401 unauthorized", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=summary")
        .reply(401, {
          errorMessages: ["Authentication required"],
        });

      const jira = new JiraClient({ serverUrl });
      const details = await jira.getIssueDetails("PROJ-123");

      expect(details).toBeUndefined();
      expect(scope.isDone()).toBeTruthy();
    });

    it("should return null on 500 server error", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=summary")
        .reply(500, {
          errorMessages: ["Internal server error"],
        });

      const jira = new JiraClient({ retries: 0, serverUrl });
      const details = await jira.getIssueDetails("PROJ-123");

      expect(details).toBeUndefined();
      expect(scope.isDone()).toBeTruthy();
    });

    it("should retry and succeed after transient error", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=summary")
        .reply(503, { errorMessages: ["Service unavailable"] })
        .get("/rest/api/2/issue/PROJ-123?fields=summary")
        .reply(200, {
          fields: { summary: "Fix memory leak" },
          key: "PROJ-123",
        });

      const jira = new JiraClient({
        retries: 2,
        retryDelay: 100,
        serverUrl,
      });
      const details = await jira.getIssueDetails("PROJ-123");

      expect(details).toEqual({
        key: "PROJ-123",
        summary: "Fix memory leak",
      });
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle issue with empty summary", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=summary")
        .reply(200, {
          fields: {
            summary: "",
          },
          key: "PROJ-123",
        });

      const jira = new JiraClient({ serverUrl });
      const details = await jira.getIssueDetails("PROJ-123");

      expect(details).toEqual({
        key: "PROJ-123",
        summary: "",
      });
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle issue with special characters in summary", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=summary")
        .reply(200, {
          fields: {
            summary: 'Fix bug with "quotes" & <brackets>',
          },
          key: "PROJ-123",
        });

      const jira = new JiraClient({ serverUrl });
      const details = await jira.getIssueDetails("PROJ-123");

      expect(details).toEqual({
        key: "PROJ-123",
        summary: 'Fix bug with "quotes" & <brackets>',
      });
      expect(scope.isDone()).toBeTruthy();
    });
  });

  describe("verifyIssueExists", () => {
    it("should return true when issue exists", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=key")
        .reply(200, {
          fields: {},
          key: "PROJ-123",
        });

      const jira = new JiraClient({ serverUrl });
      const exists = await jira.verifyIssueExists("PROJ-123");

      expect(exists).toBe(true);
      expect(scope.isDone()).toBeTruthy();
    });

    it("should return false when issue not found (404)", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-999?fields=key")
        .reply(404, {
          errorMessages: ["Issue does not exist or you do not have permission"],
        });

      const jira = new JiraClient({ serverUrl });
      const exists = await jira.verifyIssueExists("PROJ-999");

      expect(exists).toBe(false);
      expect(scope.isDone()).toBeTruthy();
    });

    it("should return false on network error", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=key")
        .replyWithError({
          code: "ECONNREFUSED",
          message: "Connection refused",
        });

      const jira = new JiraClient({ retries: 0, serverUrl });
      const exists = await jira.verifyIssueExists("PROJ-123");

      expect(exists).toBe(false);
      expect(scope.isDone()).toBeTruthy();
    });

    it("should return false on 401 unauthorized", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=key")
        .reply(401, {
          errorMessages: ["Authentication required"],
        });

      const jira = new JiraClient({ serverUrl });
      const exists = await jira.verifyIssueExists("PROJ-123");

      expect(exists).toBe(false);
      expect(scope.isDone()).toBeTruthy();
    });

    it("should return false on 500 server error", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=key")
        .reply(500, {
          errorMessages: ["Internal server error"],
        });

      const jira = new JiraClient({ retries: 0, serverUrl });
      const exists = await jira.verifyIssueExists("PROJ-123");

      expect(exists).toBe(false);
      expect(scope.isDone()).toBeTruthy();
    });

    it("should retry and succeed after transient error", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=key")
        .reply(503, { errorMessages: ["Service unavailable"] })
        .get("/rest/api/2/issue/PROJ-123?fields=key")
        .reply(200, { key: "PROJ-123" });

      const jira = new JiraClient({
        retries: 2,
        retryDelay: 100,
        serverUrl,
      });
      const exists = await jira.verifyIssueExists("PROJ-123");

      expect(exists).toBe(true);
      expect(scope.isDone()).toBeTruthy();
    });
  });

  describe("getIssueTransitions", () => {
    it("should fetch available transitions", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123/transitions")
        .reply(200, {
          transitions: [
            {
              id: "21",
              name: "In Progress",
              to: { id: "3", name: "In Progress" },
            },
            { id: "31", name: "Done", to: { id: "10001", name: "Done" } },
            { id: "41", name: "Closed", to: { id: "6", name: "Closed" } },
          ],
        });

      const jira = new JiraClient({ serverUrl });
      const transitions = await jira.getIssueTransitions("PROJ-123");

      expect(transitions).toHaveLength(3);
      expect(transitions[0]).toEqual({
        id: "21",
        name: "In Progress",
        to: { id: "3", name: "In Progress" },
      });
      expect(transitions[1].name).toBe("Done");
      expect(scope.isDone()).toBeTruthy();
    });

    it("should return empty array when no transitions available", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123/transitions")
        .reply(200, {
          transitions: [],
        });

      const jira = new JiraClient({ serverUrl });
      const transitions = await jira.getIssueTransitions("PROJ-123");

      expect(transitions).toEqual([]);
      expect(scope.isDone()).toBeTruthy();
    });

    it("should throw on 404 not found", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-999/transitions")
        .reply(404, {
          errorMessages: ["Issue does not exist"],
        });

      const jira = new JiraClient({ retries: 0, serverUrl });

      await expect(jira.getIssueTransitions("PROJ-999")).rejects.toThrow();
      expect(scope.isDone()).toBeTruthy();
    });

    it("should retry on 429 rate limit", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123/transitions")
        .reply(429, {
          errorMessages: ["Rate limit exceeded"],
        })
        .get("/rest/api/2/issue/PROJ-123/transitions")
        .reply(200, {
          transitions: [
            { id: "31", name: "Done", to: { id: "10001", name: "Done" } },
          ],
        });

      const jira = new JiraClient({
        retries: 2,
        retryDelay: 100,
        serverUrl,
      });
      const transitions = await jira.getIssueTransitions("PROJ-123");

      expect(transitions).toHaveLength(1);
      expect(scope.isDone()).toBeTruthy();
    });
  });

  describe("transitionIssue", () => {
    it("should transition issue successfully", async () => {
      const scope = nock(serverUrl)
        .post("/rest/api/2/issue/PROJ-123/transitions", {
          transition: { id: "31" },
        })
        .reply(204);

      const jira = new JiraClient({ serverUrl });
      await expect(
        jira.transitionIssue("PROJ-123", "31"),
      ).resolves.not.toThrow();

      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle 400 invalid transition", async () => {
      const scope = nock(serverUrl)
        .post("/rest/api/2/issue/PROJ-123/transitions", {
          transition: { id: "999" },
        })
        .reply(400, {
          errorMessages: ["Transition id 999 is not valid"],
        });

      const jira = new JiraClient({ retries: 0, serverUrl });

      await expect(jira.transitionIssue("PROJ-123", "999")).rejects.toThrow();
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle 404 issue not found", async () => {
      const scope = nock(serverUrl)
        .post("/rest/api/2/issue/PROJ-999/transitions")
        .reply(404, {
          errorMessages: ["Issue does not exist"],
        });

      const jira = new JiraClient({ retries: 0, serverUrl });

      await expect(jira.transitionIssue("PROJ-999", "31")).rejects.toThrow();
      expect(scope.isDone()).toBeTruthy();
    });

    it("should retry on server error", async () => {
      const scope = nock(serverUrl)
        .post("/rest/api/2/issue/PROJ-123/transitions", {
          transition: { id: "31" },
        })
        .reply(500, { errorMessages: ["Internal server error"] })
        .post("/rest/api/2/issue/PROJ-123/transitions", {
          transition: { id: "31" },
        })
        .reply(204);

      const jira = new JiraClient({
        retries: 2,
        retryDelay: 100,
        serverUrl,
      });

      await expect(
        jira.transitionIssue("PROJ-123", "31"),
      ).resolves.not.toThrow();
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle 401 unauthorized", async () => {
      const scope = nock(serverUrl)
        .post("/rest/api/2/issue/PROJ-123/transitions")
        .reply(401, {
          errorMessages: ["Authentication required"],
        });

      const jira = new JiraClient({ retries: 0, serverUrl });

      await expect(jira.transitionIssue("PROJ-123", "31")).rejects.toThrow();
      expect(scope.isDone()).toBeTruthy();
    });
  });

  describe("createVersion", () => {
    it("should create new version successfully", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/project/PROJ")
        .reply(200, { id: "10000", key: "PROJ" })
        .get("/rest/api/2/project/PROJ/versions")
        .reply(200, [{ id: "20000", name: "v1.0.0", projectId: "10000" }])
        .post("/rest/api/2/version", {
          name: "v2.0.0",
          projectId: "10000",
        })
        .reply(200, {
          id: "20001",
          name: "v2.0.0",
          projectId: "10000",
        });

      const jira = new JiraClient({ serverUrl });
      const version = await jira.createVersion("PROJ", "v2.0.0");

      expect(version).toEqual({
        id: "20001",
        name: "v2.0.0",
        projectId: "10000",
      });
      expect(scope.isDone()).toBeTruthy();
    });

    it("should return existing version if already exists", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/project/PROJ")
        .reply(200, { id: "10000", key: "PROJ" })
        .get("/rest/api/2/project/PROJ/versions")
        .reply(200, [
          { id: "20000", name: "v1.0.0", projectId: "10000" },
          { id: "20001", name: "v2.0.0", projectId: "10000" },
        ]);

      const jira = new JiraClient({ serverUrl });
      const version = await jira.createVersion("PROJ", "v2.0.0");

      expect(version).toEqual({
        id: "20001",
        name: "v2.0.0",
        projectId: "10000",
      });
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle project not found (404)", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/project/INVALID")
        .reply(404, {
          errorMessages: ["Project does not exist"],
        });

      const jira = new JiraClient({ retries: 0, serverUrl });

      await expect(jira.createVersion("INVALID", "v1.0.0")).rejects.toThrow(
        /Failed to create version/,
      );
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle permission denied (403)", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/project/PROJ")
        .reply(403, {
          errorMessages: ["You do not have permission to view this project"],
        });

      const jira = new JiraClient({ retries: 0, serverUrl });

      await expect(jira.createVersion("PROJ", "v1.0.0")).rejects.toThrow(
        /Failed to create version/,
      );
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle version creation failure", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/project/PROJ")
        .reply(200, { id: "10000", key: "PROJ" })
        .get("/rest/api/2/project/PROJ/versions")
        .reply(200, [])
        .post("/rest/api/2/version", {
          name: "v1.0.0",
          projectId: "10000",
        })
        .reply(400, {
          errorMessages: ["A version with this name already exists"],
        });

      const jira = new JiraClient({ retries: 0, serverUrl });

      await expect(jira.createVersion("PROJ", "v1.0.0")).rejects.toThrow(
        /Failed to create version/,
      );
      expect(scope.isDone()).toBeTruthy();
    });

    it("should retry on server errors", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/project/PROJ")
        .reply(200, { id: "10000", key: "PROJ" })
        .get("/rest/api/2/project/PROJ/versions")
        .reply(200, [])
        .post("/rest/api/2/version")
        .reply(503, { errorMessages: ["Service unavailable"] })
        .post("/rest/api/2/version", {
          name: "v1.0.0",
          projectId: "10000",
        })
        .reply(200, {
          id: "20001",
          name: "v1.0.0",
          projectId: "10000",
        });

      const jira = new JiraClient({
        retries: 2,
        retryDelay: 100,
        serverUrl,
      });
      const version = await jira.createVersion("PROJ", "v1.0.0");

      expect(version.id).toBe("20001");
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle rate limiting", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/project/PROJ")
        .reply(429, { errorMessages: ["Rate limit exceeded"] })
        .get("/rest/api/2/project/PROJ")
        .reply(200, { id: "10000", key: "PROJ" })
        .get("/rest/api/2/project/PROJ/versions")
        .reply(200, [])
        .post("/rest/api/2/version")
        .reply(200, {
          id: "20001",
          name: "v1.0.0",
          projectId: "10000",
        });

      const jira = new JiraClient({
        retries: 2,
        retryDelay: 100,
        serverUrl,
      });
      const version = await jira.createVersion("PROJ", "v1.0.0");

      expect(version.id).toBe("20001");
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle empty versions list", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/project/PROJ")
        .reply(200, { id: "10000", key: "PROJ" })
        .get("/rest/api/2/project/PROJ/versions")
        .reply(200, [])
        .post("/rest/api/2/version")
        .reply(200, {
          id: "20001",
          name: "v1.0.0",
          projectId: "10000",
        });

      const jira = new JiraClient({ serverUrl });
      const version = await jira.createVersion("PROJ", "v1.0.0");

      expect(version.id).toBe("20001");
      expect(scope.isDone()).toBeTruthy();
    });
  });

  describe("addVersionToIssue", () => {
    it("should associate version with issue", async () => {
      const scope = nock(serverUrl)
        .put("/rest/api/2/issue/PROJ-123", {
          fields: {
            fixVersions: [{ id: "20000" }],
          },
        })
        .reply(204);

      const jira = new JiraClient({ serverUrl });
      await expect(
        jira.addVersionToIssue("PROJ-123", "20000"),
      ).resolves.not.toThrow();

      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle issue not found (404)", async () => {
      const scope = nock(serverUrl)
        .put("/rest/api/2/issue/PROJ-999")
        .reply(404, {
          errorMessages: ["Issue does not exist"],
        });

      const jira = new JiraClient({ retries: 0, serverUrl });

      await expect(
        jira.addVersionToIssue("PROJ-999", "20000"),
      ).rejects.toThrow();
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle invalid version (400)", async () => {
      const scope = nock(serverUrl)
        .put("/rest/api/2/issue/PROJ-123", {
          fields: {
            fixVersions: [{ id: "99999" }],
          },
        })
        .reply(400, {
          errorMessages: ["Version 99999 does not exist"],
        });

      const jira = new JiraClient({ retries: 0, serverUrl });

      await expect(
        jira.addVersionToIssue("PROJ-123", "99999"),
      ).rejects.toThrow();
      expect(scope.isDone()).toBeTruthy();
    });

    it("should retry on server error", async () => {
      const scope = nock(serverUrl)
        .put("/rest/api/2/issue/PROJ-123", {
          fields: {
            fixVersions: [{ id: "20000" }],
          },
        })
        .reply(500, { errorMessages: ["Internal server error"] })
        .put("/rest/api/2/issue/PROJ-123", {
          fields: {
            fixVersions: [{ id: "20000" }],
          },
        })
        .reply(204);

      const jira = new JiraClient({
        retries: 2,
        retryDelay: 100,
        serverUrl,
      });

      await expect(
        jira.addVersionToIssue("PROJ-123", "20000"),
      ).resolves.not.toThrow();
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle permission denied (403)", async () => {
      const scope = nock(serverUrl)
        .put("/rest/api/2/issue/PROJ-123")
        .reply(403, {
          errorMessages: ["You do not have permission to edit this issue"],
        });

      const jira = new JiraClient({ retries: 0, serverUrl });

      await expect(
        jira.addVersionToIssue("PROJ-123", "20000"),
      ).rejects.toThrow();
      expect(scope.isDone()).toBeTruthy();
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle complete version creation and association workflow", async () => {
      const scope = nock(serverUrl)
        // Create version
        .get("/rest/api/2/project/PROJ")
        .reply(200, { id: "10000", key: "PROJ" })
        .get("/rest/api/2/project/PROJ/versions")
        .reply(200, [])
        .post("/rest/api/2/version", {
          name: "v1.0.0",
          projectId: "10000",
        })
        .reply(200, {
          id: "20000",
          name: "v1.0.0",
          projectId: "10000",
        })
        // Associate with issues
        .put("/rest/api/2/issue/PROJ-123", {
          fields: {
            fixVersions: [{ id: "20000" }],
          },
        })
        .reply(204)
        .put("/rest/api/2/issue/PROJ-456", {
          fields: {
            fixVersions: [{ id: "20000" }],
          },
        })
        .reply(204);

      const jira = new JiraClient({ serverUrl });

      // Create version
      const version = await jira.createVersion("PROJ", "v1.0.0");
      expect(version.id).toBe("20000");

      // Associate with multiple issues
      await jira.addVersionToIssue("PROJ-123", version.id);
      await jira.addVersionToIssue("PROJ-456", version.id);

      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle complete transition workflow", async () => {
      const scope = nock(serverUrl)
        // Get transitions
        .get("/rest/api/2/issue/PROJ-123/transitions")
        .reply(200, {
          transitions: [
            {
              id: "21",
              name: "In Progress",
              to: { id: "3", name: "In Progress" },
            },
            { id: "31", name: "Done", to: { id: "10001", name: "Done" } },
          ],
        })
        // Transition to Done
        .post("/rest/api/2/issue/PROJ-123/transitions", {
          transition: { id: "31" },
        })
        .reply(204);

      const jira = new JiraClient({ serverUrl });

      // Get available transitions
      const transitions = await jira.getIssueTransitions("PROJ-123");
      const doneTransition = transitions.find((t) => t.name === "Done");
      expect(doneTransition).toBeDefined();

      // Transition to Done
      await jira.transitionIssue("PROJ-123", doneTransition!.id);

      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle network resilience scenario", async () => {
      const scope = nock(serverUrl)
        // First attempt fails
        .get("/rest/api/2/issue/PROJ-123?fields=key")
        .replyWithError({ code: "ECONNRESET", message: "Connection reset" })
        // Second attempt rate limited
        .get("/rest/api/2/issue/PROJ-123?fields=key")
        .reply(429)
        // Third attempt succeeds
        .get("/rest/api/2/issue/PROJ-123?fields=key")
        .reply(200, { key: "PROJ-123" });

      const jira = new JiraClient({
        retries: 3,
        retryDelay: 100,
        serverUrl,
      });

      const exists = await jira.verifyIssueExists("PROJ-123");
      expect(exists).toBe(true);

      expect(scope.isDone()).toBeTruthy();
    });

    it("should fetch issue details for multiple issues", async () => {
      const scope = nock(serverUrl)
        .get("/rest/api/2/issue/PROJ-123?fields=summary")
        .reply(200, {
          fields: { summary: "Implement authentication" },
          key: "PROJ-123",
        })
        .get("/rest/api/2/issue/PROJ-456?fields=summary")
        .reply(200, {
          fields: { summary: "Fix memory leak" },
          key: "PROJ-456",
        })
        .get("/rest/api/2/issue/PROJ-789?fields=summary")
        .reply(404);

      const jira = new JiraClient({ serverUrl });

      const details1 = await jira.getIssueDetails("PROJ-123");
      const details2 = await jira.getIssueDetails("PROJ-456");
      const details3 = await jira.getIssueDetails("PROJ-789");

      expect(details1).toEqual({
        key: "PROJ-123",
        summary: "Implement authentication",
      });
      expect(details2).toEqual({
        key: "PROJ-456",
        summary: "Fix memory leak",
      });
      expect(details3).toBeUndefined();

      expect(scope.isDone()).toBeTruthy();
    });
  });
});
