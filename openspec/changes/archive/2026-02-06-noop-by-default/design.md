## Context

The semantic-release-jira plugin currently requires configuration to be present when it's included in a semantic-release configuration. Specifically, `jiraServerUrl` is a required field, and the plugin validates this immediately in `verifyConditions`. This prevents users from:

1. Including the plugin in shared/base configurations without per-project setup
2. Having the plugin available but disabled by default
3. Enabling the plugin via environment variables only when needed (e.g., in CI)

The current validation flow in `src/config/validate.ts` uses Zod schemas that enforce `jiraServerUrl` as required, throwing an error if not provided.

## Goals / Non-Goals

**Goals:**

- Plugin is completely silent (no-op) when no configuration is provided
- Plugin activates when ANY config option or environment variable is set
- Zero breaking changes for existing users with configuration
- Clear logging when plugin is skipped due to no configuration

**Non-Goals:**

- Adding an explicit `enabled: true/false` config option (detection-based approach preferred)
- Changing the validation logic for when config IS provided
- Supporting partial configuration (if any config is provided, full validation applies)

## Decisions

### Decision 1: Detection-based enablement over explicit flag

**Choice**: Detect configuration presence rather than requiring explicit `enabled: true`

**Rationale**:

- Users who want the plugin active already provide config - no change needed
- Users who want it disabled don't need to add `enabled: false` - just omit config
- Environment variable `SEMANTIC_RELEASE_JIRA_ENABLED=true` would be redundant with other env vars

**Alternatives considered**:

- Explicit `enabled` flag: Adds configuration overhead, requires users to set two things (enabled + config)
- Check only `jiraServerUrl`: Other env vars like credentials could indicate intent to use plugin

### Decision 2: Check both plugin config and environment variables

**Choice**: Plugin is enabled if ANY of these are true:

1. Any non-empty property in `pluginConfig` object
2. Any `SEMANTIC_RELEASE_JIRA_*` environment variable is set

**Rationale**:

- Config file users: presence of any config property indicates intent
- Environment-only users: presence of any env var indicates intent
- Supports pure env-var configuration (common in CI/CD)

### Decision 3: Early return in lifecycle hooks

**Choice**: Add enablement check at the start of each exported function (`verifyConditions`, `analyzeCommits`, `generateNotes`, `success`)

**Rationale**:

- Minimal code change
- Each hook independently checks, making behavior predictable
- No shared state needed for enablement status

### Decision 4: Silent skip with optional debug logging

**Choice**: When disabled, log a single debug message and return early without error

**Rationale**:

- Users who haven't configured the plugin don't want noise in their logs
- Debug logging available for troubleshooting
- No error thrown means semantic-release continues normally

## Risks / Trade-offs

**[Risk: User confusion]** → User might not realize plugin is inactive

- Mitigation: Log once at info level: "semantic-release-jira: No configuration detected, plugin disabled"

**[Risk: Accidental activation]** → Setting any env var activates plugin

- Mitigation: Only check `SEMANTIC_RELEASE_JIRA_*` prefixed variables, not general env vars
- Mitigation: Document activation rules clearly

**[Risk: Partial config edge cases]** → User sets one option but forgets required ones

- Mitigation: Once enabled, full validation applies - clear error messages guide user
