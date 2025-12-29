/**
 * Integration tests for GitHub client functions
 *
 * Tests GitHub API operations with mocked HTTP calls
 */

import { Octokit } from "@octokit/rest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGitHubClient,
  detectGitHubRepo,
  fetchPullRequestsForCommits,
} from "~/github/client.js";

import {
  createMockGitHubClient,
  createMockGitHubClientWithError,
  createMockGitHubClientWithMergedPR,
  createMockGitHubClientWithNoPRs,
  setupNockEnvironment,
  teardownNockEnvironment,
} from "../mocks/index.js";

describe("GitHub Client Integration", () => {
  beforeEach(() => {
    setupNockEnvironment();
  });

  afterEach(() => {
    teardownNockEnvironment();
  });

  describe("createGitHubClient", () => {
    it("should create client with authentication token", () => {
      const client = createGitHubClient("ghp_test123");

      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(Octokit);
    });

    it("should create client without authentication", () => {
      const client = createGitHubClient();

      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(Octokit);
    });

    it("should create client with undefined token", () => {
      const client = createGitHubClient();

      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(Octokit);
    });
  });

  describe("detectGitHubRepo", () => {
    it("should detect GitHub repository from environment", () => {
      const environment = {
        GITHUB_REPOSITORY: "open-turo/semantic-release-jira",
        GITHUB_TOKEN: "ghp_token123",
      };

      const config = detectGitHubRepo(environment);

      expect(config).not.toBeUndefined();
      expect(config?.owner).toBe("open-turo");
      expect(config?.repo).toBe("semantic-release-jira");
      expect(config?.token).toBe("ghp_token123");
    });

    it("should detect repository without token", () => {
      const environment = {
        GITHUB_REPOSITORY: "owner/repo",
      };

      const config = detectGitHubRepo(environment);

      expect(config).not.toBeUndefined();
      expect(config?.owner).toBe("owner");
      expect(config?.repo).toBe("repo");
      expect(config?.token).toBeUndefined();
    });

    it("should return undefined when not in GitHub environment", () => {
      const environment = {};

      const config = detectGitHubRepo(environment);

      expect(config).toBeUndefined();
    });

    it("should handle environment with other CI variables", () => {
      const environment = {
        CI: "true",
        CIRCLE_REPOSITORY: "owner/repo",
      };

      const config = detectGitHubRepo(environment);

      expect(config).toBeUndefined();
    });
  });

  describe("fetchPullRequestsForCommits", () => {
    it("should fetch pull requests for single commit", async () => {
      const mockClient = createMockGitHubClientWithMergedPR(
        42,
        "This is a PR body with JIRA-123",
      );

      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        ["abc123"],
      );

      expect(prs).toHaveLength(1);
      expect(prs[0]).toEqual({
        body: "This is a PR body with JIRA-123",
        merged: true,
        number: 42,
        state: "closed",
      });
    });

    it("should fetch pull requests for multiple commits", async () => {
      const mockClient = createMockGitHubClient([
        [
          {
            body: "PR for abc123",
            merged_at: "2023-01-01T00:00:00Z",
            number: 42,
            state: "closed",
          },
        ],
        [
          {
            body: "PR for def456",
            merged_at: "2023-01-02T00:00:00Z",
            number: 43,
            state: "closed",
          },
        ],
        [
          {
            body: "PR for ghi789",
            merged_at: "2023-01-03T00:00:00Z",
            number: 44,
            state: "closed",
          },
        ],
      ]);

      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        ["abc123", "def456", "ghi789"],
      );

      expect(prs).toHaveLength(3);
      expect(prs[0].number).toBe(42);
      expect(prs[1].number).toBe(43);
      expect(prs[2].number).toBe(44);
    });

    it("should deduplicate pull requests from multiple commits", async () => {
      const mockClient = createMockGitHubClient([
        [
          {
            body: "Shared PR",
            merged_at: "2023-01-01T00:00:00Z",
            number: 42,
            state: "closed",
          },
        ],
        [
          {
            body: "Shared PR",
            merged_at: "2023-01-01T00:00:00Z",
            number: 42,
            state: "closed",
          },
        ],
      ]);

      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        ["abc123", "def456"],
      );

      // Should only include PR #42 once
      expect(prs).toHaveLength(1);
      expect(prs[0].number).toBe(42);
    });

    it("should only include merged pull requests", async () => {
      const mockClient = createMockGitHubClient([
        [
          {
            body: "Merged PR",
            merged_at: "2023-01-01T00:00:00Z",
            number: 42,
            state: "closed",
          },
          {
            body: "Open PR",
            merged_at: undefined,
            number: 43,
            state: "open",
          },
          {
            body: "Closed but not merged PR",
            merged_at: undefined,
            number: 44,
            state: "closed",
          },
        ],
      ]);

      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        ["abc123"],
      );

      // Should only include merged PR
      expect(prs).toHaveLength(1);
      expect(prs[0].number).toBe(42);
      expect(prs[0].merged).toBe(true);
    });

    it("should handle commits with no pull requests", async () => {
      const mockClient = createMockGitHubClientWithNoPRs();

      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        ["abc123"],
      );

      expect(prs).toEqual([]);
    });

    it("should handle empty commit list", async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const mockClient = {} as Octokit;
      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        [],
      );

      expect(prs).toEqual([]);
    });

    it("should handle 404 not found (commit doesn't exist)", async () => {
      const mockClient = createMockGitHubClientWithError(
        new Error("Not Found"),
      );

      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        ["invalid"],
      );

      // Should silently skip and return empty array
      expect(prs).toEqual([]);
    });

    it("should handle 401 unauthorized", async () => {
      const mockClient = createMockGitHubClientWithError(
        new Error("Unauthorized"),
      );

      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        ["abc123"],
      );

      // Should silently skip and return empty array
      expect(prs).toEqual([]);
    });

    it("should handle network errors", async () => {
      const mockClient = createMockGitHubClientWithError(
        new Error("ECONNREFUSED"),
      );

      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        ["abc123"],
      );

      // Should silently skip and return empty array
      expect(prs).toEqual([]);
    });

    it("should continue after partial failures", async () => {
      const mockFunction = vi
        .fn()
        .mockResolvedValueOnce({
          data: [
            {
              body: "Success PR",
              merged_at: "2023-01-01T00:00:00Z",
              number: 42,
              state: "closed",
            },
          ],
        })
        .mockRejectedValueOnce(new Error("Internal server error"))
        .mockResolvedValueOnce({
          data: [
            {
              body: "Another success PR",
              merged_at: "2023-01-02T00:00:00Z",
              number: 43,
              state: "closed",
            },
          ],
        });

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const mockClient = {
        repos: {
          listPullRequestsAssociatedWithCommit: mockFunction,
        },
      } as unknown as Octokit;

      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        ["abc123", "def456", "ghi789"],
      );

      // Should return PRs from successful requests
      expect(prs).toHaveLength(2);
      expect(prs[0].number).toBe(42);
      expect(prs[1].number).toBe(43);
    });

    it("should handle PRs with null body", async () => {
      const mockClient = createMockGitHubClient([
        [
          {
            body: undefined,
            merged_at: "2023-01-01T00:00:00Z",
            number: 42,
            state: "closed",
          },
        ],
      ]);

      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        ["abc123"],
      );

      expect(prs).toHaveLength(1);
      expect(prs[0].body).toBeUndefined();
      expect(prs[0].number).toBe(42);
    });

    it("should handle PRs with empty body", async () => {
      const mockClient = createMockGitHubClient([
        [
          {
            body: "",
            merged_at: "2023-01-01T00:00:00Z",
            number: 42,
            state: "closed",
          },
        ],
      ]);

      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        ["abc123"],
      );

      expect(prs).toHaveLength(1);
      expect(prs[0].body).toBe("");
      expect(prs[0].number).toBe(42);
    });

    it("should handle large number of commits", async () => {
      const commits = Array.from(
        { length: 50 },
        (_, index) => `commit${index}`,
      );

      const mockFunction = vi
        .fn()
        .mockImplementation((parameters: { commit_sha: string }) => {
          const index = Number.parseInt(
            parameters.commit_sha.replace("commit", ""),
            10,
          );
          return Promise.resolve({
            data: [
              {
                body: `PR for ${parameters.commit_sha}`,
                merged_at: "2023-01-01T00:00:00Z",
                number: index + 1,
                state: "closed",
              },
            ],
          });
        });

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const mockClient = {
        repos: {
          listPullRequestsAssociatedWithCommit: mockFunction,
        },
      } as unknown as Octokit;

      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        commits,
      );

      expect(prs).toHaveLength(50);
      expect(prs[0].number).toBe(1);
      expect(prs[49].number).toBe(50);
    });

    it("should handle mixed success and failure scenarios", async () => {
      const mockFunction = vi
        .fn()
        .mockResolvedValueOnce({
          data: [
            {
              body: "Success 1",
              merged_at: "2023-01-01T00:00:00Z",
              number: 42,
              state: "closed",
            },
          ],
        })
        .mockRejectedValueOnce(new Error("Not Found"))
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({
          data: [
            {
              body: "Success 2",
              merged_at: "2023-01-02T00:00:00Z",
              number: 43,
              state: "closed",
            },
          ],
        })
        .mockRejectedValueOnce(new Error("Timeout"))
        .mockResolvedValueOnce({
          data: [
            {
              body: "Not merged",
              merged_at: undefined,
              number: 44,
              state: "open",
            },
          ],
        });

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const mockClient = {
        repos: {
          listPullRequestsAssociatedWithCommit: mockFunction,
        },
      } as unknown as Octokit;

      const prs = await fetchPullRequestsForCommits(
        mockClient,
        "owner",
        "repo",
        ["abc123", "def456", "ghi789", "jkl012", "mno345", "pqr678"],
      );

      // Should only include the 2 merged PRs from successful requests
      expect(prs).toHaveLength(2);
      expect(prs[0].number).toBe(42);
      expect(prs[1].number).toBe(43);
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle complete workflow from detection to PR fetching", async () => {
      const environment = {
        GITHUB_REPOSITORY: "owner/repo",
        GITHUB_TOKEN: "ghp_test123",
      };

      // Detect GitHub config
      const config = detectGitHubRepo(environment);
      expect(config).not.toBeUndefined();

      // Create mock client
      const mockClient = createMockGitHubClientWithMergedPR(
        42,
        "Fixes JIRA-123",
      );

      // Fetch PRs
      const prs = await fetchPullRequestsForCommits(
        mockClient,
        config!.owner,
        config!.repo,
        ["abc123"],
      );

      expect(prs).toHaveLength(1);
      expect(prs[0].body).toContain("JIRA-123");
    });

    it("should handle repository with no GitHub environment", () => {
      const environment = {
        CI: "true",
      };

      const config = detectGitHubRepo(environment);
      expect(config).toBeUndefined();
    });
  });
});
