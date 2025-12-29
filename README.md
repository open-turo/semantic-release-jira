# @open-turo/semantic-release-jira

A [semantic-release](https://github.com/semantic-release/semantic-release) plugin for Jira integration. Automatically link releases to Jira issues, update issue statuses, and create Jira versions.

## Features

- **Automatic Issue Collection**: Extract Jira issue references from:
  - Commit messages (using conventional commits)
  - Branch names (e.g., `feature/PROJECT-123-add-feature`)
  - GitHub Pull Request descriptions
- **Release Notes Enhancement**: Add a dedicated Jira Issues section with clickable links and issue titles
- **Issue Transitions**: Automatically mark issues as "Done" when released (optional)
- **Version Management**: Create Jira versions and associate issues with releases (optional)
- **Smart Execution**: Only updates Jira on default branch releases (skips prereleases)
- **Read-Only Mode**: Works without credentials for release notes generation
- **Graceful Error Handling**: Never blocks releases on Jira API failures

## Installation

```bash
npm install --save-dev @open-turo/semantic-release-jira
```

## Configuration

Add the plugin to your semantic-release configuration (`.releaserc.json`, `.releaserc.js`, or `package.json`).

### Minimal Configuration (Read-Only Mode)

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://your-company.atlassian.net"
      }
    ],
    "@semantic-release/github"
  ]
}
```

In read-only mode, the plugin will:

- Collect Jira issues from commits, branches, and PRs
- Add Jira links to release notes (issue keys only, without titles)
- Skip all Jira write operations

### Full Configuration (Write Mode)

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://your-company.atlassian.net",
        "jiraUsername": "user@example.com",
        "jiraApiToken": "${JIRA_API_TOKEN}",
        "transitionIssues": true,
        "createVersions": true,
        "transitionToStatus": "Done",
        "versionPrefix": "my-service"
      }
    ],
    "@semantic-release/github"
  ]
}
```

When credentials are provided (`jiraUsername` and `jiraApiToken`), the plugin will:

- **Fetch issue titles**: Automatically retrieves issue summaries from Jira and includes them in release notes
  - Example: `- [PROJECT-123](url): Implement user authentication` instead of just `- [PROJECT-123](url)`
- **Enable write operations**: Can transition issues and create versions (if configured)
- **Graceful degradation**: If fetching a title fails, the issue link is still included without the title

### Configuration Options

| Option               | Type      | Required | Default              | Description                                                                        |
| -------------------- | --------- | -------- | -------------------- | ---------------------------------------------------------------------------------- |
| `jiraServerUrl`      | `string`  | Yes      | -                    | Your Jira server URL (e.g., `https://company.atlassian.net`)                       |
| `jiraUsername`       | `string`  | No       | -                    | Jira username or email for authentication                                          |
| `jiraApiToken`       | `string`  | No       | -                    | Jira API token for authentication                                                  |
| `transitionIssues`   | `boolean` | No       | `false`              | Whether to transition issues to "Done" status                                      |
| `createVersions`     | `boolean` | No       | `false`              | Whether to create Jira versions for releases                                       |
| `transitionToStatus` | `string`  | No       | Auto-detect          | Custom status name for issue transitions (will fuzzy match "done", "closed", etc.) |
| `versionPrefix`      | `string`  | No       | Repository name      | Custom prefix for Jira version names                                               |
| `customIssuePattern` | `string`  | No       | `[A-Z][A-Z0-9]+-\d+` | Custom regex pattern for matching Jira issues (see Pattern Safety below)           |

#### Pattern Safety (ReDoS Protection)

When using `customIssuePattern`, the plugin validates patterns to prevent ReDoS (Regular Expression Denial of Service) attacks. Patterns with catastrophic backtracking are rejected to protect your CI/CD pipeline from CPU exhaustion.

**Unsafe Patterns** (will be rejected):

```javascript
// Nested quantifiers - causes exponential time complexity
"(a+)+b"; // O(2^n) time complexity
"(x*)*y"; // Can hang on long strings
"([a-zA-Z]+)*"; // Catastrophic backtracking

// Multiple nested groups
"(.*)*(.*)*"; // Extremely dangerous
"((a+)+)+"; // Deeply nested quantifiers
```

**Safe Patterns** (recommended):

```javascript
"[A-Z][A-Z0-9]+-\\d+"; // Default pattern - character classes with single quantifiers
"[A-Z]{2,5}-\\d{1,4}"; // Bounded quantifiers are safe
"(PROJECT|TEAM)-\\d+"; // Simple alternation without quantifiers
"[A-Z]+\\d+"; // Single-level quantifiers are fine
```

**Error Message:**

If you provide an unsafe pattern, you'll see:

```
customIssuePattern may cause ReDoS (Regular Expression Denial of Service): (a+)+b.
This pattern could hang the release process due to catastrophic backtracking.
Avoid nested quantifiers like (a+)+, (a*)*, or (a|a)*.
Use simpler patterns without complex alternations or nested repetitions.
For help, see: https://github.com/substack/safe-regex#readme
```

