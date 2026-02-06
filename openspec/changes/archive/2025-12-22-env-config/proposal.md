# Change: Support Environment Variable Configuration

## Why

Currently, the plugin requires all configuration to be specified in the semantic-release configuration file (`.releaserc.json`, `.releaserc.js`, or `package.json`). This creates several problems:

1. **Inflexible Deployment**: Configuration cannot be changed at runtime without modifying config files, making it difficult to deploy the same codebase across multiple environments (dev, staging, production).

2. **Credential Management**: Sensitive values like `jiraApiToken` must be either:
   - Hardcoded in config files (insecure)
   - Manually expanded from environment variables in JavaScript config files (requires custom code)
   - This is cumbersome and error-prone

3. **Shared Configuration Sets**: In organizations using shared semantic-release configurations, consumers cannot easily override plugin behavior for their specific needs without duplicating the entire configuration.

4. **CI/CD Limitations**: Different CI/CD environments may need different settings (e.g., `dryRun` in staging, write mode in production) but currently require separate config files or complex conditional logic.

## What Changes

### Support All Configuration Options via Environment Variables

Enable all 14 configuration options to be specified via environment variables with the `SEMANTIC_RELEASE_JIRA_` prefix:

**String Options**:

- `SEMANTIC_RELEASE_JIRA_SERVER_URL` → `jiraServerUrl`
- `SEMANTIC_RELEASE_JIRA_USERNAME` → `jiraUsername`
- `SEMANTIC_RELEASE_JIRA_API_TOKEN` → `jiraApiToken`
- `SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS` → `transitionToStatus`
- `SEMANTIC_RELEASE_JIRA_VERSION_PREFIX` → `versionPrefix`
- `SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN` → `customIssuePattern`

**Boolean Options** (strict 'true'/'false' parsing):

- `SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES` → `transitionIssues`
- `SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS` → `createVersions`
- `SEMANTIC_RELEASE_JIRA_DRY_RUN` → `dryRun`
- `SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR` → `failOnJiraError`
- `SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED` → `rejectUnauthorized`

**Numeric Options** (integer parsing):

- `SEMANTIC_RELEASE_JIRA_CONCURRENCY` → `concurrency`
- `SEMANTIC_RELEASE_JIRA_TIMEOUT` → `timeout`
- `SEMANTIC_RELEASE_JIRA_RETRIES` → `retries`
- `SEMANTIC_RELEASE_JIRA_RETRY_DELAY` → `retryDelay`

### Priority: Environment Variables Always Override Config

When both a config file value and an environment variable are present, the environment variable takes precedence. This allows:

- Base configuration in config files
- Runtime overrides via environment variables
- Easy per-environment customization

**Example**:

```javascript
// .releaserc.json
{
  "plugins": [
    ["@open-turo/semantic-release-jira", {
      "jiraServerUrl": "https://company.atlassian.net",
      "transitionIssues": false  // Default: don't transition
    }]
  ]
}
```

```bash
# Override at runtime
SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES=true \
SEMANTIC_RELEASE_JIRA_API_TOKEN=$JIRA_TOKEN \
npx semantic-release
```

### Implementation Approach

1. **Add environment variable loading** in `src/config/validate.ts`
2. **Merge strategy**: Environment variables → Config file → Defaults
3. **Type-safe parsing**: Validate types for booleans and numbers
4. **Error handling**: Clear error messages for invalid env var values
5. **Documentation**: Update README with all environment variable options

### Update Documentation

Add comprehensive documentation to README.md:

- Table of environment variables
- Examples for common use cases
- Best practices for credential management
- CI/CD configuration examples

## Impact

- **Affected specs**: `semantic-release-jira` (new requirements for env var support)
- **Affected code**:
  - `src/config/validate.ts` - Add env var loading and merging logic
  - `src/types/index.ts` - May need to add types for env var parsing
  - `README.md` - Add environment variable documentation
  - Tests - Add comprehensive tests for env var parsing
- **Breaking changes**: None
  - Existing config file usage continues to work
  - Environment variables are optional
  - Backward compatible with all existing setups

## Non-Goals

- Supporting alternative environment variable prefixes or custom naming
- Loading configuration from `.env` files (users can use dotenv if needed)
- Supporting nested or complex data structures in environment variables
- Changing the existing config file behavior in any way
