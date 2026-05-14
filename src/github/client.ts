/**
 * GitHub API client for fetching pull requests
 */

import { Octokit } from "@octokit/rest";
import pLimit from "p-limit";

import type { GitHubPullRequest } from "~/types/index.js";
import type { StructuredLogger } from "~/utils/logger.js";

import { getErrorMessage } from "~/utils/error.js";

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
 * Fetches GitHub pull requests for a set of commits with error handling.
 * Returns empty array when not in a GitHub environment or on API errors.
 */
export async function fetchGitHubPullRequests(
  commits: Array<{ hash: string; message: string }>,
  environment: Record<string, string | undefined>,
  options: {
    branchName?: string;
    concurrency: number;
    logger: StructuredLogger;
  },
): Promise<GitHubPullRequest[]> {
  const githubConfig = detectGitHubRepo(environment);

  if (!githubConfig) {
    options.logger.log(
      "Not running in GitHub environment - skipping PR parsing",
      { operation: "fetchPullRequests" },
    );
    return [];
  }

  try {
    const client = createGitHubClient(githubConfig.token);
    const commitShas = commits.map((c) => c.hash);

    const pullRequests = await fetchPullRequestsForCommits(
      client,
      githubConfig.owner,
      githubConfig.repo,
      commitShas,
      options.branchName,
      options.concurrency,
    );

    options.logger.log(
      `Fetched ${pullRequests.length} pull requests from GitHub`,
      {
        operation: "fetchPullRequests",
        prCount: pullRequests.length,
      },
    );
    return pullRequests;
  } catch (error) {
    options.logger.log(
      `Could not fetch GitHub PRs: ${getErrorMessage(error)}`,
      {
        error: error,
        operation: "fetchPullRequests",
        success: false,
      },
    );
    return [];
  }
}

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
