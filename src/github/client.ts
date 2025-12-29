/**
 * GitHub API client for fetching pull requests
 */

import { Octokit } from "@octokit/rest";

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

/**
 * Fetches pull requests associated with commit SHAs
 */
export async function fetchPullRequestsForCommits(
  client: Octokit,
  owner: string,
  repo: string,
  commitShas: string[],
): Promise<GitHubPullRequest[]> {
  const pullRequests: GitHubPullRequest[] = [];
  const seenPRs = new Set<number>();

  for (const sha of commitShas) {
    try {
      const { data } = await client.repos.listPullRequestsAssociatedWithCommit({
        commit_sha: sha,
        owner,
        repo,
      });

      for (const pr of data) {
        // Only include merged PRs and avoid duplicates
        if (pr.merged_at && !seenPRs.has(pr.number)) {
          seenPRs.add(pr.number);
          pullRequests.push({
            body: pr.body ?? undefined,
            merged: true,
            number: pr.number,
            state: pr.state,
          });
        }
      }
    } catch {
      // Silently skip commits without PRs or on API errors
      continue;
    }
  }

  return pullRequests;
}
