# Design Document: Jira Integration for Semantic Release

## Context

Semantic-release automates version management and package publishing. This plugin extends it to provide bidirectional integration with Jira, enabling automatic issue tracking and release management synchronization.

**Constraints:**

- Must work as a semantic-release plugin following their plugin API
- Must handle GitHub Actions environment and local development
- Must degrade gracefully when Jira/GitHub are unavailable
- Must respect semantic-release's event-driven architecture

**Stakeholders:**

- Development teams using semantic-release with Jira
- Release managers tracking issue resolution
- Jira administrators managing versions

## Goals / Non-Goals

### Goals

- Automatically collect Jira issues from commits, branches, and PRs
- Add Jira issue links to release notes
- Optionally transition Jira issues to "Done" on release
- Optionally create Jira versions and associate issues
- Provide clear configuration with sensible defaults
- Fail gracefully without blocking releases

### Non-Goals

- Full Jira workflow automation (only transitions to done)
- Complex Jira query language support
- Issue creation or modification beyond status/version
- Support for non-GitHub VCS platforms (in v1)
- Custom issue reference formats beyond standard PROJECT-123

## Decisions

### 1. Plugin Architecture

**Decision:** Implement as semantic-release plugin with lifecycle hooks

**Hooks:**

- `verifyConditions`: Validate configuration and credentials
- `analyzeCommits`: Collect issues from commits/branches/PRs
- `generateNotes`: Inject Jira section into release notes
- `success`: Update Jira (transitions + versions)

**Rationale:** Follows semantic-release patterns, enables proper integration

### 2. Issue Reference Parsing

**Decision:** Use regex pattern `[A-Z][A-Z0-9]+-\d+` for Jira issue matching

**Sources:**

1. Commit messages (via conventional-commits-parser)
2. Branch names (git reference)
3. PR descriptions (GitHub API)

**Rationale:** Standard Jira issue format, widely recognized

### 3. Configuration Structure

**Decision:** JSON/YAML configuration in `.releaserc`

```typescript
interface PluginConfig {
  // Required
  jiraServerUrl: string;

  // Optional - Jira write operations
  jiraUsername?: string;
  jiraApiToken?: string;

  // Feature flags
  transitionIssues?: boolean; // Default: false
  createVersions?: boolean; // Default: false

  // Advanced options
  transitionToStatus?: string; // Default: auto-detect "Done"
  versionPrefix?: string; // Default: repo name
  customIssuePattern?: string; // Default: standard Jira pattern
}
```

**Rationale:** Clear structure, optional auth for read-only mode

### 4. Jira API Client

**Decision:** Use axios with custom wrapper, not third-party Jira SDK

**Reasons:**

- Minimize dependencies
- Full control over API calls
- Better error handling
- Simpler mocking in tests

**API Calls Needed:**

- `GET /rest/api/2/issue/{issueKey}` - Verify issue exists
- `GET /rest/api/2/issue/{issueKey}/transitions` - Get available transitions
- `POST /rest/api/2/issue/{issueKey}/transitions` - Transition issue
- `POST /rest/api/2/project/{projectKey}/version` - Create version
- `PUT /rest/api/2/issue/{issueKey}` - Update issue with version

### 5. GitHub Integration

**Decision:** Use `@octokit/rest` for GitHub API calls

**Approach:**

1. Get repository info from environment/git config
2. For each commit in release, find associated PR via commit SHA
3. Parse PR description for Jira references
4. Use GitHub token from environment (GITHUB_TOKEN)

**Rationale:** Official SDK, well-maintained, handles auth

### 6. Transition Matching Algorithm

**Decision:** Fuzzy match transition name to find "Done"

**Algorithm:**

1. Fetch all available transitions for issue
2. Look for exact match with configured status name
3. If not found, fuzzy match against: "done", "closed", "completed", "resolved"
4. Use first match or log warning

**Rationale:** Jira workflows vary, fuzzy matching increases compatibility

### 7. Version Naming Convention

**Decision:** `{repoName}-{version}` (e.g., `my-service-v1.2.3`)

**Rationale:**

- Clearly identifies source repository
- Prevents version conflicts in shared Jira projects
- Follows common practice

### 8. Error Handling Strategy

**Decision:** Never block release on Jira/GitHub failures

**Approach:**

- Jira API failures: Log error, continue
- GitHub API failures: Log warning, skip PR parsing
- Invalid configuration: Fail in `verifyConditions` hook

**Rationale:** Release process should not depend on external services

### 9. Testing Strategy

**Decision:** Three-layer testing approach

1. **Unit tests**: Individual parsers and utilities (Vitest)
2. **Integration tests**: Mocked API responses
3. **Manual tests**: Real Jira/GitHub instances

**Mocking:**

- Use `nock` for HTTP mocking
- Mock semantic-release context
- Fixture-based test data

### 10. Conditional Execution Logic

**Decision:** Check branch and release type in `success` hook

```typescript
function shouldUpdateJira(context: Context): boolean {
  const isDefaultBranch = context.branch.name === context.branch.main;
  const isPrerelease = context.nextRelease.type === "prerelease";

  return isDefaultBranch && !isPrerelease;
}
```

**Rationale:** Prevents duplicate updates, respects prerelease semantics

## Risks / Trade-offs

### Risk: Jira Rate Limiting

**Mitigation:**

- Batch API calls where possible
- Implement exponential backoff
- Make write operations optional

### Risk: Different Jira Workflows

**Mitigation:**

- Fuzzy transition matching
- Allow custom transition name configuration
- Provide clear error messages

### Risk: GitHub API Token Permissions

**Mitigation:**

- Document required scopes (repo:read)
- Graceful fallback if GitHub unavailable
- Clear error messages for permission issues

### Trade-off: Simple vs Flexible Configuration

**Decision:** Start simple, add complexity as needed

Initial: Basic options only
Future: Custom parsers, multiple Jira instances, webhook support

## Migration Plan

### Phase 1: Core Implementation (This Change)

1. Implement all core features
2. Add comprehensive tests
3. Document configuration

### Phase 2: Beta Testing

1. Deploy to internal projects
2. Gather feedback on edge cases
3. Refine transition matching

### Phase 3: Public Release

1. Publish to npm registry
2. Update documentation
3. Monitor for issues

### Rollback

If critical bugs found:

1. Release can proceed without plugin (disable in config)
2. No database migrations to revert
3. Jira changes are additive (safe to leave)

## Open Questions

1. **Multi-project releases**: How to handle issues from different Jira projects?
   - Answer: Group by project, create versions per project

2. **Custom fields**: Should we support updating custom Jira fields?
   - Deferred: Not in v1, evaluate demand

3. **Jira Server vs Cloud**: API differences?
   - Answer: Start with Cloud API v2, document Server compatibility

4. **Issue validation**: Should we verify issues exist before adding to release notes?
   - Answer: Yes, skip invalid issues with warning

5. **Concurrent releases**: How to handle race conditions on version creation?
   - Answer: Check if version exists first, use existing if found
