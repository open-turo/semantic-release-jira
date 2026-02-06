# Semantic Release Jira Plugin Specification

## ADDED Requirements

### Requirement: Plugin Configuration

The plugin SHALL accept configuration options for Jira integration and feature toggles.

#### Scenario: Minimal configuration with read-only mode

- **WHEN** user provides only `jiraServerUrl` in plugin configuration
- **THEN** the plugin SHALL operate in read-only mode
- **AND** issue collection SHALL work
- **AND** release notes generation SHALL include Jira links
- **AND** Jira write operations SHALL be skipped

#### Scenario: Full configuration with write operations

- **WHEN** user provides `jiraServerUrl`, `jiraUsername`, `jiraApiToken`, `transitionIssues: true`, and `createVersions: true`
- **THEN** the plugin SHALL enable all features
- **AND** issues SHALL be transitioned to done
- **AND** Jira versions SHALL be created

#### Scenario: Invalid configuration

- **WHEN** `transitionIssues` or `createVersions` is true but credentials are missing
- **THEN** the plugin SHALL fail in `verifyConditions` hook
- **AND** an error message SHALL explain the missing credentials

### Requirement: Issue Collection from Commits

The plugin SHALL extract Jira issue references from commit messages in the release.

#### Scenario: Standard conventional commit with issue

- **WHEN** commit message is "fix(api): resolve timeout issue\n\nCloses PROJECT-123"
- **THEN** issue "PROJECT-123" SHALL be collected

#### Scenario: Multiple issues in commit

- **WHEN** commit message contains "PROJECT-123" and "PROJECT-456"
- **THEN** both issues SHALL be collected

#### Scenario: No issues in commit

- **WHEN** commit message contains no Jira issue references
- **THEN** no issues SHALL be collected from that commit

### Requirement: Issue Collection from Branch Name

The plugin SHALL extract Jira issue references from the git branch name.

#### Scenario: Feature branch with issue

- **WHEN** release is created from branch "feature/PROJECT-789-add-login"
- **THEN** issue "PROJECT-789" SHALL be collected

#### Scenario: Branch without issue

- **WHEN** branch name is "main" or "develop"
- **THEN** no issues SHALL be collected from branch name

### Requirement: Issue Collection from GitHub PRs

The plugin SHALL extract Jira issue references from merged pull request descriptions.

#### Scenario: PR description with issue

- **WHEN** running on GitHub
- **AND** commit is associated with a merged PR
- **AND** PR description contains "Fixes PROJECT-555"
- **THEN** issue "PROJECT-555" SHALL be collected

#### Scenario: Multiple PRs for release

- **WHEN** release contains commits from multiple merged PRs
- **THEN** all PRs SHALL be analyzed
- **AND** issues from all PR descriptions SHALL be collected

#### Scenario: Not running on GitHub

- **WHEN** plugin is not running in GitHub environment
- **THEN** PR parsing SHALL be skipped
- **AND** no error SHALL be thrown

### Requirement: Issue Deduplication

The plugin SHALL deduplicate collected issues across all sources.

#### Scenario: Same issue from multiple sources

- **WHEN** issue "PROJECT-100" appears in commit message, branch name, and PR description
- **THEN** issue "PROJECT-100" SHALL appear exactly once in final collection

### Requirement: Issue Pattern Matching

The plugin SHALL recognize standard Jira issue format using pattern `[A-Z][A-Z0-9]+-\d+`.

#### Scenario: Valid issue references

- **WHEN** text contains "PROJECT-123", "TEAM-456", "BUG-789"
- **THEN** all SHALL be recognized as valid Jira issues

#### Scenario: Invalid patterns

- **WHEN** text contains "project-123" (lowercase), "PR-123-extra", "123-PROJECT"
- **THEN** none SHALL be collected as Jira issues

#### Scenario: Custom pattern configuration

- **WHEN** user provides `customIssuePattern` in configuration
- **THEN** the custom pattern SHALL be used instead of default

### Requirement: Release Notes Generation

The plugin SHALL add a Jira Issues section to release notes with links to collected issues.

#### Scenario: Issues found for release

- **WHEN** release collects issues "PROJECT-1", "PROJECT-2", "TEAM-3"
- **THEN** release notes SHALL contain a "Jira Issues" section
- **AND** section SHALL include links to `{jiraServerUrl}/browse/PROJECT-1`, etc.
- **AND** issues SHALL be grouped by project key

#### Scenario: No issues found

- **WHEN** no Jira issues are collected for release
- **THEN** no Jira section SHALL be added to release notes

#### Scenario: Release notes formatting

- **WHEN** generating release notes with Jira issues
- **THEN** format SHALL be markdown with clickable links
- **AND** projects SHALL be sorted alphabetically
- **AND** issues within each project SHALL be sorted by number

### Requirement: Jira Issue Transition

The plugin SHALL transition collected issues to "Done" status when configured and conditions are met.

#### Scenario: Transition enabled on default branch

- **WHEN** `transitionIssues` is true
- **AND** Jira credentials are provided
- **AND** release is on default branch
- **AND** release is not a prerelease
- **THEN** each collected issue SHALL be transitioned

#### Scenario: Transition disabled by configuration

- **WHEN** `transitionIssues` is false or not set
- **THEN** no issues SHALL be transitioned

#### Scenario: Transition skipped for prerelease

- **WHEN** `transitionIssues` is true
- **AND** release is a prerelease (e.g., "1.0.0-beta.1")
- **THEN** no issues SHALL be transitioned

#### Scenario: Transition skipped for non-default branch

- **WHEN** `transitionIssues` is true
- **AND** release is from branch other than default
- **THEN** no issues SHALL be transitioned

