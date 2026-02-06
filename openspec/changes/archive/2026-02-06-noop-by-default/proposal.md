## Why

Currently, when the plugin is present in a semantic-release configuration, it immediately validates configuration and requires `jiraServerUrl` to be set. This means users cannot add the plugin to their config without providing configuration, even if they want it to be disabled by default. The plugin should be a no-op by default, only activating when the user explicitly provides configuration or environment variables.

## What Changes

- Add "enabled" check that detects if user has provided any configuration
- Skip all plugin operations (validation, API calls, release note generation) when no configuration is detected
- Plugin silently passes through when no config/env vars are set
- Existing behavior preserved when any config option or environment variable is provided

## Capabilities

### New Capabilities

- `noop-detection`: Detect when plugin should be a no-op based on absence of user configuration

### Modified Capabilities

- `semantic-release-jira`: Modify plugin initialization to check for enablement before validating config

## Impact

- **src/index.ts**: Add enablement check at the start of each lifecycle hook
- **src/config/validate.ts**: Add function to detect if any config was provided
- **User Experience**: Users can include the plugin in shared configs without needing to configure it per-project
