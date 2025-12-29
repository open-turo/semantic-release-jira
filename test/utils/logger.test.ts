/**
 * Tests for StructuredLogger with automatic sanitization
 */

import { describe, expect, it } from "vitest";

import { StructuredLogger } from "~/utils/logger.js";

import { createMockLogger } from "../mocks/index.js";

describe("StructuredLogger", () => {
  describe("basic functionality", () => {
    it.each([
      { calls: "logCalls", message: "Test message", method: "log" },
      {
        calls: "successCalls",
        message: "Operation completed",
        method: "success",
      },
      { calls: "errorCalls", message: "Operation failed", method: "error" },
    ] as const)(
      "should support $method logging",
      ({ calls, message, method }) => {
        const mockLogger = createMockLogger();
        const logger = new StructuredLogger(mockLogger);

        logger[method](message);

        expect(mockLogger[calls]).toHaveLength(1);
        expect(mockLogger[calls][0]).toBe(message);
      },
    );

    it("should include custom context in logs", () => {
      const mockLogger = createMockLogger();
      const logger = new StructuredLogger(mockLogger);

      logger.log("Test message", {
        issueCount: 5,
        operation: "analyzeCommits",
      });

      expect(mockLogger.logCalls[0]).toContain("Test message");
      expect(mockLogger.logCalls[0]).toContain("issueCount");
      expect(mockLogger.logCalls[0]).toContain("5");
      expect(mockLogger.logCalls[0]).toContain("analyzeCommits");
    });
  });

  describe("credential sanitization", () => {
    it.each([
      {
        expected: "Bearer [REDACTED]",
        message: "Request failed with Authorization: Bearer secret-token-123",
        sensitive: "secret-token-123",
      },
      {
        expected: "Basic [REDACTED]",
        message: "Auth header: Basic dXNlcm5hbWU6cGFzc3dvcmQ=",
        sensitive: "dXNlcm5hbWU6cGFzc3dvcmQ=",
      },
    ])(
      "should sanitize credentials in log message: $expected",
      ({ expected, message, sensitive }) => {
        const mockLogger = createMockLogger();
        const logger = new StructuredLogger(mockLogger);

        logger.log(message);

        expect(mockLogger.logCalls[0]).not.toContain(sensitive);
        expect(mockLogger.logCalls[0]).toContain(expected);
      },
    );

    it("should sanitize credentials in error context", () => {
      const mockLogger = createMockLogger();
      const logger = new StructuredLogger(mockLogger);

      logger.error("Request failed", {
        error: {
          config: {
            headers: {
              Authorization: "Bearer sensitive-token",
            },
          },
          message: "Network error",
        },
      });

      expect(mockLogger.errorCalls[0]).not.toContain("sensitive-token");
      expect(mockLogger.errorCalls[0]).toContain("[REDACTED]");
    });

    it.each([
      {
        context: {
          apiToken: "secret-api-token-xyz",
          operation: "createVersion",
        },
        kept: ["createVersion"],
        message: "Processing request",
        redacted: ["secret-api-token-xyz"],
      },
      {
        context: {
          // eslint-disable-next-line sonarjs/no-hardcoded-passwords
          password: "supersecret123",
          username: "john.doe",
        },
        kept: ["john.doe"],
        message: "User authentication",
        redacted: ["supersecret123"],
      },
    ])(
      "should sanitize context fields: $message",
      ({ context, kept, message, redacted }) => {
        const mockLogger = createMockLogger();
        const logger = new StructuredLogger(mockLogger);

        logger.log(message, context);

        const logged = mockLogger.logCalls[0];
        for (const sensitive of redacted) {
          expect(logged).not.toContain(sensitive);
        }
        expect(logged).toContain("[REDACTED]");
        for (const safe of kept) {
          expect(logged).toContain(safe);
        }
      },
    );

    it("should sanitize nested credentials in error objects", () => {
      const mockLogger = createMockLogger();
      const logger = new StructuredLogger(mockLogger);

      const error = new Error("Auth failed: Bearer token-abc-123");
      error.stack = "Error: Auth failed\n  Authorization: Bearer token-abc-123";

      logger.error("Authentication error", { error });

      const logged = mockLogger.errorCalls[0];
      expect(logged).not.toContain("token-abc-123");
      expect(logged).toContain("[REDACTED]");
    });

    it("should sanitize axios-like error structures", () => {
      const mockLogger = createMockLogger();
      const logger = new StructuredLogger(mockLogger);

      logger.error("Request failed", {
        error: {
          config: {
            auth: {
              // eslint-disable-next-line sonarjs/no-hardcoded-passwords
              password: "secret-password",
              username: "user@example.com",
            },
            headers: {
              Authorization: "Basic encoded-credentials",
            },
          },
          isAxiosError: true,
          message: "Request timeout",
        },
      });

      const logged = mockLogger.errorCalls[0];
      expect(logged).not.toContain("secret-password");
      expect(logged).not.toContain("encoded-credentials");
      expect(logged).toContain("[REDACTED]");
    });

    it("should sanitize long hex tokens in log messages", () => {
      const mockLogger = createMockLogger();
      const logger = new StructuredLogger(mockLogger);

      logger.log("API token: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0");

      expect(mockLogger.logCalls[0]).not.toContain(
        "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
      );
      expect(mockLogger.logCalls[0]).toContain("[REDACTED_TOKEN]");
    });

    it("should not sanitize short alphanumeric strings", () => {
      const mockLogger = createMockLogger();
      const logger = new StructuredLogger(mockLogger);

      logger.log("API token: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0");

      expect(mockLogger.logCalls[0]).toContain(
        "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
      );
    });

    it("should sanitize multiple credentials in single message", () => {
      const mockLogger = createMockLogger();
      const logger = new StructuredLogger(mockLogger);

      logger.log(
        "Multiple creds: Bearer token1 and Basic creds2 and apiToken: xyz",
        {
          apiToken: "secret123",
        },
      );

      const logged = mockLogger.logCalls[0];
      expect(logged).not.toContain("token1");
      expect(logged).not.toContain("creds2");
      expect(logged).not.toContain("secret123");
      expect(logged).toContain("[REDACTED]");
    });
  });

  describe("timer functionality", () => {
    it("should create timer that returns elapsed time", async () => {
      const mockLogger = createMockLogger();
      const logger = new StructuredLogger(mockLogger);

      const timer = logger.startTimer();
      await new Promise((resolve) => setTimeout(resolve, 15));
      const duration = timer();

      // Use a slightly lower threshold to account for timer precision
      // setTimeout is not precise and may complete slightly before the specified time
      expect(duration).toBeGreaterThanOrEqual(8);
    });

    it("should log duration in context", async () => {
      const mockLogger = createMockLogger();
      const logger = new StructuredLogger(mockLogger);

      const timer = logger.startTimer();
      await new Promise((resolve) => setTimeout(resolve, 5));
      const duration = timer();

      logger.log("Operation completed", { duration });

      expect(mockLogger.logCalls[0]).toContain("duration");
      expect(mockLogger.logCalls[0]).toMatch(/duration":\d+/);
    });
  });

  describe("edge cases", () => {
    it.each([
      {
        context: { value: undefined },
        expected: "Undefined value",
        message: "Undefined value",
      },
      { context: undefined, expected: "No context", message: "No context" },
    ])("should handle logging: $message", ({ context, expected, message }) => {
      const mockLogger = createMockLogger();
      const logger = new StructuredLogger(mockLogger);

      if (context) {
        logger.log(message, context);
      } else {
        logger.log(message);
      }

      expect(mockLogger.logCalls).toHaveLength(1);
      expect(mockLogger.logCalls[0]).toContain(expected);
    });
  });

  describe("real-world scenarios", () => {
    it("should sanitize Jira API authentication failure", () => {
      const mockLogger = createMockLogger();
      const logger = new StructuredLogger(mockLogger);

      const jiraError = {
        config: {
          headers: {
            Authorization: "Basic dXNlckBleGFtcGxlLmNvbTpBVEFUVDN4RmZHRjA=",
          },
          url: "https://company.atlassian.net/rest/api/2/myself",
        },
        isAxiosError: true,
        message: "Request failed with status code 401",
        response: {
          data: { message: "Invalid credentials" },
          status: 401,
        },
      };

      logger.error("Jira authentication failed", { error: jiraError });

      const logged = mockLogger.errorCalls[0];
      expect(logged).not.toContain("ATATT3xFfGF0");
      expect(logged).not.toContain("dXNlckBleGFtcGxlLmNvbTpBVEFUVDN4RmZHRjA=");
      expect(logged).toContain("[REDACTED]");
      expect(logged).toContain("401");
    });

    it("should sanitize GitHub token in API calls", () => {
      const mockLogger = createMockLogger();
      const logger = new StructuredLogger(mockLogger);

      logger.error("GitHub API request failed", {
        error: {
          config: {
            headers: {
              Authorization: "token ghp_1234567890abcdefghijklmnopqrst",
            },
          },
          message: "Not Found",
        },
      });

      const logged = mockLogger.errorCalls[0];
      expect(logged).not.toContain("ghp_1234567890abcdefghijklmnopqrst");
      expect(logged).toContain("[REDACTED]");
    });

    it("should sanitize credentials in stack traces", () => {
      const mockLogger = createMockLogger();
      const logger = new StructuredLogger(mockLogger);

      const error = new Error("Connection failed");
      error.stack = `Error: Connection failed
        at createJiraClient (/src/jira/client.ts:52:10)
        Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
        at Object.verifyConditions (/src/index.ts:240:5)`;

      logger.error("Plugin initialization error", { error });

      const logged = mockLogger.errorCalls[0];
      expect(logged).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(logged).toContain("[REDACTED]");
    });
  });
});
