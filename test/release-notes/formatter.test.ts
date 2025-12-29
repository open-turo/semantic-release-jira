import { describe, expect, it } from "vitest";

import type { JiraIssue } from "~/types/index.js";

import { generateJiraNotesSection } from "~/release-notes/formatter.js";

const jiraServerUrl = "https://company.atlassian.net";

function createIssue(
  key: string,
  projectKey: string,
  summary?: string,
): JiraIssue {
  return { key, projectKey, summary };
}

function expectUrlContains(notes: string, issueKey: string): void {
  expect(notes).toContain(`${jiraServerUrl}/browse/${issueKey}`);
}

describe("generateJiraNotesSection", () => {
  it("should generate notes for single project", () => {
    const issues = [
      createIssue("PROJECT-123", "PROJECT"),
      createIssue("PROJECT-456", "PROJECT"),
    ];

    const notes = generateJiraNotesSection(issues, jiraServerUrl);

    expect(notes).toContain("## Jira Issues");
    expect(notes).toContain("### PROJECT");
    expect(notes).toContain("[PROJECT-123]");
    expectUrlContains(notes, "PROJECT-123");
    expect(notes).toContain("[PROJECT-456]");
    expectUrlContains(notes, "PROJECT-456");
  });

  it("should generate notes for multiple projects", () => {
    const issues = [
      createIssue("PROJECT-123", "PROJECT"),
      createIssue("TEAM-456", "TEAM"),
    ];

    const notes = generateJiraNotesSection(issues, jiraServerUrl);

    expect(notes).toContain("### PROJECT");
    expect(notes).toContain("### TEAM");
  });

  it("should sort projects alphabetically", () => {
    const issues = [
      createIssue("ZEBRA-123", "ZEBRA"),
      createIssue("ALPHA-456", "ALPHA"),
    ];

    const notes = generateJiraNotesSection(issues, jiraServerUrl);

    const alphaIndex = notes.indexOf("### ALPHA");
    const zebraIndex = notes.indexOf("### ZEBRA");

    expect(alphaIndex).toBeLessThan(zebraIndex);
  });

  it("should sort issues by number within project", () => {
    const issues = [
      createIssue("PROJECT-456", "PROJECT"),
      createIssue("PROJECT-123", "PROJECT"),
      createIssue("PROJECT-789", "PROJECT"),
    ];

    const notes = generateJiraNotesSection(issues, jiraServerUrl);

    const index123 = notes.indexOf("PROJECT-123");
    const index456 = notes.indexOf("PROJECT-456");
    const index789 = notes.indexOf("PROJECT-789");

    expect(index123).toBeLessThan(index456);
    expect(index456).toBeLessThan(index789);
  });

  it("should return empty string for no issues", () => {
    const notes = generateJiraNotesSection([], jiraServerUrl);

    expect(notes).toBe("");
  });

  it("should generate valid markdown links", () => {
    const issues = [createIssue("PROJECT-123", "PROJECT")];

    const notes = generateJiraNotesSection(issues, jiraServerUrl);

    expect(notes).toMatch(
      /\[PROJECT-123\]\(https:\/\/company\.atlassian\.net\/browse\/PROJECT-123\)/,
    );
  });

  describe("Issue Summaries", () => {
    it("should include summary when available", () => {
      const issues = [
        createIssue("PROJECT-123", "PROJECT", "Implement user authentication"),
      ];

      const notes = generateJiraNotesSection(issues, jiraServerUrl);

      expect(notes).toContain(
        "- [PROJECT-123](https://company.atlassian.net/browse/PROJECT-123): Implement user authentication",
      );
    });

    it("should handle issues without summary", () => {
      const issues = [createIssue("PROJECT-123", "PROJECT")];

      const notes = generateJiraNotesSection(issues, jiraServerUrl);

      expect(notes).toContain(
        "- [PROJECT-123](https://company.atlassian.net/browse/PROJECT-123)",
      );
      const lines = notes.split("\n");
      const issueLine = lines.find((line) => line.includes("PROJECT-123"));
      expect(issueLine).not.toContain("PROJECT-123]:");
    });

    it("should handle mixed issues with and without summaries", () => {
      const issues = [
        createIssue("PROJECT-123", "PROJECT", "Add new feature"),
        createIssue("PROJECT-456", "PROJECT"),
        createIssue("PROJECT-789", "PROJECT", "Fix critical bug"),
      ];

      const notes = generateJiraNotesSection(issues, jiraServerUrl);

      expect(notes).toContain(
        "[PROJECT-123](https://company.atlassian.net/browse/PROJECT-123): Add new feature",
      );
      expect(notes).toContain(
        "- [PROJECT-456](https://company.atlassian.net/browse/PROJECT-456)\n",
      );
      expect(notes).toContain(
        "[PROJECT-789](https://company.atlassian.net/browse/PROJECT-789): Fix critical bug",
      );
    });

    it("should handle empty summary string", () => {
      const issues = [createIssue("PROJECT-123", "PROJECT", "")];

      const notes = generateJiraNotesSection(issues, jiraServerUrl);

      expect(notes).toContain(
        "- [PROJECT-123](https://company.atlassian.net/browse/PROJECT-123)",
      );
      const lines = notes.split("\n");
      const issueLine = lines.find((line) => line.includes("PROJECT-123"));
      expect(issueLine).not.toContain("PROJECT-123]:");
    });

    it("should handle summary with special characters", () => {
      const issues = [
        createIssue(
          "PROJECT-123",
          "PROJECT",
          'Fix bug with "quotes" & <brackets>',
        ),
      ];

      const notes = generateJiraNotesSection(issues, jiraServerUrl);

      expect(notes).toContain(': Fix bug with "quotes" & <brackets>');
    });

    it("should handle very long summaries", () => {
      const longSummary = "A".repeat(200);
      const issues = [createIssue("PROJECT-123", "PROJECT", longSummary)];

      const notes = generateJiraNotesSection(issues, jiraServerUrl);

      expect(notes).toContain(longSummary);
    });

    it("should handle multiline summary (should remain on one line in markdown)", () => {
      const issues = [
        createIssue("PROJECT-123", "PROJECT", "First line\nSecond line"),
      ];

      const notes = generateJiraNotesSection(issues, jiraServerUrl);

      expect(notes).toContain(": First line\nSecond line");
    });
  });

  describe("URL encoding and XSS prevention", () => {
    it("should encode < and > in URLs", () => {
      const issues = [createIssue("PROJ-<script>", "PROJ")];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("browse/PROJ-%3Cscript%3E");
    });

    it("should encode & in URLs", () => {
      const issues = [createIssue("PROJ-123&alert(1)", "PROJ")];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("browse/PROJ-123%26alert%281%29");
    });

    it("should encode quotes in URLs", () => {
      const issues = [createIssue('PROJ-123"onload="alert', "PROJ")];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("%22");
    });

    it("should encode spaces in URLs", () => {
      const issues = [createIssue("PROJ-123 456", "PROJ")];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("browse/PROJ-123%20456");
    });

    it("should prevent XSS through URL encoding", () => {
      const issues = [createIssue('<img src=x onerror="alert(1)">', "PROJ")];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("%3C");
      expect(notes).toContain("%3E");
      expect(notes).toContain("%22");
    });

    it("should prevent markdown link injection via URL encoding", () => {
      const issues = [createIssue("PROJ-](javascript:alert(1))[", "PROJ")];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("%5D");
      expect(notes).toContain("%28");
      expect(notes).toContain("%29");
      expect(notes).toContain("%5B");
    });

    it("should handle URL with trailing slash", () => {
      const issues = [createIssue("PROJECT-123", "PROJECT")];
      const notes = generateJiraNotesSection(
        issues,
        "https://company.atlassian.net/",
      );
      expect(notes).not.toContain("/browse//");
      expect(notes).toContain("/browse/PROJECT-123");
    });

    it("should handle special characters in URL", () => {
      const issues = [createIssue("PROJ-123#456?param=value", "PROJ")];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("%23");
      expect(notes).toContain("%3F");
      expect(notes).toContain("%3D");
    });

    it("should handle unicode characters in URL", () => {
      const issues = [createIssue("PROJ-123-ñ", "PROJ")];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("%C3%B1");
    });

    it("should handle forward slash in URL", () => {
      const issues = [createIssue("PROJ-123/456", "PROJ")];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("%2F");
    });

    it("should handle backslash in URL", () => {
      const issues = [createIssue(String.raw`PROJ-123\456`, "PROJ")];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("%5C");
    });
  });

  describe("real-world security scenarios", () => {
    it("should prevent reflected XSS attack via URL encoding", () => {
      const issues = [
        createIssue('"><script>document.cookie</script><a href="', "PROJ"),
      ];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("%3C");
      expect(notes).toContain("%3E");
      expect(notes).toContain("%22");
    });

    it("should prevent CSS injection via URL encoding", () => {
      const issues = [
        createIssue("'; background:url(javascript:alert(1)); '", "PROJ"),
      ];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("%3A");
      expect(notes).toContain("%27");
    });

    it("should safely handle data URI attack via URL encoding", () => {
      const issues = [
        createIssue("data:text/html,<script>alert(1)</script>", "PROJ"),
      ];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("%3A");
      expect(notes).toContain("%3C");
      expect(notes).toContain("%3E");
    });
  });

  describe("edge cases", () => {
    it("should handle very long issue keys", () => {
      const longKey = "PROJECT-" + "1".repeat(100);
      const issues = [createIssue(longKey, "PROJECT")];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain(longKey);
    });

    it("should handle empty issue key", () => {
      const issues = [createIssue("", "PROJECT")];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("## Jira Issues");
      expect(notes).toContain("### PROJECT");
    });

    it("should handle issue key with only special characters in URL", () => {
      const issues = [createIssue("<>&\"'", "PROJECT")];
      const notes = generateJiraNotesSection(issues, jiraServerUrl);
      expect(notes).toContain("%3C");
      expect(notes).toContain("%3E");
      expect(notes).toContain("%26");
      expect(notes).toContain("%22");
      expect(notes).toContain("%27");
    });
  });
});
