# Usage Examples

This document provides detailed usage examples for the `@open-turo/semantic-release-jira` plugin.

## Table of Contents

- [Basic Setup](#basic-setup)
- [Configuration Examples](#configuration-examples)
- [Commit Message Examples](#commit-message-examples)
- [Branch Naming Examples](#branch-naming-examples)
- [Pull Request Examples](#pull-request-examples)
- [Workflow Examples](#workflow-examples)

## Basic Setup

### Step 1: Install the Plugin

```bash
npm install --save-dev @open-turo/semantic-release-jira
```

### Step 2: Create Jira API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name (e.g., "Semantic Release")
4. Copy the token

### Step 3: Configure GitHub Secrets

Add secrets to your GitHub repository:

- `JIRA_USERNAME`: Your Atlassian account email
- `JIRA_API_TOKEN`: The token from Step 2

### Step 4: Add Plugin to semantic-release

Choose one of the configuration examples below.

## Configuration Examples

### Example 1: Read-Only Mode (No Jira Updates)

Use this when you only want Jira links in release notes without modifying Jira.

**`.releaserc.json`**:

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://mycompany.atlassian.net"
      }
    ],
    "@semantic-release/github"
  ]
}
```

**What it does**:

- ✅ Collects Jira issues from commits, branches, PRs
- ✅ Adds Jira section to release notes
- ❌ Does NOT transition issues
- ❌ Does NOT create versions

### Example 2: Transition Issues Only

Use this to automatically close issues on release without creating versions.

**`.releaserc.json`**:

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://mycompany.atlassian.net",
        "jiraUsername": "${JIRA_USERNAME}",
        "jiraApiToken": "${JIRA_API_TOKEN}",
        "transitionIssues": true
      }
    ],
    "@semantic-release/github"
  ]
}
```

**What it does**:

- ✅ Collects Jira issues
- ✅ Adds Jira section to release notes
- ✅ Transitions issues to "Done"
- ❌ Does NOT create versions

### Example 3: Version Management Only

Use this to create Jira versions without transitioning issues.

**`.releaserc.json`**:

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://mycompany.atlassian.net",
        "jiraUsername": "${JIRA_USERNAME}",
        "jiraApiToken": "${JIRA_API_TOKEN}",
        "createVersions": true,
        "versionPrefix": "MyApp"
      }
    ],
    "@semantic-release/github"
  ]
}
```

**What it does**:

- ✅ Collects Jira issues
- ✅ Adds Jira section to release notes
- ✅ Creates Jira versions (named "MyApp-v1.2.3")
- ✅ Associates issues with versions
- ❌ Does NOT transition issues

### Example 4: Full Automation

Use this for complete Jira integration.

**`.releaserc.json`**:

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://mycompany.atlassian.net",
        "jiraUsername": "${JIRA_USERNAME}",
        "jiraApiToken": "${JIRA_API_TOKEN}",
        "transitionIssues": true,
        "createVersions": true,
        "transitionToStatus": "Done",
        "versionPrefix": "my-service"
      }
    ],
    "@semantic-release/npm",
    "@semantic-release/github"
  ]
}
```

**What it does**:

- ✅ Collects Jira issues
- ✅ Adds Jira section to release notes
- ✅ Transitions issues to "Done"
- ✅ Creates Jira versions
- ✅ Associates issues with versions

## Commit Message Examples

### Standard Conventional Commit

```
feat(auth): add OAuth2 authentication

Implement OAuth2 flow for third-party authentication.

Closes PROJECT-123
```

**Result**: `PROJECT-123` will be collected

### Multiple Issues

```
fix(api): resolve timeout and retry issues

- Fix connection timeout
- Add retry logic with exponential backoff

Fixes PROJECT-456, PROJECT-457
Resolves TEAM-789
```

**Result**: `PROJECT-456`, `PROJECT-457`, and `TEAM-789` will be collected

### Issue in Subject Line

```
feat(ui): implement user dashboard PROJECT-100
```

**Result**: `PROJECT-100` will be collected

### No Issue Reference

```
docs: update API documentation
```

