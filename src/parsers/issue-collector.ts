/**
 * Main issue collection orchestrator
 */

import type {
  CollectedIssues,
  GitHubPullRequest,
  JiraIssue,
} from "~/types/index.js";

import { isValidIssueKeyFormat } from "~/config/validate.js";
import { parseBranchForIssues } from "~/parsers/branch-parser.js";
import { parseCommitsForIssues } from "~/parsers/commit-parser.js";
import { parsePullRequestsForIssues } from "~/parsers/pr-parser.js";

/**
 * Collects and deduplicates Jira issues from all sources
 */
export function collectIssues(
  commits: Array<{ message: string }>,
  branchName: string,
  pullRequests: GitHubPullRequest[],
  issuePattern: RegExp,
): CollectedIssues {
  const allIssues = new Set<string>();

  const commitIssues = parseCommitsForIssues(commits, issuePattern);
  const branchIssues = parseBranchForIssues(branchName, issuePattern);
  const prIssues = parsePullRequestsForIssues(pullRequests, issuePattern);

  return {
    issues: allIssues,
    sources: {
      branch: mergeIssues(allIssues, branchIssues),
      commits: mergeIssues(allIssues, commitIssues),
      pullRequests: mergeIssues(allIssues, prIssues),
    },
  };
}

/**
 * Groups issues by project key
 */
export function groupIssuesByProject(
  issues: JiraIssue[],
): Map<string, JiraIssue[]> {
  const grouped = new Map<string, JiraIssue[]>();

  for (const issue of issues) {
    const existing = grouped.get(issue.projectKey) ?? [];
    existing.push(issue);
    grouped.set(issue.projectKey, existing);
  }

  return grouped;
}

/**
 * Converts issue keys to structured JiraIssue objects.
 * Validates issue key format using the provided pattern (or the default when
 * none is supplied) and safely splits valid keys.
 */
export function parseIssueKeys(
  issueKeys: Set<string>,
  pattern?: RegExp,
): JiraIssue[] {
  const parsedIssues: JiraIssue[] = [];

  for (const key of issueKeys) {
    if (!isValidIssueKeyFormat(key, pattern)) {
      continue;
    }

    const projectKey = key.split("-")[0];
    if (!projectKey) {
      continue;
    }

    parsedIssues.push({
      key,
      projectKey,
    });
  }

  return parsedIssues;
}

/**
 * Merges a source Set into the target Set and returns the source size
 */
function mergeIssues(target: Set<string>, source: Set<string>): number {
  for (const issue of source) {
    target.add(issue);
  }
  return source.size;
}
