# Spec: semantic-release-jira

## ADDED Requirements

### Requirement: Environment Variable Configuration Support

The plugin MUST support configuration via environment variables for all configuration options, providing an alternative to config file-based configuration.

**Rationale**: Enable runtime configuration overrides, secure credential management in CI/CD, and easy per-environment customization without modifying config files.

#### Scenario: Configure plugin entirely via environment variables

**Given** no configuration is provided in the semantic-release config file
**And** all required environment variables are set:

- `SEMANTIC_RELEASE_JIRA_SERVER_URL=https://company.atlassian.net`
- `SEMANTIC_RELEASE_JIRA_USERNAME=bot@company.com`
- `SEMANTIC_RELEASE_JIRA_API_TOKEN=secret-token`

**When** the plugin runs
**Then** the plugin uses the values from environment variables
**And** no error is thrown about missing configuration

#### Scenario: Environment variables override config file values

**Given** config file contains `jiraServerUrl: "https://old.atlassian.net"`
**And** environment variable is set `SEMANTIC_RELEASE_JIRA_SERVER_URL=https://new.atlassian.net`
**When** the plugin runs
**Then** the plugin uses `https://new.atlassian.net` from the environment variable
**And** the config file value is ignored

#### Scenario: Config file values used when environment variables not set

**Given** config file contains all required configuration
**And** no environment variables are set
**When** the plugin runs
**Then** the plugin uses values from the config file
**And** behavior is identical to before environment variable support

#### Scenario: Mixed configuration from env vars and config file

**Given** config file contains `jiraServerUrl` and behavioral options
**And** environment variables provide credentials:

- `SEMANTIC_RELEASE_JIRA_USERNAME=bot@company.com`
- `SEMANTIC_RELEASE_JIRA_API_TOKEN=secret-token`

**When** the plugin runs
**Then** the plugin uses `jiraServerUrl` from config file
**And** credentials from environment variables
**And** all configuration is properly merged

---

### Requirement: Environment Variable Naming Convention

Environment variables MUST follow a consistent naming pattern with the `SEMANTIC_RELEASE_JIRA_` prefix to avoid collisions.

**Rationale**: Explicit prefix prevents conflicts with other tools and makes it clear these variables are for the semantic-release-jira plugin.

#### Scenario: All environment variables use correct prefix

**Given** the following environment variables are set:

- `SEMANTIC_RELEASE_JIRA_SERVER_URL`
- `SEMANTIC_RELEASE_JIRA_USERNAME`
- `SEMANTIC_RELEASE_JIRA_API_TOKEN`
- (and 11 other options)

**When** the plugin loads configuration
**Then** all 14 environment variables are recognized
**And** variables without the prefix are ignored

#### Scenario: Environment variable names match config option pattern

**Given** config option `jiraServerUrl` (camelCase)
**Then** corresponding environment variable is `SEMANTIC_RELEASE_JIRA_SERVER_URL` (SCREAMING_SNAKE_CASE)

**Given** config option `transitionToStatus` (camelCase)
**Then** corresponding environment variable is `SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS` (SCREAMING_SNAKE_CASE)

---

### Requirement: Type-Safe Environment Variable Parsing

Environment variables MUST be parsed with type safety using envalid, with automatic validation and clear error messages for invalid values.

**Rationale**: Environment variables are strings by default. Type-safe parsing prevents runtime errors and provides clear feedback when values are incorrectly formatted.

#### Scenario: String environment variables are used as-is

**Given** `SEMANTIC_RELEASE_JIRA_SERVER_URL=https://company.atlassian.net`
**When** the plugin loads configuration
**Then** `jiraServerUrl` is set to `"https://company.atlassian.net"` (string)

#### Scenario: Boolean environment variables accept strict values

**Given** `SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES=true`
**When** the plugin loads configuration
**Then** `transitionIssues` is set to `true` (boolean)

**Given** `SEMANTIC_RELEASE_JIRA_DRY_RUN=false`
**When** the plugin loads configuration
**Then** `dryRun` is set to `false` (boolean)

