/**
 * Parser for extracting Jira issues from branch names
 */

import { extractIssuesFromText } from "~/parsers/extract-issues.js";

/**
 * Extracts Jira issue keys from branch name
 */
export function parseBranchForIssues(
  branchName: string,
  issuePattern: RegExp,
): Set<string> {
  return extractIssuesFromText(branchName, issuePattern);
}
