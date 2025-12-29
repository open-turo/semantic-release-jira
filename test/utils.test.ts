import { describe, expect, it } from "vitest";

import { getRepositoryName, shouldUpdateJira } from "~/utils.js";

import { createMockContext } from "./mocks/index.js";

describe("shouldUpdateJira", () => {
  it.each([
    { branch: "main", expected: true, releaseType: "minor" },
    { branch: "master", expected: true, releaseType: "minor" },
    {
      branch: { main: "release", name: "release" },
      expected: true,
      releaseType: "minor",
    },
  ])(
    "should return $expected for branch $branch and release type $releaseType",
    ({ branch, expected, releaseType }) => {
      const context = createMockContext({ branch, releaseType });
      expect(shouldUpdateJira(context)).toBe(expected);
    },
  );

  it.each([
    { branch: "feature/test", releaseType: "minor" },
    { branch: "main", releaseType: "prerelease" },
    { branch: "main", releaseType: "prepatch" },
    { branch: "feature/test", releaseType: "prerelease" },
  ])(
    "should return false for branch $branch and release type $releaseType",
    ({ branch, releaseType }) => {
      const context = createMockContext({ branch, releaseType });
      expect(shouldUpdateJira(context)).toBe(false);
    },
  );
});

describe("getRepositoryName", () => {
  it.each([
    {
      environment: { GITHUB_REPOSITORY: "open-turo/semantic-release-jira" },
      expected: "semantic-release-jira",
    },
    { environment: {}, expected: "unknown-repo" },
  ])(
    "should return $expected for environment $environment",
    ({ environment, expected }) => {
      expect(getRepositoryName(environment)).toBe(expected);
    },
  );
});
