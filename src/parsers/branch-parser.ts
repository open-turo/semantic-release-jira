/**
 * Parser for extracting Jira issues from branch names
 */

import { extractIssuesFromText } from "~/parsers/extract-issues.js";

/**
 * Extracts Jira issue keys from branch name.
 * Matches case-insensitively since branch names are often lowercase,
 * then normalizes keys to uppercase (e.g. devops-123 -> DEVOPS-123).
 */
export function parseBranchForIssues(
  branchName: string,
  issuePattern: RegExp,
): Set<string> {
  return extractIssuesFromText(branchName.toUpperCase(), issuePattern);
}
