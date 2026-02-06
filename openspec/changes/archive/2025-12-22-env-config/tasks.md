# Tasks: Environment Variable Configuration Support

## Task 1: Install Envalid and Create Environment Schema (CRITICAL)

**Priority**: CRITICAL
**Estimate**: 1 hour
**Dependencies**: None

**Work Items**:

1. Install envalid dependency:

   ```bash
   npm install envalid@^8.0.0
   ```

2. Add envalid schema in `src/config/validate.ts`:

   ```typescript
   import { cleanEnv, str, bool, num } from "envalid";

   const envSchema = {
     // String values
     SEMANTIC_RELEASE_JIRA_SERVER_URL: str({ default: undefined }),
     SEMANTIC_RELEASE_JIRA_USERNAME: str({ default: undefined }),
     SEMANTIC_RELEASE_JIRA_API_TOKEN: str({ default: undefined }),
     SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS: str({ default: undefined }),
     SEMANTIC_RELEASE_JIRA_VERSION_PREFIX: str({ default: undefined }),
     SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN: str({ default: undefined }),

     // Boolean values (accepts 'true', 'false', '1', '0')
     SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES: bool({ default: undefined }),
     SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS: bool({ default: undefined }),
     SEMANTIC_RELEASE_JIRA_DRY_RUN: bool({ default: undefined }),
     SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR: bool({ default: undefined }),
     SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED: bool({ default: undefined }),

     // Numeric values
     SEMANTIC_RELEASE_JIRA_CONCURRENCY: num({ default: undefined }),
     SEMANTIC_RELEASE_JIRA_TIMEOUT: num({ default: undefined }),
     SEMANTIC_RELEASE_JIRA_RETRIES: num({ default: undefined }),
     SEMANTIC_RELEASE_JIRA_RETRY_DELAY: num({ default: undefined }),
   };
   ```

3. Add `loadConfigFromEnvironment()` function:

   ```typescript
   function loadConfigFromEnvironment(): Partial<PluginConfig> {
     const env = cleanEnv(process.env, envSchema, {
       reporter: ({ errors }) => {
         if (Object.keys(errors).length > 0) {
           throw new Error(
             `Invalid environment variables:\n${Object.entries(errors)
               .map(([key, err]) => `  ${key}: ${err}`)
               .join("\n")}`,
           );
         }
       },
     });

     // Map to PluginConfig format (only defined values)
     const config: Partial<PluginConfig> = {};
     if (env.SEMANTIC_RELEASE_JIRA_SERVER_URL) {
       config.jiraServerUrl = env.SEMANTIC_RELEASE_JIRA_SERVER_URL;
     }
     // ... map all 14 options

     return config;
   }
   ```

**Validation**:

- Envalid correctly parses all 14 environment variables
- Boolean parsing accepts 'true', 'false', '1', '0'
- Boolean parsing rejects 'yes', 'no', 'TRUE', etc. with clear error
- Number parsing accepts integers only
- Number parsing rejects non-numeric values with clear error
- Returns empty config when no env vars are set

---

## Task 2: Integrate Environment Variables into Validation (CRITICAL)

**Priority**: CRITICAL
**Estimate**: 30 minutes
**Dependencies**: Task 1

**Work Items**:

1. Update `validateConfig()` function in `src/config/validate.ts`:

   ```typescript
   export function validateConfig(
     config: Partial<PluginConfig>,
   ): ValidatedPluginConfig {
     // 1. Load and validate environment variables (envalid throws on invalid values)
     const envConfig = loadConfigFromEnvironment();

     // 2. Merge: env vars override config file
     const mergedConfig = {
       ...config,
       ...envConfig, // Only defined env vars override
     };

     // 3. Continue with existing validation
     validateRequiredFields(mergedConfig);
     validateTransitionConfig(mergedConfig);
     validateNumericFields(mergedConfig);
     validateBooleanFields(mergedConfig);
     validateCustomPattern(mergedConfig);
     validateCredentials(mergedConfig);

     // 4. Return validated config with defaults
     return {
       // ... existing return logic
     };
   }
   ```

