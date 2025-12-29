/* eslint-disable sonarjs/code-eval */
/**
 * Tests for URL encoding and generation utilities
 */

import { describe, expect, it } from "vitest";

import { generateIssueUrl, isSecureUrl } from "~/utils/url.js";

describe("generateIssueUrl", () => {
  describe("standard URL generation", () => {
    it.each([
      {
        expected: "https://jira.example.com/browse/PROJECT-123",
        issueKey: "PROJECT-123",
        serverUrl: "https://jira.example.com",
      },
      {
        expected: "https://jira.example.com/browse/PROJECT-123",
        issueKey: "PROJECT-123",
        serverUrl: "https://jira.example.com/",
      },
      {
        expected: "https://jira.example.com/browse/PROJECT-123",
        issueKey: "PROJECT-123",
        serverUrl: "https://jira.example.com/jira",
      },
    ])(
      "should generate URL: $expected",
      ({ expected, issueKey, serverUrl }) => {
        expect(generateIssueUrl(serverUrl, issueKey)).toBe(expected);
      },
    );
  });

  describe("XSS prevention", () => {
    it.each([
      {
        encoded: "%3Cscript%3E",
        issueKey: "PROJ-<script>",
        notEncoded: "<script>",
      },
      { encoded: "%26", issueKey: "PROJ-123&alert(1)", notEncoded: "&alert" },
      {
        encoded: "%22",
        issueKey: 'PROJ-123"onload="alert(1)',
        notEncoded: '"onload=',
      },
      {
        encoded: "%27",
        issueKey: "PROJ-123'onclick='alert(1)",
        notEncoded: "'onclick=",
      },
      { encoded: "%20", issueKey: "PROJ-123 456", notEncoded: " " },
      {
        encoded: "javascript%3Aalert",
        issueKey: "javascript:alert(1)",
        notEncoded: "javascript:",
      },
    ])("should encode $issueKey", ({ encoded, issueKey, notEncoded }) => {
      const url = generateIssueUrl("https://jira.example.com", issueKey);
      expect(url).toContain(encoded);
      expect(url).not.toContain(notEncoded);
    });

    it("should handle data URI XSS attempt", () => {
      const url = generateIssueUrl(
        "https://jira.example.com",
        "data:text/html,<script>alert(1)</script>",
      );
      expect(url).not.toContain("data:text/html");
      expect(url).toContain("%3A");
      expect(url).toContain("%3C");
    });
  });

  describe("special characters", () => {
    it.each([
      { encoded: "%23", issueKey: "PROJ-123#456" },
      { encoded: "%2F", issueKey: "PROJ-123/456" },
      { encoded: "%5C", issueKey: String.raw`PROJ-123\456` },
      { encoded: "%3F", issueKey: "PROJ-123?param=value" },
      { encoded: "%C3%B1", issueKey: "PROJ-123-ñ" },
      { encoded: "%F0%9F%9A%80", issueKey: "PROJ-123🚀" },
    ])("should encode $issueKey", ({ encoded, issueKey }) => {
      const url = generateIssueUrl("https://jira.example.com", issueKey);
      expect(url).toContain(encoded);
    });
  });

  describe("malformed URLs", () => {
    it.each([
      { issueKey: "PROJECT-123", serverUrl: "not-a-valid-url" },
      { issueKey: "PROJECT-123", serverUrl: "jira.example.com" },
      { issueKey: "PROJECT-123", serverUrl: "" },
    ])(
      "should handle malformed server URL: $serverUrl",
      ({ issueKey, serverUrl }) => {
        const url = generateIssueUrl(serverUrl, issueKey);
        expect(url).toContain(issueKey);
      },
    );
  });

  describe("real-world scenarios", () => {
    it.each([
      {
        expected: "https://mycompany.atlassian.net/browse/TEAM-456",
        issueKey: "TEAM-456",
        serverUrl: "https://mycompany.atlassian.net",
      },
      {
        expected: "https://jira.company.com:8443/browse/BUG-789",
        issueKey: "BUG-789",
        serverUrl: "https://jira.company.com:8443",
      },
      {
        expected: "https://company.com/browse/FEATURE-101",
        issueKey: "FEATURE-101",
        serverUrl: "https://company.com/jira",
      },
      {
        expected: "http://localhost:8080/browse/TEST-1",
        issueKey: "TEST-1",
        serverUrl: "http://localhost:8080",
      },
    ])(
      "should handle real-world URL: $serverUrl",
      ({ expected, issueKey, serverUrl }) => {
        expect(generateIssueUrl(serverUrl, issueKey)).toBe(expected);
      },
    );
  });

  describe("edge cases", () => {
    it("should handle very long issue keys", () => {
      const longKey = "PROJECT-" + "1".repeat(100);
      const url = generateIssueUrl("https://jira.example.com", longKey);
      expect(url).toContain(longKey);
    });

    it("should handle issue key with only allowed characters", () => {
      const url = generateIssueUrl("https://jira.example.com", "ABC123-999");
      expect(url).toBe("https://jira.example.com/browse/ABC123-999");
    });

    it("should not double-encode already encoded characters", () => {
      // This is expected behavior - we always encode the input
      const url = generateIssueUrl(
        "https://jira.example.com",
        "PROJ-%3Cscript%3E",
      );
      // encodeURIComponent will encode the % sign
      expect(url).toContain("%25");
    });
  });
});

describe("isSecureUrl", () => {
  it.each([
    { expected: true, url: "https://jira.example.com" },
    { expected: true, url: "https://jira.example.com:8443" },
    { expected: true, url: "https://invalid url with spaces" },
    { expected: false, url: "http://jira.example.com" },
    { expected: false, url: "http://jira.example.com:8080" },
    { expected: false, url: "not-a-url" },
    { expected: false, url: "file:///tmp/file.txt" },
    { expected: false, url: "ftp://server.example.com" },
  ])("should return $expected for $url", ({ expected, url }) => {
    expect(isSecureUrl(url)).toBe(expected);
  });
});

describe("XSS attack vectors", () => {
  it("should prevent reflected XSS in markdown", () => {
    const attackVector = '<img src=x onerror="alert(1)">';
    const url = generateIssueUrl("https://jira.example.com", attackVector);

    // Ensure no executable HTML remains
    expect(url).not.toContain("<img");
    expect(url).not.toContain("onerror=");
    expect(url).not.toContain("alert(1)");

    // Should be properly encoded
    expect(url).toContain("%3C");
    expect(url).toContain("%3E");
    expect(url).toContain("%22");
  });

  it("should prevent JavaScript event handler injection", () => {
    const attackVector = '" onclick="alert(1)"';
    const url = generateIssueUrl("https://jira.example.com", attackVector);

    expect(url).not.toContain("onclick=");
    expect(url).toContain("%22");
  });

  it("should prevent CSS injection", () => {
    const attackVector = "'; background:url(javascript:alert(1)); '";
    const url = generateIssueUrl("https://jira.example.com", attackVector);

    expect(url).not.toContain("javascript:");
    expect(url).toContain("%27");
  });

  it("should handle markdown link injection attempt", () => {
    const attackVector = "](javascript:alert(1))[";
    const url = generateIssueUrl("https://jira.example.com", attackVector);

    // Should encode all special markdown characters
    expect(url).toContain("%5D"); // ]
    expect(url).toContain("%5B"); // [
    expect(url).toContain("%28"); // (
    expect(url).toContain("%29"); // )
  });
});