**Result**: No issues collected (documentation changes don't need Jira tracking)

## Branch Naming Examples

### Feature Branch with Issue

```bash
git checkout -b feature/PROJECT-123-add-oauth
```

**Result**: `PROJECT-123` will be collected from branch name

### Bug Fix Branch

```bash
git checkout -b bugfix/TEAM-555-fix-memory-leak
```

**Result**: `TEAM-555` will be collected

### Multiple Words After Issue

```bash
git checkout -b feature/PROJECT-789-implement-user-authentication-and-authorization
```

**Result**: `PROJECT-789` will be collected

### Branch Without Issue

```bash
git checkout -b refactor/improve-code-quality
```

**Result**: No issues collected from branch (will look in commits instead)

## Pull Request Examples

### PR Description with Multiple Issues

```markdown
## Description

Implement complete user authentication system with OAuth2 support

## Changes

- Add OAuth2 client configuration
- Implement token refresh logic
- Add user session management

## Related Issues

Closes PROJECT-123
Fixes PROJECT-456
Resolves TEAM-789
```

**Result**: All three issues will be collected

### PR Description with GitHub Keywords

```markdown
## Summary

Fix critical memory leak in background worker

Fixes #42
Closes PROJECT-999
```

**Result**: `PROJECT-999` will be collected (GitHub issue #42 is ignored)

### PR Template Example

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Description

<!-- Describe your changes -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Jira Issues

<!-- List related Jira issues -->

Closes PROJECT-XXX

## Testing

<!-- Describe testing performed -->
```

## Workflow Examples

### Scenario 1: Feature Development

1. **Create branch from Jira**:

   ```bash
   git checkout -b feature/PROJECT-123-user-auth
   ```

2. **Make commits with conventional format**:

   ```bash
   git commit -m "feat(auth): add login endpoint PROJECT-123"
   git commit -m "feat(auth): add registration endpoint PROJECT-123"
   ```

3. **Create PR** with description:

   ```markdown
   Implements user authentication system

   Closes PROJECT-123
   ```

4. **Merge to main** → Release triggers

5. **Plugin collects** `PROJECT-123` from:
   - Branch name ✓
   - Both commits ✓
   - PR description ✓

6. **Release notes include**:

   ```markdown
   ## Jira Issues

   ### PROJECT

   - [PROJECT-123](https://company.atlassian.net/browse/PROJECT-123)
   ```

7. **If configured**, issue PROJECT-123 is:
   - Transitioned to "Done"
   - Associated with version "my-service-v1.2.0"

### Scenario 2: Hotfix

1. **Create hotfix branch**:

   ```bash
   git checkout -b hotfix/PROJECT-999-critical-bug
   ```

2. **Fix and commit**:

   ```bash
   git commit -m "fix(api): resolve null pointer exception

   Emergency fix for production issue.

   Fixes PROJECT-999"
   ```

3. **Create PR and merge** → Release triggers

4. **Plugin processes**:
   - Collects PROJECT-999
   - Adds to release notes
   - Transitions to Done (if enabled)

### Scenario 3: Multiple Projects

Working with multiple Jira projects:

```bash
# Feature spans multiple teams
git commit -m "feat(integration): connect services

Implements cross-service communication.

Closes BACKEND-100, FRONTEND-200, DEVOPS-300"
```

**Release notes**:

```markdown
## Jira Issues

### BACKEND

- [BACKEND-100](https://company.atlassian.net/browse/BACKEND-100)

### DEVOPS

- [DEVOPS-300](https://company.atlassian.net/browse/DEVOPS-300)

### FRONTEND

- [FRONTEND-200](https://company.atlassian.net/browse/FRONTEND-200)
```

**Versions created** (if enabled):

- Version "my-service-v1.3.0" in project BACKEND (with BACKEND-100)
- Version "my-service-v1.3.0" in project FRONTEND (with FRONTEND-200)
- Version "my-service-v1.3.0" in project DEVOPS (with DEVOPS-300)

### Scenario 4: Prerelease (Beta)

1. **Create prerelease branch**:

   ```bash
   git checkout -b beta
   git commit -m "feat: new experimental feature PROJECT-500"
   git push
   ```

2. **semantic-release creates**: `v1.0.0-beta.1`

3. **Plugin behavior**:
   - ✅ Collects PROJECT-500
   - ✅ Adds to release notes
   - ❌ Does NOT transition issue
   - ❌ Does NOT create version
   - **Reason**: Prereleases don't trigger Jira writes

4. **When merged to main** → Full release `v1.0.0`:
   - ✅ NOW transitions PROJECT-500
   - ✅ NOW creates version

## Advanced Examples

### Custom Issue Pattern

If your organization uses a different pattern:

```json
{
  "plugins": [
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://mycompany.atlassian.net",
        "customIssuePattern": "TICKET-[0-9]{4,6}"
      }
    ]
  ]
}
```

Matches: `TICKET-1234`, `TICKET-123456`

### Custom Transition Status

If your workflow uses different status names:

```json
{
  "plugins": [
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://mycompany.atlassian.net",
        "jiraUsername": "${JIRA_USERNAME}",
        "jiraApiToken": "${JIRA_API_TOKEN}",
        "transitionIssues": true,
        "transitionToStatus": "Completed"
      }
    ]
  ]
}
```

### Monorepo Setup

For multiple packages in a monorepo:

```json
{
  "plugins": [
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://mycompany.atlassian.net",
        "jiraUsername": "${JIRA_USERNAME}",
        "jiraApiToken": "${JIRA_API_TOKEN}",
        "createVersions": true,
        "versionPrefix": "monorepo-${name}"
      }
    ]
  ]
}
```

**Result**: Versions named like `monorepo-package-a-v1.2.3`

## Troubleshooting Tips

### Issue Not Appearing in Release Notes

**Check**:

1. Issue format matches pattern (default: `PROJECT-123`)
2. Issue is referenced in commits, branch, or PR description
3. Plugin is listed in `.releaserc.json`

### Transition Not Working

**Check**:

1. `transitionIssues: true` in config
2. Credentials are correct
3. User has "Edit Issues" permission
4. Status "Done" exists in workflow (or configure custom status)
5. Release is on default branch (not prerelease)

### Version Not Created

**Check**:

1. `createVersions: true` in config
2. Credentials are correct
3. User has version management permissions
4. Release is on default branch (not prerelease)

### PRs Not Being Parsed

**Check**:

1. Running in GitHub Actions (has `GITHUB_TOKEN`)
2. Commits are associated with merged PRs
3. PR descriptions contain issue references
