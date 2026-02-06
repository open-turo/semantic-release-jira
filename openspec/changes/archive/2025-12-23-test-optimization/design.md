# Design: Test Optimization

## Overview

This design focuses on creating reusable mock utilities to eliminate test verbosity and repetition, particularly in integration tests.

## Architecture

### Mock Utilities Structure

```
test/
├── mocks/
│   ├── jira-mocks.ts       # Nock factories for Jira API
│   ├── github-mocks.ts     # Octokit client factory
│   ├── context-mocks.ts    # Semantic-release context factory
│   └── index.ts            # Re-export all utilities
├── integration/
│   ├── environment-config.test.ts  # Will be refactored
│   ├── github-client.test.ts       # Will be refactored
│   └── ...
└── ...
```

## Detailed Design

### 1. Jira Mock Utilities (`test/mocks/jira-mocks.ts`)

Create factory functions for common nock() patterns:

```typescript
interface JiraMockOptions {
  serverUrl: string;
  username?: string;
  apiToken?: string;
}

interface MockIssueOptions {
  key: string;
  summary?: string;
  statusId?: string;
  statusName?: string;
}

export function mockJiraAuth(options: JiraMockOptions): nock.Scope {
  const { serverUrl, username = "test@example.com" } = options;
  return nock(serverUrl)
    .get("/rest/api/2/myself")
    .reply(200, { emailAddress: username });
}

export function mockJiraIssueVerification(
  serverUrl: string,
  issues: string[],
): nock.Scope {
  let scope = nock(serverUrl);
  for (const key of issues) {
    scope = scope
      .get(`/rest/api/2/issue/${key}?fields=key`)
      .reply(200, { key });
  }
  return scope;
}

export function mockJiraIssueSummaries(
  serverUrl: string,
  issues: MockIssueOptions[],
): nock.Scope {
  let scope = nock(serverUrl);
  for (const issue of issues) {
    scope = scope
      .get(`/rest/api/2/issue/${issue.key}?fields=summary`)
      .reply(200, {
        key: issue.key,
        fields: { summary: issue.summary || "Test summary" },
      });
  }
  return scope;
}

export function mockJiraTransitions(
  serverUrl: string,
  issues: MockIssueOptions[],
): nock.Scope {
  let scope = nock(serverUrl);
  for (const issue of issues) {
    const statusId = issue.statusId || "31";
    const statusName = issue.statusName || "Done";

    scope = scope
      .get(`/rest/api/2/issue/${issue.key}/transitions`)
      .reply(200, {
        transitions: [
          {
            id: statusId,
            name: statusName,
            to: { id: "10001", name: statusName },
          },
        ],
      })
      .post(`/rest/api/2/issue/${issue.key}/transitions`, {
        transition: { id: statusId },
      })
      .reply(204);
  }
  return scope;
}

export function mockJiraVersionCreation(
  serverUrl: string,
  projectKey: string,
  versionName: string,
  issueKeys: string[],
): nock.Scope {
  let scope = nock(serverUrl)
    .get(`/rest/api/2/project/${projectKey}`)
    .reply(200, { id: "10000", key: projectKey })
    .get(`/rest/api/2/project/${projectKey}/versions`)
    .reply(200, [])
    .post("/rest/api/2/version")
    .reply(200, { id: "20000", name: versionName });

  for (const key of issueKeys) {
    scope = scope.put(`/rest/api/2/issue/${key}`).reply(204);
  }

  return scope;
}

// Convenience function for full Jira workflow
export function mockJiraFullWorkflow(options: {
  serverUrl: string;
  username?: string;
  apiToken?: string;
  issues: MockIssueOptions[];
  includeTransitions?: boolean;
  includeVersions?: boolean;
  projectKey?: string;
  versionName?: string;
}): nock.Scope[] {
  const scopes: nock.Scope[] = [];

  scopes.push(mockJiraAuth(options));
  scopes.push(
    mockJiraIssueVerification(
      options.serverUrl,
      options.issues.map((i) => i.key),
    ),
  );
  scopes.push(mockJiraIssueSummaries(options.serverUrl, options.issues));

  if (options.includeTransitions) {
    scopes.push(mockJiraTransitions(options.serverUrl, options.issues));
  }

  if (options.includeVersions && options.projectKey && options.versionName) {
    scopes.push(
      mockJiraVersionCreation(
        options.serverUrl,
        options.projectKey,
        options.versionName,
        options.issues.map((i) => i.key),
      ),
    );
  }

  return scopes;
}
```

