/**
 * GitHub API client for fetching pull requests
 */

import { Octokit } from "@octokit/rest";
import pLimit from "p-limit";

import type { GitHubPullRequest } from "~/types/index.js";

export interface GitHubConfig {
  owner: string;
  repo: string;
  token?: string;
}

/**
 * Creates a GitHub client
 */
export function createGitHubClient(token?: string): Octokit {
  return new Octokit({
    auth: token,
  });
}

/**
 * Detects GitHub repository from environment
 */
export function detectGitHubRepo(
  environment: Record<string, string | undefined>,
): GitHubConfig | undefined {
  // GitHub Actions environment
  const repository = environment.GITHUB_REPOSITORY;
  if (!repository) {
    return undefined;
  }

  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    return undefined;
  }

  return {
    owner,
    repo,
    token: environment.GITHUB_TOKEN,
  };
}

const DEFAULT_GITHUB_CONCURRENCY = 5;

/**
 * Fetches pull requests associated with commit SHAs.
 * Includes merged PRs and the current branch's open PR (if any).
 * Requests are fanned out in parallel up to `concurrencyLimit` at a time.
 */
export async function fetchPullRequestsForCommits(
  client: Octokit,
  owner: string,
  repo: string,
  commitShas: string[],
  branchName?: string,
  concurrencyLimit: number = DEFAULT_GITHUB_CONCURRENCY,
): Promise<GitHubPullRequest[]> {
  const limit = pLimit(concurrencyLimit);

  const results = await Promise.allSettled(
    commitShas.map((sha) =>
      limit(() =>
        client.repos.listPullRequestsAssociatedWithCommit({
          commit_sha: sha,
          owner,
          repo,
        }),
      ),
    ),
  );

  const seenPRs = new Set<number>();
  const pullRequests: GitHubPullRequest[] = [];

  for (const result of results) {
    if (result.status === "rejected") {
      // Silently skip commits without PRs or on API errors
      continue;
    }

    for (const pr of result.value.data) {
      if (seenPRs.has(pr.number)) {
        continue;
      }

      const isCurrentBranchPR =
        branchName !== undefined && pr.head.ref === branchName;

      // Include merged PRs and the current branch's open PR
      if (pr.merged_at || isCurrentBranchPR) {
        seenPRs.add(pr.number);
        pullRequests.push({
          body: pr.body ?? undefined,
          merged: Boolean(pr.merged_at),
          number: pr.number,
          state: pr.state,
        });
      }
    }
  }

  return pullRequests;
}
