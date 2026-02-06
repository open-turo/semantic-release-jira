# Change: Implement Jira Integration for Semantic Release

## Why

Automatically link releases to Jira issues, streamline release management, and provide visibility into what issues are resolved in each release. This bridges the gap between code releases and project management in Jira.

## What Changes

- **Issue Collection**: Parse commits using conventional-commits-parser to extract Jira issue references
- **Branch Parsing**: Extract Jira issue IDs from branch names (format: `PROJECT-123`)
- **GitHub PR Integration**: Inspect merged PR descriptions for Jira issue references using GitHub SDK
- **Release Notes Enhancement**: Add dedicated section linking all Jira issues fixed in the release
- **Jira Ticket Transitions**: Mark tickets as "Done" when configured (find closest matching transition)
- **Jira Version Management**: Create versions in Jira and associate issues with releases (repository name as prefix)
- **Configuration**: Support for Jira server URL, authentication, and feature toggles
- **Conditional Execution**: Jira write operations only on default branch releases (not prereleases)

## Impact

- **Affected specs**: `semantic-release-jira` (new capability)
- **Affected code**:
  - `src/index.ts` - Main plugin entry point
  - `src/config/` - Configuration parsing and validation
  - `src/parsers/` - Issue extraction from commits, branches, PRs
  - `src/jira/` - Jira API client and operations
  - `src/github/` - GitHub SDK integration
  - `src/release-notes/` - Release notes formatting
- **External dependencies**:
  - `conventional-commits-parser` - Parse commit messages
  - `@octokit/rest` - GitHub API integration
  - Jira REST API client (e.g., `jira-client` or `axios`)
- **Configuration requirements**: New plugin configuration block in `.releaserc.json`
