## MODIFIED Requirements

### Requirement: Environment Variable Configuration Support

The plugin MUST support configuration via environment variables for all configuration options, providing an alternative to config file-based configuration. **The plugin SHALL only activate when at least one configuration option is provided via config file or environment variable.**

**Rationale**: Enable runtime configuration overrides, secure credential management in CI/CD, and easy per-environment customization without modifying config files. Additionally, allow the plugin to be included in shared configurations without requiring per-project setup.

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

#### Scenario: Plugin disabled when no configuration provided

**Given** no configuration is provided in the semantic-release config file (empty object `{}`)
**And** no `SEMANTIC_RELEASE_JIRA_*` environment variables are set
**When** the plugin runs
**Then** the plugin SHALL be disabled and skip all operations
**And** the plugin SHALL log "No configuration detected, plugin disabled"
**And** no validation errors SHALL be thrown
**And** semantic-release SHALL continue to the next plugin