2. Test that envConfig only includes defined values (envalid returns undefined for unset vars)
3. Verify all defaults are still applied correctly after merging

**Validation**:

- Environment variables override config file values
- Config file values used when env vars not set
- Defaults applied when both missing
- All existing validation tests still pass
- Envalid validation errors are clear and actionable

---

## Task 3: Enhance Error Messages for Missing Configuration (MEDIUM)

**Priority**: MEDIUM
**Estimate**: 15 minutes
**Dependencies**: Task 2

**Work Items**:

1. Update error message for missing `jiraServerUrl` in `validateRequiredFields()`:

   ```typescript
   if (!config.jiraServerUrl) {
     throw new Error(
       `Missing required configuration: jiraServerUrl\n\n` +
         `You can provide it via:\n` +
         `- Config file: { "jiraServerUrl": "https://..." }\n` +
         `- Environment variable: SEMANTIC_RELEASE_JIRA_SERVER_URL=https://...`,
     );
   }
   ```

2. Update credentials error message in `validateCredentials()`:
   ```typescript
   if (
     (config.transitionIssues || config.createVersions) &&
     (!config.jiraUsername || !config.jiraApiToken)
   ) {
     throw new Error(
       `Jira credentials are required when transitionIssues or createVersions is enabled\n\n` +
         `You can provide them via:\n` +
         `- Config file: { "jiraUsername": "...", "jiraApiToken": "..." }\n` +
         `- Environment variables:\n` +
         `  SEMANTIC_RELEASE_JIRA_USERNAME=...\n` +
         `  SEMANTIC_RELEASE_JIRA_API_TOKEN=...`,
     );
   }
   ```

**Note**: Envalid automatically provides clear error messages for invalid env var values (wrong type, invalid format). We only enhance messages for missing required fields.

**Validation**:

- Error messages mention both config file and env var options
- Error messages include examples
- Envalid's built-in errors are not overridden (they're already good)

---

## Task 4: Add Comprehensive Unit Tests (CRITICAL)

**Priority**: CRITICAL
**Estimate**: 1.5 hours
**Dependencies**: Tasks 1, 2

**Work Items**:

1. Add tests to `test/config/validate.test.ts` for environment variable support:
   - **String env vars**: All 6 string options override config file values
   - **Boolean env vars**: All 5 boolean options work with 'true', 'false', '1', '0'
   - **Numeric env vars**: All 4 numeric options parse integers correctly
   - **Invalid values**: Envalid throws on 'yes', 'no', 'abc', etc.
   - **Precedence**: Env var overrides config file value
   - **Fallback**: Config file used when env var not set
   - **Defaults**: Applied when both missing
   - **Mixed config**: Env vars + config file + defaults all work together

2. Test specific scenarios:
   - All config from env vars (no config file)
   - All config from file (no env vars)
   - Mixed: credentials from env, behavior from config
   - Missing required `jiraServerUrl`: error mentions both config and env var
   - Missing credentials when needed: error mentions both options

3. Test envalid validation errors:
   - Boolean with 'yes' → clear error from envalid
   - Number with 'abc' → clear error from envalid
   - Verify error messages are user-friendly

**Validation**:

- 100% code coverage of `loadConfigFromEnvironment()` and merging logic
- All existing tests still pass (backward compatibility)
- New tests cover all 14 env vars
- Error message tests verify helpful hints

---

## Task 5: Update README Documentation (HIGH)

**Priority**: HIGH
**Estimate**: 1 hour
**Dependencies**: Tasks 1-4 (implementation complete)

**Work Items**:

1. Add new section "Environment Variable Configuration" after configuration table
2. Add complete env var mapping table (14 rows)
3. Add "Common Use Cases" subsection with examples:
   - Credentials in CI/CD
   - Per-environment behavior (staging vs production)
   - Shared config with runtime overrides
4. Add "Boolean Values" note explaining strict 'true'/'false' parsing
5. Add "Precedence" note explaining env vars override config

**Example Structure**:

```markdown
### Environment Variable Configuration

All configuration options can be provided via environment variables...

#### Available Environment Variables

| Environment Variable | Config Option | Type | Example |
| -------------------- | ------------- | ---- | ------- |