### 2. GitHub Mock Utilities (`test/mocks/github-mocks.ts`)

Create factory for Octokit client mocks:

```typescript
import type { Octokit } from "@octokit/rest";
import { vi } from "vitest";

interface MockPullRequest {
  number: number;
  body?: string;
  state: string;
  merged_at?: string | null;
}

export function createMockGitHubClient(
  prResponses: MockPullRequest[][] = [],
): Octokit {
  const mockFn = vi.fn();

  // Setup sequential responses
  for (const response of prResponses) {
    mockFn.mockResolvedValueOnce({ data: response });
  }

  return {
    repos: {
      listPullRequestsAssociatedWithCommit: mockFn,
    },
  } as unknown as Octokit;
}

// Convenience factories for common scenarios
export function createMockGitHubClientWithMergedPR(
  number: number,
  body: string,
): Octokit {
  return createMockGitHubClient([
    [
      {
        number,
        body,
        state: "closed",
        merged_at: "2023-01-01T00:00:00Z",
      },
    ],
  ]);
}

export function createMockGitHubClientWithMultiplePRs(
  prs: Array<{ number: number; body: string }>,
): Octokit {
  return createMockGitHubClient(
    prs.map((pr) => [
      {
        number: pr.number,
        body: pr.body,
        state: "closed",
        merged_at: "2023-01-01T00:00:00Z",
      },
    ]),
  );
}

export function createMockGitHubClientWithError(error: Error): Octokit {
  return {
    repos: {
      listPullRequestsAssociatedWithCommit: vi.fn().mockRejectedValue(error),
    },
  } as unknown as Octokit;
}
```

### 3. Context Mock Utilities (`test/mocks/context-mocks.ts`)

Enhanced context factory (move from environment-config.test.ts):

```typescript
import type { SemanticReleaseContext } from "~/types/index.js";
import { vi } from "vitest";

export interface MockCommit {
  hash: string;
  message: string;
}

export interface MockContextOptions {
  commits?: MockCommit[];
  version?: string;
  releaseType?: string;
  branch?: string;
  env?: Record<string, string>;
  cwd?: string;
}

export function createMockContext(
  options: MockContextOptions = {},
): SemanticReleaseContext {
  return {
    branch: {
      name: options.branch || "main",
      main: "main",
    },
    commits: options.commits || [
      {
        hash: "abc123",
        message: "feat(PROJ-123): add new feature",
      },
      {
        hash: "def456",
        message: "fix(PROJ-456): fix critical bug",
      },
    ],
    cwd: options.cwd || "/tmp/test-repo",
    env: options.env || {},
    logger: {
      log: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
    },
    nextRelease: {
      version: options.version || "1.2.0",
      type: options.releaseType || "minor",
      notes: "",
    },
  };
}

// Convenience factory for single-issue scenarios
export function createMockContextWithIssue(
  issueKey: string,
  commitMessage?: string,
): SemanticReleaseContext {
  return createMockContext({
    commits: [
      {
        hash: "abc123",
        message: commitMessage || `feat(${issueKey}): test commit`,
      },
    ],
  });
}
```

### 4. Test Helper Utilities

Add assertion helpers:

