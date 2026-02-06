## 1. Configuration Detection

- [x] 1.1 Add `isPluginEnabled` function in `src/config/validate.ts` that checks if any plugin config properties are set
- [x] 1.2 Add `hasEnvironmentVariables` function in `src/config/validate.ts` that checks if any `SEMANTIC_RELEASE_JIRA_*` env vars are set
- [x] 1.3 Export combined `isConfigurationProvided` function that returns true if either config or env vars are present

## 2. Plugin Lifecycle Integration

- [x] 2.1 Add enablement check at start of `verifyConditions` - return early if no configuration detected
- [x] 2.2 Add enablement check at start of `analyzeCommits` - return early if no configuration detected
- [x] 2.3 Add enablement check at start of `generateNotes` - return empty string if no configuration detected
- [x] 2.4 Add enablement check at start of `success` - return early if no configuration detected

## 3. Logging

- [x] 3.1 Add info-level log message "No configuration detected, plugin disabled" when plugin is skipped

## 4. Testing

- [x] 4.1 Add unit tests for `isPluginEnabled` function with various config scenarios
- [x] 4.2 Add unit tests for `hasEnvironmentVariables` function
- [x] 4.3 Add integration tests for plugin being disabled when no config provided
- [x] 4.4 Add integration tests for plugin being enabled when env vars are set
- [x] 4.5 Add integration tests for plugin being enabled when config options are set
