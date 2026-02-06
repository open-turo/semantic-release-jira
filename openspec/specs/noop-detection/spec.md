# noop-detection Specification

## Purpose

Defines the behavior for detecting when the semantic-release-jira plugin should be disabled (no-op mode). This allows the plugin to be included in shared configurations without requiring per-project setup.

## Requirements

### Requirement: Plugin is disabled when no configuration is provided

The plugin SHALL be completely inactive (no-op) when the user has not provided any configuration via plugin options or environment variables. This allows the plugin to be included in shared configurations without requiring per-project setup.

#### Scenario: No configuration provided at all

- **WHEN** the plugin is included in semantic-release configuration
- **AND** no plugin options are provided (empty object `{}`)
- **AND** no `SEMANTIC_RELEASE_JIRA_*` environment variables are set
- **THEN** the plugin SHALL skip all operations silently
- **AND** the plugin SHALL NOT throw any errors
- **AND** the plugin SHALL NOT validate configuration
- **AND** semantic-release SHALL continue to the next plugin

#### Scenario: Only plugin name in configuration

- **WHEN** the plugin is referenced as `"@open-turo/semantic-release-jira"` (string, no options)
- **AND** no `SEMANTIC_RELEASE_JIRA_*` environment variables are set
- **THEN** the plugin SHALL be disabled
- **AND** all lifecycle hooks SHALL return early without action

---

### Requirement: Plugin enables when any configuration is detected

The plugin SHALL activate and perform full validation when ANY configuration is detected, either via plugin options or environment variables.

#### Scenario: Plugin config object has properties

- **WHEN** the plugin is configured with any non-empty property
- **THEN** the plugin SHALL be enabled
- **AND** the plugin SHALL perform full configuration validation

**Example**:

```javascript
// This enables the plugin
[
  "@open-turo/semantic-release-jira",
  { jiraServerUrl: "https://jira.example.com" },
];
```

#### Scenario: Environment variable is set

- **WHEN** any `SEMANTIC_RELEASE_JIRA_*` environment variable is set
- **AND** no plugin config options are provided
- **THEN** the plugin SHALL be enabled
- **AND** the plugin SHALL perform full configuration validation using environment variables

**Example**:

```bash
# This enables the plugin even with empty config object
SEMANTIC_RELEASE_JIRA_SERVER_URL=https://jira.example.com
```

#### Scenario: Mixed configuration sources

- **WHEN** some options are provided via plugin config
- **AND** additional options are provided via environment variables
- **THEN** the plugin SHALL be enabled
- **AND** environment variables SHALL override config file values (existing behavior)

---

### Requirement: Enablement detection checks specific environment variables

The plugin SHALL only consider environment variables with the `SEMANTIC_RELEASE_JIRA_` prefix when determining enablement status.

#### Scenario: Only prefixed variables count

- **WHEN** checking for environment variable configuration
- **THEN** the plugin SHALL check for these variables:
  - `SEMANTIC_RELEASE_JIRA_SERVER_URL`
  - `SEMANTIC_RELEASE_JIRA_USERNAME`
  - `SEMANTIC_RELEASE_JIRA_API_TOKEN`
  - `SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES`
  - `SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS`
  - `SEMANTIC_RELEASE_JIRA_DRY_RUN`
  - `SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR`
  - `SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED`
  - `SEMANTIC_RELEASE_JIRA_CONCURRENCY`
  - `SEMANTIC_RELEASE_JIRA_TIMEOUT`
  - `SEMANTIC_RELEASE_JIRA_RETRIES`
  - `SEMANTIC_RELEASE_JIRA_RETRY_DELAY`
  - `SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS`
  - `SEMANTIC_RELEASE_JIRA_VERSION_PREFIX`
  - `SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN`

#### Scenario: Unrelated environment variables ignored

- **WHEN** environment variables like `JIRA_URL` or `NODE_ENV` are set
- **AND** no `SEMANTIC_RELEASE_JIRA_*` variables are set
- **AND** no plugin config options are provided
- **THEN** the plugin SHALL remain disabled
- **AND** the plugin SHALL NOT attempt to use these variables

---

### Requirement: Informational logging when plugin is disabled

The plugin SHALL log a single informational message when it detects no configuration and disables itself.

#### Scenario: Log message on skip

- **WHEN** the plugin determines it should be disabled
- **THEN** the plugin SHALL log: "No configuration detected, plugin disabled"
- **AND** the log SHALL be at info level
- **AND** only one log message SHALL be emitted per lifecycle hook

#### Scenario: No logging noise when disabled

- **WHEN** the plugin is disabled
- **THEN** the plugin SHALL NOT log configuration validation messages
- **AND** the plugin SHALL NOT log Jira connection attempts
- **AND** the plugin SHALL NOT log any warnings or errors