```typescript
import type { Mock } from "vitest";
import type { SemanticReleaseContext } from "~/types/index.js";

export function expectLogContains(
  logger: SemanticReleaseContext["logger"],
  text: string,
): void {
  const logCalls = (logger.log as Mock).mock.calls;
  const successCalls = logger.success
    ? (logger.success as Mock).mock.calls
    : [];
  const allCalls = [...logCalls, ...successCalls];

  const found = allCalls.some((call) =>
    call.some((arg) => typeof arg === "string" && arg.includes(text)),
  );

  expect(found).toBe(true);
}

export function expectNoErrorLogs(
  logger: SemanticReleaseContext["logger"],
): void {
  expect((logger.error as Mock).mock.calls).toHaveLength(0);
}

export function getAllScopesAreDone(scopes: nock.Scope[]): void {
  for (const scope of scopes) {
    expect(scope.isDone()).toBeTruthy();
  }
}
```

## Refactoring Strategy

### Phase 1: Create Mock Utilities

1. Create `test/mocks/` directory
2. Implement jira-mocks.ts
3. Implement github-mocks.ts
4. Implement context-mocks.ts
5. Create index.ts to re-export all utilities

### Phase 2: Refactor Integration Tests

1. Start with environment-config.test.ts (most repetitive)
2. Replace nock() setup with mock factories
3. Consolidate similar test scenarios
4. Verify all tests still pass

### Phase 3: Refactor GitHub Tests

1. Refactor github-client.test.ts
2. Replace mockClient definitions with factory
3. Simplify test structure

### Phase 4: Validation

1. Run full test suite
2. Generate coverage report
3. Verify no coverage regression
4. Check for test performance improvements

## Trade-offs

### Abstraction vs. Explicitness

- **Pro**: Mock utilities hide repetitive setup, making tests more readable
- **Con**: Developers need to understand utility functions to modify tests
- **Decision**: Keep utilities simple and well-documented with examples

### Consolidation vs. Granularity

- **Pro**: Merging similar tests reduces LOC and maintenance
- **Con**: Risk of losing specific edge case coverage
- **Decision**: Only consolidate tests that truly test the same behavior; preserve edge cases

### Flexibility vs. Convenience

- **Pro**: High-level utilities (like `mockJiraFullWorkflow`) are very convenient
- **Con**: May not fit all scenarios, requiring fallback to lower-level utilities
- **Decision**: Provide both high-level convenience functions and low-level building blocks

## Example Refactoring

### Before (environment-config.test.ts):

```typescript
it("should work with only environment variables", async () => {
  // 60+ lines of nock setup
  const authScope = nock(jiraServerUrl)
    .get("/rest/api/2/myself")
    .reply(200, { emailAddress: jiraUsername });

  const issueScope = nock(jiraServerUrl)
    .get("/rest/api/2/issue/PROJ-123?fields=key")
    .reply(200, { key: "PROJ-123" })
    .get("/rest/api/2/issue/PROJ-456?fields=key")
    .reply(200, { key: "PROJ-456" });

  // ... 40 more lines of setup

  await plugin.verifyConditions(config, context);
  // ... assertions
});
```

### After (with utilities):

```typescript
it("should work with only environment variables", async () => {
  const scopes = mockJiraFullWorkflow({
    serverUrl: jiraServerUrl,
    username: jiraUsername,
    issues: [
      { key: "PROJ-123", summary: "Test summary" },
      { key: "PROJ-456", summary: "Test summary 2" },
    ],
    includeTransitions: true,
  });

  await plugin.verifyConditions(config, context);
  // ... assertions

  expectAllScopesAreDone(scopes);
});
```

**Result**: 60 lines reduced to ~15 lines (75% reduction)

## Documentation

Each mock utility file will include:

- JSDoc comments explaining purpose and usage
- Example usage in file header
- Type safety with TypeScript interfaces
- Clear parameter documentation

## Testing the Utilities

The mock utilities themselves should be simple enough to not require separate tests. Validation comes from the existing integration tests that use them - if those tests pass, the utilities work correctly.
