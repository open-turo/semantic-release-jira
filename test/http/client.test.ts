import type { AxiosError } from "axios";

import axios from "axios";
import nock, { cleanAll } from "nock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createResilientHttpClient } from "~/http/client.js";
import { getPackageInfo } from "~/utils.js";

import {
  setupNockEnvironment,
  teardownNockEnvironment,
} from "../mocks/test-helpers.js";

const packageJson = getPackageInfo();

function expectAxiosError(
  assertion: (error: AxiosError) => void,
): (error: unknown) => boolean {
  return (error) => {
    if (!axios.isAxiosError(error)) {
      return false;
    }
    assertion(error);
    return true;
  };
}

function expectScopeDone(scope: nock.Scope): void {
  expect(scope.isDone()).toBeTruthy();
}

describe("createResilientHttpClient", () => {
  const baseURL = "https://api.example.com";

  function createTestClient(overrides = {}) {
    return createResilientHttpClient({
      baseURL,
      retries: 3,
      retryDelay: 100,
      ...overrides,
    });
  }

  beforeEach(() => {
    setupNockEnvironment();
  });

  afterEach(() => {
    teardownNockEnvironment();
  });

  describe("basic configuration", () => {
    it("should create client with default configuration", () => {
      const client = createResilientHttpClient({ baseURL });

      expect(client.defaults.baseURL).toBe(baseURL);
      expect(client.defaults.timeout).toBe(30_000);
      expect(client.defaults.headers?.["Content-Type"]).toBe(
        "application/json",
      );
    });

    it("should create client with custom timeout", () => {
      const client = createResilientHttpClient({
        baseURL,
        timeout: 60_000,
      });

      expect(client.defaults.timeout).toBe(60_000);
    });

    it("should create client with custom headers", () => {
      const client = createResilientHttpClient({
        baseURL,
        headers: {
          Authorization: "Bearer token123",
          "X-Custom-Header": "value",
        },
      });

      expect(client.defaults.headers?.Authorization).toBe("Bearer token123");
      expect(client.defaults.headers?.["X-Custom-Header"]).toBe("value");
    });
  });

  describe("User-Agent header", () => {
    it("should set User-Agent header with package version", async () => {
      const scope = nock(baseURL)
        .get("/test")
        .matchHeader(
          "User-Agent",
          `semantic-release-jira/${packageJson.version}`,
        )
        .reply(200, { success: true });

      const client = createResilientHttpClient({ baseURL });
      await client.get("/test");

      expect(scope.isDone()).toBeTruthy();
    });

    it("should include version in User-Agent for all requests", async () => {
      const scope = nock(baseURL).post("/create").reply(201);

      const client = createResilientHttpClient({ baseURL });
      const response = await client.post("/create", { data: "test" });

      expect(response.status).toBe(201);
      expect(client.defaults.headers?.["User-Agent"]).toContain(
        "semantic-release-jira/",
      );

      expect(scope.isDone()).toBeTruthy();
    });
  });

  describe("timeout behavior", () => {
    it("should timeout after configured duration", async () => {
      const scope = nock(baseURL)
        .get("/slow")
        .delay(2000) // 2 second delay
        .reply(200);

      const client = createResilientHttpClient({
        baseURL,
        retries: 0, // Disable retries for this test
        timeout: 500, // 500ms timeout
      });

      await expect(client.get("/slow")).rejects.toThrow();

      // Cleanup the pending request
      scope.persist(false);
      cleanAll();
    });

    it("should complete request within timeout", async () => {
      const scope = nock(baseURL)
        .get("/fast")
        .delay(100) // 100ms delay
        .reply(200, { success: true });

      const client = createResilientHttpClient({
        baseURL,
        timeout: 1000, // 1 second timeout
      });

      const response = await client.get("/fast");
      expect(response.data).toEqual({ success: true });

      expect(scope.isDone()).toBeTruthy();
    });
  });

  describe("retry logic", () => {
    it("should retry on network errors", async () => {
      const scope = nock(baseURL)
        .get("/unstable")
        .times(2)
        .replyWithError({ code: "ECONNRESET", message: "Connection reset" })
        .get("/unstable")
        .reply(200, { success: true });

      const client = createTestClient();
      const response = await client.get("/unstable");

      expect(response.data).toEqual({ success: true });
      expect(scope.isDone()).toBeTruthy();
    });

    it.each([
      { description: "429 rate limit", path: "/rate-limited", status: 429 },
      { description: "500 server errors", path: "/server-error", status: 500 },
      { description: "502 bad gateway", path: "/bad-gateway", status: 502 },
      {
        description: "503 service unavailable",
        path: "/unavailable",
        status: 503,
      },
    ])("should retry on $description", async ({ path, status }) => {
      const scope = nock(baseURL)
        .get(path)
        .reply(status)
        .get(path)
        .reply(200, { success: true });

      const client = createTestClient();
      const response = await client.get(path);

      expect(response.data).toEqual({ success: true });
      expect(scope.isDone()).toBeTruthy();
    });

    it.each([
      { description: "400 client errors", path: "/bad-request", status: 400 },
      { description: "404 not found", path: "/not-found", status: 404 },
    ])("should not retry on $description", async ({ path, status }) => {
      const scope = nock(baseURL).get(path).reply(status);

      const client = createTestClient();
      await expect(client.get(path)).rejects.toThrow();

      expect(scope.isDone()).toBeTruthy();
    });

    it("should exhaust retries and fail", async () => {
      const scope = nock(baseURL)
        .get("/always-fails")
        .times(4) // Initial attempt + 3 retries
        .reply(500);

      const client = createTestClient();
      await expect(client.get("/always-fails")).rejects.toThrow();

      expect(scope.isDone()).toBeTruthy();
    });
  });

  describe("exponential backoff", () => {
    it("should increase delay between retries exponentially", async () => {
      const delays: number[] = [];
      const startTime = Date.now();

      const scope = nock(baseURL)
        .get("/backoff")
        .times(3)
        .reply(function () {
          delays.push(Date.now() - startTime);
          return [500];
        })
        .get("/backoff")
        .reply(200, { success: true });

      const client = createTestClient();
      await client.get("/backoff");

      // Verify delays increase (with some tolerance for timing)
      // First delay: ~100ms, Second delay: ~200ms (2^1 * 100), Third delay: ~400ms (2^2 * 100)
      expect(delays[1]).toBeGreaterThan(delays[0]);
      expect(delays[2]).toBeGreaterThan(delays[1]);
      expect(scope.isDone()).toBeTruthy();
    });

    it("should respect custom retry delay base", async () => {
      const startTime = Date.now();
      let firstRetryDelay = 0;

      const scope = nock(baseURL)
        .get("/custom-delay")
        .reply(500)
        .get("/custom-delay")
        .reply(function () {
          firstRetryDelay = Date.now() - startTime;
          return [200, { success: true }];
        });

      const client = createTestClient({ retryDelay: 500 });
      await client.get("/custom-delay");

      // First retry should wait at least 500ms (with some tolerance)
      expect(firstRetryDelay).toBeGreaterThanOrEqual(400);
      expect(scope.isDone()).toBeTruthy();
    });
  });

  describe("credential sanitization", () => {
    it("should sanitize Authorization header in errors", async () => {
      const scope = nock(baseURL).get("/unauthorized").reply(401);

      const client = createTestClient({
        headers: { Authorization: "Bearer secret-token-12345" },
        retries: 0,
      });

      await expect(client.get("/unauthorized")).rejects.toSatisfy(
        expectAxiosError((error) => {
          const auth: unknown = error.config?.headers?.Authorization;
          expect(auth).toBe("[REDACTED]");
          expect(typeof auth === "string" ? auth : "").not.toContain(
            "secret-token",
          );
        }),
      );

      expect(scope.isDone()).toBeTruthy();
    });

    it("should sanitize Basic auth credentials in errors", async () => {
      const scope = nock(baseURL).get("/unauthorized").reply(401);
      const client = createTestClient({ retries: 0 });

      await expect(
        client.get("/unauthorized", {
          auth: {
            // eslint-disable-next-line sonarjs/no-hardcoded-passwords
            password: "secret-password",
            username: "admin",
          },
        }),
      ).rejects.toSatisfy(
        expectAxiosError((error) => {
          const auth: unknown = error.config?.auth;
          expect(auth).toEqual({
            // eslint-disable-next-line sonarjs/no-hardcoded-passwords
            password: "[REDACTED]",
            username: "[REDACTED]",
          });
        }),
      );

      expect(scope.isDone()).toBeTruthy();
    });

    it("should not expose credentials in error messages", async () => {
      const scope = nock(baseURL).get("/error").reply(500);
      const client = createTestClient({
        headers: { Authorization: "Bearer super-secret-token" },
        retries: 0,
      });

      await expect(client.get("/error")).rejects.toSatisfy((error) => {
        const errorString = JSON.stringify(error);
        expect(errorString).not.toContain("super-secret-token");
        expect(errorString).toContain("[REDACTED]");
        return true;
      });

      expect(scope.isDone()).toBeTruthy();
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete success scenario", async () => {
      const scope = nock(baseURL)
        .get("/api/resource")
        .reply(200, { id: 1, name: "Test Resource" });

      const client = createResilientHttpClient({ baseURL });
      const response = await client.get("/api/resource");

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ id: 1, name: "Test Resource" });
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle retry and recovery scenario", async () => {
      const scope = nock(baseURL)
        .post("/api/create")
        .reply(503) // First attempt fails
        .post("/api/create")
        .reply(201, { created: true, id: 1 }); // Retry succeeds

      const client = createTestClient();
      const response = await client.post("/api/create", { name: "New Item" });

      expect(response.status).toBe(201);
      expect(response.data).toEqual({ created: true, id: 1 });
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle rate limiting with backoff", async () => {
      const scope = nock(baseURL)
        .get("/api/rate-limited")
        .reply(429, { error: "Rate limit exceeded" })
        .get("/api/rate-limited")
        .reply(429, { error: "Rate limit exceeded" })
        .get("/api/rate-limited")
        .reply(200, { data: "Success after rate limit" });

      const client = createTestClient();
      const response = await client.get("/api/rate-limited");

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ data: "Success after rate limit" });
      expect(scope.isDone()).toBeTruthy();
    });

    it("should fail fast on permanent client errors", async () => {
      const scope = nock(baseURL).delete("/api/resource/999").reply(404);

      const client = createTestClient();

      await expect(client.delete("/api/resource/999")).rejects.toSatisfy(
        expectAxiosError((error) => {
          const status: unknown = error.response?.status;
          expect(status).toBe(404);
        }),
      );

      expect(scope.isDone()).toBeTruthy();
    });
  });

  describe("configuration edge cases", () => {
    it("should handle zero retries", async () => {
      const scope = nock(baseURL).get("/no-retry").reply(500);
      const client = createTestClient({ retries: 0 });

      await expect(client.get("/no-retry")).rejects.toThrow();

      // Should only make one request
      expect(scope.isDone()).toBeTruthy();
    });

    it("should handle high retry count", async () => {
      const scope = nock(baseURL)
        .get("/many-retries")
        .times(5)
        .reply(500)
        .get("/many-retries")
        .reply(200, { success: true });

      const client = createTestClient({ retries: 5, retryDelay: 50 });
      const response = await client.get("/many-retries");

      expect(response.data).toEqual({ success: true });
      expectScopeDone(scope);
    }, 10_000); // 10 second timeout for this test

    it("should handle very short timeout", async () => {
      const scope = nock(baseURL)
        .get("/instant")
        .delay(50)
        .reply(200, { success: true });

      const client = createTestClient({ retries: 0, timeout: 10 });
      await expect(client.get("/instant")).rejects.toThrow();

      // Cleanup
      scope.persist(false);
      cleanAll();
    });
  });
});