**Tips for Safe Patterns:**

1. Use character classes `[A-Z]+` instead of groups `(A|B|C)+`
2. Use bounded quantifiers `{2,5}` instead of unbounded `*` or `+`
3. Avoid nesting quantified groups `(a+)+` or `(a*)*`
4. Test patterns with [regex101.com](https://regex101.com) and check for exponential steps

### Environment Variable Configuration

All configuration options can be provided via environment variables with the `SEMANTIC_RELEASE_JIRA_` prefix. Environment variables take precedence over config file values, enabling easy per-environment customization and secure credential management.

#### Available Environment Variables

| Environment Variable                         | Config Option        | Type    | Example                         |
| -------------------------------------------- | -------------------- | ------- | ------------------------------- |
| `SEMANTIC_RELEASE_JIRA_SERVER_URL`           | `jiraServerUrl`      | string  | `https://company.atlassian.net` |
| `SEMANTIC_RELEASE_JIRA_USERNAME`             | `jiraUsername`       | string  | `user@example.com`              |
| `SEMANTIC_RELEASE_JIRA_API_TOKEN`            | `jiraApiToken`       | string  | `xxxx-yyyy-zzzz`                |
| `SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES`    | `transitionIssues`   | boolean | `true`                          |
| `SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS`      | `createVersions`     | boolean | `false`                         |
| `SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS` | `transitionToStatus` | string  | `Done`                          |
| `SEMANTIC_RELEASE_JIRA_VERSION_PREFIX`       | `versionPrefix`      | string  | `my-service`                    |
| `SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN` | `customIssuePattern` | string  | `[A-Z]+-\\d+`                   |
| `SEMANTIC_RELEASE_JIRA_DRY_RUN`              | `dryRun`             | boolean | `true`                          |
| `SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR`   | `failOnJiraError`    | boolean | `false`                         |
| `SEMANTIC_RELEASE_JIRA_CONCURRENCY`          | `concurrency`        | number  | `5`                             |
| `SEMANTIC_RELEASE_JIRA_TIMEOUT`              | `timeout`            | number  | `30000`                         |
| `SEMANTIC_RELEASE_JIRA_RETRIES`              | `retries`            | number  | `3`                             |
| `SEMANTIC_RELEASE_JIRA_RETRY_DELAY`          | `retryDelay`         | number  | `1000`                          |
| `SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED`  | `rejectUnauthorized` | boolean | `true`                          |

#### Common Use Cases

**Credentials in CI/CD**:

```bash
export SEMANTIC_RELEASE_JIRA_SERVER_URL=https://company.atlassian.net
export SEMANTIC_RELEASE_JIRA_USERNAME=bot@company.com
export SEMANTIC_RELEASE_JIRA_API_TOKEN=$JIRA_TOKEN
npx semantic-release
```

**Per-Environment Behavior**:

```bash
# Staging: dry run mode
export SEMANTIC_RELEASE_JIRA_SERVER_URL=https://company.atlassian.net
export SEMANTIC_RELEASE_JIRA_DRY_RUN=true

# Production: full write mode
export SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES=true
export SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS=true
```

**Shared Configuration with Runtime Overrides**:

```json
// .releaserc.json (shared base config)
{
  "plugins": [
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://company.atlassian.net",
        "transitionIssues": false
      }
    ]
  ]
}
```

```bash
# Override at runtime for production deployment
export SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES=true
export SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS=true
export SEMANTIC_RELEASE_JIRA_USERNAME=prod-bot@company.com
export SEMANTIC_RELEASE_JIRA_API_TOKEN=$PROD_JIRA_TOKEN
npx semantic-release
```

#### Boolean Values

Boolean environment variables accept:

- `true` or `1` → `true`
- `false` or `0` → `false`

Other values (e.g., `yes`, `no`, `TRUE`) will cause a validation error.

#### Configuration Precedence

When both config file and environment variable are present, environment variables take precedence:

1. **Environment variables** (highest priority)
2. **Config file values**
3. **Default values** (lowest priority)

This allows you to maintain a base configuration in your config file while overriding specific values at runtime via environment variables.

### GitHub Actions Setup

```yaml
name: Release
on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
```

## Usage

### Issue Reference Formats

The plugin recognizes standard Jira issue format: `PROJECT-123`

**In Commit Messages:**

```
feat(api): add user authentication

Implements login and registration endpoints.

Closes PROJECT-123, PROJECT-456
```

**In Branch Names:**

```
feature/PROJECT-789-add-login
bugfix/TEAM-555-fix-timeout
```

**In Pull Request Descriptions:**

```markdown
## Description

Add user authentication feature

## Related Issues

- Fixes PROJECT-123
- Resolves PROJECT-456
```

### Release Notes Output

The plugin adds a Jira Issues section to your release notes:

```markdown
## Jira Issues

### PROJECT

- [PROJECT-123](https://your-company.atlassian.net/browse/PROJECT-123)
- [PROJECT-456](https://your-company.atlassian.net/browse/PROJECT-456)

### TEAM

- [TEAM-789](https://your-company.atlassian.net/browse/TEAM-789)
```

## How It Works

### Lifecycle Hooks

The plugin integrates with semantic-release through these lifecycle hooks:

1. **`verifyConditions`**: Validates configuration and tests Jira credentials
2. **`analyzeCommits`**: Collects Jira issues from all sources
3. **`generateNotes`**: Adds Jira section to release notes
4. **`success`**: Updates Jira (transitions and versions)

### Conditional Execution

Jira write operations (transitions and versions) only execute when:

- Running on the default branch (e.g., `main`)
- Release is NOT a prerelease (e.g., not `1.0.0-beta.1`)
- Credentials are provided

This ensures prereleases and feature branch releases don't trigger Jira updates.

### Transition Matching

When `transitionIssues` is enabled, the plugin:

1. Fetches available transitions for each issue
2. Looks for exact match with `transitionToStatus` (if configured)
3. Falls back to fuzzy matching: "done", "closed", "completed", "resolved"
4. Uses first match or logs warning if not found

### Version Naming

Jira versions are created with format: `{prefix}-v{version}`

Examples:

- Default: `my-repo-v1.2.3`
- Custom prefix: `MyService-v1.2.3`

## Jira Permissions

The Jira user needs these permissions:

- **Read-Only Mode**: Browse Projects
- **With Transitions**: Edit Issues
- **With Versions**: Administer Projects (or version management permissions)

## Troubleshooting

### Authentication Fails

**Error**: `Jira authentication failed`

**Solution**:

1. Generate an API token: https://id.atlassian.com/manage-profile/security/api-tokens
2. Verify username is your Atlassian account email
3. Check Jira server URL is correct

### Issues Not Found

**Warning**: `Issue PROJECT-123 not found in Jira - skipping`

**Causes**:

- Issue doesn't exist or was deleted
- User lacks permissions to view issue
- Wrong Jira server URL

### Transitions Not Working

**Warning**: `Could not find matching transition for issue PROJECT-123`

**Solution**:

1. Check issue workflow in Jira
2. Verify "Done" status exists
3. Configure custom status: `"transitionToStatus": "Completed"`

### PRs Not Being Parsed

**Info**: `Not running in GitHub environment - skipping PR parsing`

**Cause**: Plugin only parses PRs when running in GitHub Actions

**Solution**: Ensure `GITHUB_TOKEN` is set and you're running in GitHub Actions

### Custom Pattern Rejected (ReDoS Protection)

**Error**: `customIssuePattern may cause ReDoS`

**Cause**: Pattern contains nested quantifiers that could cause catastrophic backtracking

**Solution**:

1. Simplify your pattern - avoid nested quantifiers like `(a+)+` or `(x*)*`
2. Use character classes `[A-Z]+` instead of grouped alternatives `(A|B|C)+`
3. Use bounded quantifiers `{2,5}` instead of unbounded `*` or `+`
4. Test your pattern at [regex101.com](https://regex101.com) to check performance
5. See the Pattern Safety section above for examples

## Examples

### Example 1: Read-Only Mode

Perfect for adding Jira links to release notes without modifying Jira:

```json
{
  "plugins": [
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://company.atlassian.net"
      }
    ]
  ]
}
```

### Example 2: Transition Issues Only

Update issue statuses but don't create versions:

```json
{
  "plugins": [
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://company.atlassian.net",
        "jiraUsername": "${JIRA_USERNAME}",
        "jiraApiToken": "${JIRA_API_TOKEN}",
        "transitionIssues": true
      }
    ]
  ]
}
```

### Example 3: Full Version Management

Create versions and transition issues:

```json
{
  "plugins": [
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://company.atlassian.net",
        "jiraUsername": "${JIRA_USERNAME}",
        "jiraApiToken": "${JIRA_API_TOKEN}",
        "transitionIssues": true,
        "createVersions": true,
        "versionPrefix": "MyApp"
      }
    ]
  ]
}
```

### Example 4: Custom Issue Pattern

Use custom Jira issue format (with safety validation):

```json
{
  "plugins": [
    [
      "@open-turo/semantic-release-jira",
      {
        "jiraServerUrl": "https://company.atlassian.net",
        "customIssuePattern": "[A-Z]{3,5}-[0-9]+"
      }
    ]
  ]
}
```

## Development

### Setup

```bash
npm install
npm run build
```

### Testing

```bash
npm test                 # Run tests once
npm run test:watch       # Watch mode
npm run check-types      # Type checking
npm run lint             # Lint code
```

### Pre-commit Hooks

This project uses pre-commit hooks to ensure code quality:

- JSON/YAML validation
- Prettier formatting
- ESLint with auto-fix
- Commitlint validation

## Contributing

Contributions are welcome! Please follow the existing code style and add tests for new features.

## License

MIT

## Credits

Developed by Turo Engineering