| ... (complete table) ...

#### Common Use Cases

**Credentials in CI/CD**:
...examples...

**Per-Environment Behavior**:
...examples...

**Shared Configuration with Overrides**:
...examples...

#### Boolean Values

Boolean environment variables must be set to exactly 'true' or 'false'...

#### Precedence

When both config file and environment variable are present...
```

**Validation**:

- Documentation is complete and accurate
- All 14 env vars are documented
- Examples are runnable and correct
- Precedence rules are clear

---

## Task 6: Add Integration Tests (MEDIUM)

**Priority**: MEDIUM
**Estimate**: 1 hour
**Dependencies**: Tasks 1-4

**Work Items**:

1. Add integration tests in `test/integration/env-config.test.ts`:
   - Plugin works with only env vars (no config file)
   - Plugin works with mixed env vars and config
   - Env vars override config in real plugin execution
   - Credentials from env vars work end-to-end

2. Test realistic scenarios:
   - Base config with credential override
   - Shared config with behavior override (`dryRun`, `transitionIssues`)
   - All-env-var configuration

**Validation**:

- Integration tests pass
- Real-world scenarios are covered
- Plugin behavior is correct in all cases

---

## Task 7: Verify Backward Compatibility (HIGH)

**Priority**: HIGH
**Estimate**: 30 minutes
**Dependencies**: All above tasks

**Work Items**:

1. Run full test suite: `npm test`
2. Verify all 362+ existing tests still pass
3. Verify no behavior changes for existing users (no env vars set)
4. Test with real semantic-release config files:
   - `.releaserc.json` example
   - `.releaserc.js` example
   - `package.json` example

**Validation**:

- All existing tests pass
- No breaking changes
- Performance is unchanged
- Existing configurations work identically

---

## Task 8: Security Audit (HIGH)

**Priority**: HIGH
**Estimate**: 15 minutes
**Dependencies**: All above tasks

**Work Items**:

1. Verify credential sanitization still works:
   - Environment variable values are sanitized in logs
   - Pino-noir redacts `jiraApiToken` from env
   - Structured logger handles env-loaded credentials

2. Review logging to ensure no env vars are exposed:
   - Search for any `console.log(envConfig)` or similar
   - Verify only presence (boolean) is logged, not values

3. Test error messages don't leak values:
   - Boolean parsing error doesn't show `jiraApiToken` value
   - Number parsing error doesn't show sensitive strings

**Validation**:

- No credential leakage in logs
- Error messages are safe
- Sanitization works with env vars

---

## Task Ordering and Parallelization

**Sequential Work** (must be done in order):

1. Task 1 (install envalid and create schema)
2. Task 2 (integration into validation)
3. Task 3 (enhance error messages)
4. Tasks 4, 5, 6, 7 (can be done in parallel after 1-3)
5. Task 8 (final security audit)

**Critical Path**: Tasks 1 → 2 → 4 → 7 (implementation and validation)

**Estimated Total Time**: ~6 hours

- Reduced from 7-8 hours by using envalid (less custom code to write and test)

---

## Definition of Done

Each task is considered complete when:

1. Implementation is correct and tested
2. Unit tests pass for new code
3. Integration tests pass for scenarios
4. Documentation is updated (if applicable)
5. No regressions in existing tests

The entire change is complete when:

1. All 8 tasks are marked done
2. Envalid v8.x is installed and integrated
3. All 14 config options work via environment variables
4. Environment variables override config file values
5. Envalid validation provides clear, helpful error messages
6. 100% test coverage of new code
7. README includes complete env var documentation
8. All existing tests pass (backward compatibility)
9. Security audit shows no credential leakage

---

## Success Metrics

**Before**:

- Config options: File only
- Runtime overrides: Not possible
- Credential management: Manual env var expansion
- Shared configs: Difficult to customize

**After**:

- Config options: File + env vars ✅
- Runtime overrides: Possible via env vars ✅
- Credential management: Native env var support ✅
- Shared configs: Easy customization ✅
- Documentation: Complete env var reference ✅
- Backward compatibility: 100% ✅
