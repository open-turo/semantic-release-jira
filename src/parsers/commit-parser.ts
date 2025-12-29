/**
 * Parser for extracting Jira issues from commit messages
 */

import { CommitParser } from "conventional-commits-parser";

import { extractIssuesFromText } from "~/parsers/extract-issues.js";

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
      // eslint-disable-next-line unicorn/prefer-native-coercion-functions -- Type guard required for TypeScript
    ].filter((part): part is string => Boolean(part));

    for (const part of searchParts) {
      const partIssues = extractIssuesFromText(part, issuePattern);
      for (const issue of partIssues) {
        issues.add(issue);
      }
    }
  }

  return issues;
}
