/**
 * Release notes generation for Jira issues
 */

import type { JiraIssue } from "~/types/index.js";

import { groupIssuesByProject } from "~/parsers/issue-collector.js";
import { generateIssueUrl } from "~/utils/url.js";

/**
 * Generates release notes section for Jira issues
 */
export function generateJiraNotesSection(
  issues: JiraIssue[],
  jiraServerUrl: string,
): string {
  if (issues.length === 0) {
    return "";
  }

  const grouped = groupIssuesByProject(issues);
  const sortedProjects = [...grouped.keys()].sort((a, b) => a.localeCompare(b));

  const lines: string[] = ["## Jira Issues", ""];

  for (const projectKey of sortedProjects) {
    const projectIssues = grouped.get(projectKey)!;
    const sortedIssues = sortIssuesByNumber(projectIssues);

    lines.push(`### ${projectKey}`, "");

    for (const issue of sortedIssues) {
      const issueUrl = generateIssueUrl(jiraServerUrl, issue.key);
      const line = formatIssueLine(issue, issueUrl);
      lines.push(line);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Extracts the numeric component from an issue key
 */
function extractIssueNumber(issueKey: string): number {
  return Number.parseInt(issueKey.split("-")[1], 10);
}

/**
 * Formats an issue as a markdown list item
 */
function formatIssueLine(issue: JiraIssue, issueUrl: string): string {
  if (issue.summary) {
    return `- [${issue.key}](${issueUrl}): ${issue.summary}`;
  }
  return `- [${issue.key}](${issueUrl})`;
}

/**
 * Sorts issues by their numeric component
 */
function sortIssuesByNumber(issues: JiraIssue[]): JiraIssue[] {
  return [...issues].sort((a, b) => {
    const aNumber = extractIssueNumber(a.key);
    const bNumber = extractIssueNumber(b.key);
    return aNumber - bNumber;
  });
}