### Requirement: Jira Transition Discovery

The plugin SHALL automatically find the appropriate "Done" transition for each issue.

#### Scenario: Exact match for transition

- **WHEN** user configures `transitionToStatus: "Completed"`
- **AND** issue has transition named "Completed"
- **THEN** that transition SHALL be used

#### Scenario: Fuzzy match for transition

- **WHEN** `transitionToStatus` is not configured
- **AND** issue has transitions including "Done", "Closed", "In Review"
- **THEN** plugin SHALL use transition matching "done" (case-insensitive)

#### Scenario: No matching transition found

- **WHEN** issue has no transition matching done/closed/completed/resolved
- **THEN** plugin SHALL log a warning
- **AND** skip transitioning that issue
- **AND** continue with other issues

### Requirement: Jira Version Creation

The plugin SHALL create versions in Jira and associate issues when configured.

#### Scenario: Create version for release

- **WHEN** `createVersions` is true
- **AND** release is on default branch
- **AND** release is not a prerelease
- **THEN** for each project found in collected issues
- **AND** a version SHALL be created named "{repoName}-v{version}"

#### Scenario: Associate issues with version

- **WHEN** Jira version is created
- **THEN** all issues from that project SHALL be associated with the version

#### Scenario: Version already exists

- **WHEN** version with same name already exists in Jira
- **THEN** plugin SHALL use existing version
- **AND** associate issues with it
- **AND** no error SHALL be thrown

#### Scenario: Version creation disabled

- **WHEN** `createVersions` is false or not set
- **THEN** no versions SHALL be created

### Requirement: Version Prefix Configuration

The plugin SHALL support custom version name prefixes.

#### Scenario: Default version prefix

- **WHEN** `versionPrefix` is not configured
- **THEN** repository name SHALL be used as prefix

#### Scenario: Custom version prefix

- **WHEN** `versionPrefix` is set to "MyService"
- **AND** release version is "1.2.3"
- **THEN** Jira version name SHALL be "MyService-v1.2.3"

### Requirement: Error Handling for Jira Operations

The plugin SHALL handle Jira API failures gracefully without blocking releases.

#### Scenario: Jira server unreachable

- **WHEN** Jira API calls fail due to network error
- **THEN** plugin SHALL log error
- **AND** continue with release process
- **AND** release SHALL not fail

#### Scenario: Authentication failure

- **WHEN** Jira credentials are invalid
- **THEN** plugin SHALL fail in `verifyConditions` hook
- **AND** provide clear error message about authentication

#### Scenario: Issue not found in Jira

- **WHEN** collected issue does not exist in Jira
- **THEN** plugin SHALL log warning
- **AND** skip that issue
- **AND** continue with other issues

#### Scenario: Insufficient permissions

- **WHEN** Jira user lacks permissions to transition issues or create versions
- **THEN** plugin SHALL log error for affected operations
- **AND** continue with other operations

### Requirement: Error Handling for GitHub Operations

The plugin SHALL handle GitHub API failures gracefully.

#### Scenario: GitHub API rate limit

- **WHEN** GitHub API rate limit is exceeded
- **THEN** plugin SHALL log warning
- **AND** skip PR parsing
- **AND** continue with commit and branch parsing

#### Scenario: PR not found

- **WHEN** commit SHA does not have associated PR
- **THEN** plugin SHALL skip that commit for PR parsing
- **AND** no error SHALL be logged

### Requirement: Logging and Observability

The plugin SHALL provide clear logging for all operations.

#### Scenario: Issue collection logging

- **WHEN** issues are collected
- **THEN** plugin SHALL log count and sources
- **AND** log format SHALL be "Collected X Jira issues from commits, branches, PRs"

#### Scenario: Jira operation logging

- **WHEN** transitioning issues or creating versions
- **THEN** plugin SHALL log each operation
- **AND** log success or failure with issue key

#### Scenario: Configuration validation logging

- **WHEN** configuration is validated
- **THEN** plugin SHALL log enabled features
- **AND** warn about disabled features if credentials missing

### Requirement: Semantic Release Lifecycle Integration

The plugin SHALL integrate with semantic-release lifecycle hooks.

#### Scenario: verifyConditions hook

- **WHEN** `verifyConditions` hook is called
- **THEN** plugin SHALL validate configuration
- **AND** verify Jira credentials if provided
- **AND** fail fast if configuration is invalid

#### Scenario: analyzeCommits hook

- **WHEN** `analyzeCommits` hook is called
- **THEN** plugin SHALL collect issues from commits, branches, and PRs
- **AND** store issues in plugin context

#### Scenario: generateNotes hook

- **WHEN** `generateNotes` hook is called
- **THEN** plugin SHALL generate Jira section for release notes
- **AND** return formatted markdown

#### Scenario: success hook

- **WHEN** `success` hook is called
- **AND** release succeeds
- **THEN** plugin SHALL execute Jira write operations
- **AND** respect conditional execution rules

### Requirement: Environment Detection

The plugin SHALL detect the execution environment to enable appropriate features.

#### Scenario: GitHub Actions environment

- **WHEN** running in GitHub Actions (GITHUB_ACTIONS=true)
- **THEN** plugin SHALL enable GitHub PR parsing
- **AND** use GITHUB_TOKEN for authentication

#### Scenario: Local development environment

- **WHEN** not running in CI environment
- **THEN** plugin SHALL skip PR parsing
- **AND** log info message about GitHub features being unavailable

#### Scenario: Default branch detection

- **WHEN** determining if on default branch
- **THEN** plugin SHALL use semantic-release context
- **AND** compare current branch with main branch from context