**Given** `SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS=1`
**When** the plugin loads configuration
**Then** `createVersions` is set to `true` (boolean)

**Given** `SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR=0`
**When** the plugin loads configuration
**Then** `failOnJiraError` is set to `false` (boolean)

#### Scenario: Boolean environment variables reject ambiguous values

**Given** `SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES=yes`
**When** the plugin loads configuration
**Then** envalid throws an error with message containing:

- "Invalid environment variable SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES"
- "Must be a boolean (true, false, 1, 0)"

**Given** `SEMANTIC_RELEASE_JIRA_DRY_RUN=TRUE`
**When** the plugin loads configuration
**Then** envalid throws an error (case-sensitive, must be lowercase 'true')

#### Scenario: Numeric environment variables parse integers

**Given** `SEMANTIC_RELEASE_JIRA_CONCURRENCY=5`
**When** the plugin loads configuration
**Then** `concurrency` is set to `5` (number)

**Given** `SEMANTIC_RELEASE_JIRA_TIMEOUT=30000`
**When** the plugin loads configuration
**Then** `timeout` is set to `30000` (number)

#### Scenario: Numeric environment variables reject non-numeric values

**Given** `SEMANTIC_RELEASE_JIRA_CONCURRENCY=abc`
**When** the plugin loads configuration
**Then** envalid throws an error with message containing:

- "Invalid environment variable SEMANTIC_RELEASE_JIRA_CONCURRENCY"
- "Must be a number"

**Given** `SEMANTIC_RELEASE_JIRA_RETRIES=3.5`
**When** the plugin loads configuration
**Then** envalid parses as `3` (integer, decimal truncated)

---

### Requirement: Complete Environment Variable Coverage

All 14 configuration options MUST be available as environment variables, maintaining feature parity with file-based configuration.

**Rationale**: Partial support would require mixing config sources unnecessarily. Complete coverage provides maximum flexibility.

#### Scenario: All string options have environment variables

**Given** the following environment variables are set:

- `SEMANTIC_RELEASE_JIRA_SERVER_URL`
- `SEMANTIC_RELEASE_JIRA_USERNAME`
- `SEMANTIC_RELEASE_JIRA_API_TOKEN`
- `SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS`
- `SEMANTIC_RELEASE_JIRA_VERSION_PREFIX`
- `SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN`

**When** the plugin loads configuration
**Then** all 6 string options are correctly set from environment variables

#### Scenario: All boolean options have environment variables

**Given** the following environment variables are set:

- `SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES`
- `SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS`
- `SEMANTIC_RELEASE_JIRA_DRY_RUN`
- `SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR`
- `SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED`

**When** the plugin loads configuration
**Then** all 5 boolean options are correctly parsed and set

#### Scenario: All numeric options have environment variables

**Given** the following environment variables are set:

- `SEMANTIC_RELEASE_JIRA_CONCURRENCY`
- `SEMANTIC_RELEASE_JIRA_TIMEOUT`
- `SEMANTIC_RELEASE_JIRA_RETRIES`
- `SEMANTIC_RELEASE_JIRA_RETRY_DELAY`

**When** the plugin loads configuration
**Then** all 4 numeric options are correctly parsed as integers

---

### Requirement: Enhanced Error Messages for Missing Configuration

Error messages MUST inform users that configuration can be provided via both config file and environment variables.

**Rationale**: Users may not be aware of environment variable support. Clear error messages guide them to the solution.

#### Scenario: Missing required jiraServerUrl mentions both options

**Given** no `jiraServerUrl` in config file
**And** no `SEMANTIC_RELEASE_JIRA_SERVER_URL` environment variable
**When** the plugin runs
**Then** an error is thrown with message containing:

- "Missing required configuration: jiraServerUrl"
- "You can provide it via:"
- "Config file: { \"jiraServerUrl\": \"https://...\" }"
- "Environment variable: SEMANTIC_RELEASE_JIRA_SERVER_URL=https://..."

