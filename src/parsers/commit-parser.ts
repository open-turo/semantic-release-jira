/**
 * Parser for extracting Jira issues from commit messages
 */

import { CommitParser } from "conventional-commits-parser";

import { extractIssuesFromTexts } from "~/parsers/extract-issues.js";

const parser = new CommitParser();

/**
 * Extracts Jira issue keys from commit messages
 */
export function parseCommitsForIssues(
  commits: Array<{ message: string }>,
  issuePattern: RegExp,
): Set<string> {
  const issues = new Set<string>();

  for (const commit of commits) {
    const parsed = parser.parse(commit.message);

    const searchParts = [
      parsed.header,
      parsed.body,
      parsed.footer,
      ...parsed.references.map((reference: { raw: string }) => reference.raw),
    ].filter((part): part is string => typeof part === "string");

    for (const issue of extractIssuesFromTexts(searchParts, issuePattern)) {
      issues.add(issue);
    }
  }

  return issues;
}
