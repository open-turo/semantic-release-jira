import { describe, expect, it } from "vitest";

import { detectGitHubRepo } from "~/github/client.js";

describe("detectGitHubRepo", () => {
  it("should detect GitHub repo from environment", () => {
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

  it("should detect repo without token", () => {
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
    const config = detectGitHubRepo({});

    expect(config).toBeUndefined();
  });

  it("should return undefined when repository format is invalid", () => {
    const environment = {
      GITHUB_REPOSITORY: "invalid-format",
    };

    const config = detectGitHubRepo(environment);

    expect(config).toBeUndefined();
  });
});