#### Scenario: Missing credentials mentions both options

**Given** `transitionIssues` is enabled
**And** no credentials in config file
**And** no credential environment variables set
**When** the plugin runs
**Then** an error is thrown with message containing:

- "Jira credentials are required"
- "Config file: { \"jiraUsername\": \"...\", \"jiraApiToken\": \"...\" }"
- "Environment variables:"
- "SEMANTIC_RELEASE_JIRA_USERNAME=..."
- "SEMANTIC_RELEASE_JIRA_API_TOKEN=..."

---

### Requirement: Backward Compatibility

Existing configurations MUST continue to work without changes. Environment variable support is purely additive.

**Rationale**: Zero breaking changes ensures smooth adoption. Users can opt-in to environment variables when ready.

#### Scenario: Existing config-only setup works identically

**Given** a config file with all required configuration
**And** no environment variables set
**And** existing test suite with 362+ tests
**When** the plugin runs
**Then** all tests pass
**And** plugin behavior is identical to before environment variable support

#### Scenario: No performance regression

**Given** configuration is loaded via config file only
**When** the plugin runs
**Then** configuration validation time is negligible (< 5ms)
**And** no measurable performance impact vs. previous version

---

### Requirement: Credential Security in Logs

Environment variables containing credentials MUST be sanitized in logs and error messages.

**Rationale**: Environment variables may contain sensitive credentials. The existing pino-noir sanitization must work with env-loaded config.

#### Scenario: Environment variable credentials are redacted in logs

**Given** credentials are provided via environment variables:

- `SEMANTIC_RELEASE_JIRA_API_TOKEN=secret-token`

**And** structured logging is enabled
**When** configuration is logged
**Then** `jiraApiToken` value is redacted as `[REDACTED]`
**And** only presence is logged: `hasApiToken: true`

#### Scenario: Envalid validation errors don't leak credentials

**Given** `SEMANTIC_RELEASE_JIRA_API_TOKEN` has an invalid format
**When** envalid validates the environment variables
**Then** any error message does NOT contain the actual token value
**And** error message indicates which variable is invalid

---

## Environment Variable Reference

Complete mapping of config options to environment variables:

| Config Option        | Environment Variable                         | Type    | Example                         |
| -------------------- | -------------------------------------------- | ------- | ------------------------------- |
| `jiraServerUrl`      | `SEMANTIC_RELEASE_JIRA_SERVER_URL`           | string  | `https://company.atlassian.net` |
| `jiraUsername`       | `SEMANTIC_RELEASE_JIRA_USERNAME`             | string  | `user@example.com`              |
| `jiraApiToken`       | `SEMANTIC_RELEASE_JIRA_API_TOKEN`            | string  | `xxxx-yyyy-zzzz`                |
| `transitionIssues`   | `SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES`    | boolean | `true`                          |
| `createVersions`     | `SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS`      | boolean | `false`                         |
| `transitionToStatus` | `SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS` | string  | `Done`                          |
| `versionPrefix`      | `SEMANTIC_RELEASE_JIRA_VERSION_PREFIX`       | string  | `my-service`                    |
| `customIssuePattern` | `SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN` | string  | `[A-Z]+-\\d+`                   |
| `dryRun`             | `SEMANTIC_RELEASE_JIRA_DRY_RUN`              | boolean | `true`                          |
| `failOnJiraError`    | `SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR`   | boolean | `false`                         |
| `concurrency`        | `SEMANTIC_RELEASE_JIRA_CONCURRENCY`          | number  | `5`                             |
| `timeout`            | `SEMANTIC_RELEASE_JIRA_TIMEOUT`              | number  | `30000`                         |
| `retries`            | `SEMANTIC_RELEASE_JIRA_RETRIES`              | number  | `3`                             |
| `retryDelay`         | `SEMANTIC_RELEASE_JIRA_RETRY_DELAY`          | number  | `1000`                          |
| `rejectUnauthorized` | `SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED`  | boolean | `true`                          |
