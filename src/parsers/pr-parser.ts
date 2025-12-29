/**
 * Parser for extracting Jira issues from GitHub PR descriptions
 */

import type { GitHubPullRequest } from "~/types/index.js";

import { extractIssuesFromTexts } from "~/parsers/extract-issues.js";

/**
 * Extracts Jira issue keys from pull request descriptions
 */
export function parsePullRequestsForIssues(
  pullRequests: GitHubPullRequest[],
  issuePattern: RegExp,
): Set<string> {
  // eslint-disable-next-line unicorn/no-array-callback-reference -- Required for type narrowing
  const bodies = pullRequests.map((pr) => pr.body).filter(isNonEmptyString);
  return extractIssuesFromTexts(bodies, issuePattern);
}

/**
 * Type guard to filter out undefined values
 * Note: Cannot use Boolean directly as it doesn't provide type narrowing
 */
function isNonEmptyString(value: string | undefined): value is string {
  return value !== undefined;
}
