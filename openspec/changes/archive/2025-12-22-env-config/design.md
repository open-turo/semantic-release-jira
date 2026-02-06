# Design: Environment Variable Configuration Support

## Architecture Overview

Add environment variable configuration support to the semantic-release-jira plugin by extending the validation layer to load, parse, and merge environment variables with config file values.

**Key Principles**:

1. Environment variables always override config file values
2. All configuration options are available as environment variables
3. Type-safe parsing with clear error messages
4. Zero breaking changes to existing behavior

## Component Design

### 1. Environment Variable Loading

#### Naming Convention

**Prefix**: `SEMANTIC_RELEASE_JIRA_`

**Mapping Rules**:

- camelCase config → SCREAMING_SNAKE_CASE env var
- `jiraServerUrl` → `SEMANTIC_RELEASE_JIRA_SERVER_URL`
- `transitionToStatus` → `SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS`

#### Complete Mapping Table

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

### 2. Type Parsing with Envalid

**Library**: [envalid](https://github.com/af/envalid) v8.x

- TypeScript-first with strong type safety
- Built specifically for env var validation
- Clean, declarative API
- Minimal dependencies
- Actively maintained (latest: July 2025)

#### Why Envalid?

Instead of implementing custom parsing functions, we use envalid because:

- **Battle-tested**: 1.5k+ stars, widely used in production
- **Type-safe**: Automatic TypeScript type inference
- **Fail-fast**: Clear error messages with validation failures
- **Maintainable**: No custom parsing logic to maintain
- **Feature-rich**: Built-in validators for all our needs

#### Envalid Schema Definition

```typescript
import { cleanEnv, str, bool, num } from "envalid";

const envSchema = {
  // String values (optional)
  SEMANTIC_RELEASE_JIRA_SERVER_URL: str({ default: undefined }),
  SEMANTIC_RELEASE_JIRA_USERNAME: str({ default: undefined }),
  SEMANTIC_RELEASE_JIRA_API_TOKEN: str({ default: undefined }),
  SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS: str({ default: undefined }),
  SEMANTIC_RELEASE_JIRA_VERSION_PREFIX: str({ default: undefined }),
  SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN: str({ default: undefined }),

  // Boolean values (strict 'true'/'false' parsing)
  SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES: bool({ default: undefined }),
  SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS: bool({ default: undefined }),
  SEMANTIC_RELEASE_JIRA_DRY_RUN: bool({ default: undefined }),
  SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR: bool({ default: undefined }),
  SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED: bool({ default: undefined }),

  // Numeric values (integer parsing)
  SEMANTIC_RELEASE_JIRA_CONCURRENCY: num({ default: undefined }),
  SEMANTIC_RELEASE_JIRA_TIMEOUT: num({ default: undefined }),
  SEMANTIC_RELEASE_JIRA_RETRIES: num({ default: undefined }),
  SEMANTIC_RELEASE_JIRA_RETRY_DELAY: num({ default: undefined }),
};
```

**Note**: Envalid's `bool()` validator provides strict parsing:

- Only accepts 'true', 'false', '1', '0'
- Rejects 'yes', 'no', 'TRUE', etc.
- Provides clear error messages

### 3. Configuration Merging Strategy

**Precedence Order** (highest to lowest):

1. Environment variables (highest priority)
2. Config file values
3. Default values (lowest priority)

**Implementation**:

```typescript
import { cleanEnv, str, bool, num } from "envalid";

export function loadConfigFromEnvironment(): Partial<PluginConfig> {
  // Validate and parse environment variables
  const env = cleanEnv(process.env, envSchema, {
    // Don't throw on missing env vars - they're optional
    // We'll handle required validation after merging with config
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

  // Map to PluginConfig format
  // Only include defined values (undefined means not set)
  const config: Partial<PluginConfig> = {};

  if (env.SEMANTIC_RELEASE_JIRA_SERVER_URL) {
    config.jiraServerUrl = env.SEMANTIC_RELEASE_JIRA_SERVER_URL;
  }
  if (env.SEMANTIC_RELEASE_JIRA_USERNAME) {
    config.jiraUsername = env.SEMANTIC_RELEASE_JIRA_USERNAME;
  }
  // ... map all 14 options

  return config;
}

export function validatePluginConfig(config: unknown): ValidatedPluginConfig {
  // 1. Load environment variables (with validation)
  const envConfig = loadConfigFromEnvironment();

  // 2. Merge: env vars override config file
  const mergedConfig = {
    ...config,
    ...envConfig, // Only defined env vars override
  };

  // 3. Continue with existing validation logic
  validateRequiredFields(mergedConfig);
  validateCredentials(mergedConfig);
  // ...

  return normalizedConfig;
}
```

### 4. Error Handling

Envalid provides clear error messages out of the box. We enhance them for our use case:

#### Invalid Boolean Value

Envalid automatically provides:

```
EnvError: Invalid environment variable SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES
Must be a boolean (true, false, 1, 0)
```

#### Invalid Number Value

Envalid automatically provides:

```
EnvError: Invalid environment variable SEMANTIC_RELEASE_JIRA_CONCURRENCY
Must be a number
```

#### Still Missing Required Fields

We enhance existing validation to mention env vars:

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

## Trade-offs and Decisions

### Decision 0: Use Envalid vs nconf vs Custom Implementation

**Chosen**: envalid v8.x

**Alternatives Considered**:

1. Custom implementation
   - ❌ Reinventing the wheel
   - ❌ More code to maintain
   - ✅ Full control over behavior

2. nconf
   - ✅ Very actively maintained (April 2025)
   - ✅ Hierarchical multi-source configuration
   - ❌ No built-in type coercion or validation
   - ❌ More complex than needed

3. envalid
   - ✅ TypeScript-first with automatic type inference
   - ✅ Built-in validators and error messages
   - ✅ Simple, declarative API
   - ✅ Specifically designed for env vars
   - ❌ Only handles env vars (not multi-source)

**Rationale**:

- **Type Safety**: Envalid provides automatic TypeScript type inference, reducing bugs
- **Simplicity**: Declarative schema is easier to understand and maintain than imperative config
- **Validation**: Built-in validators (str, bool, num) with clear error messages eliminate custom validation code
- **Focus**: We only need env var parsing, not multi-source configuration management
- **Maintenance**: 1.5k+ stars, actively maintained, battle-tested in production
- **Trade-off**: We handle config file merging ourselves (simple object spread), which is acceptable for our use case

### Decision 1: Explicit Prefix (SEMANTIC*RELEASE_JIRA*)

**Chosen**: `SEMANTIC_RELEASE_JIRA_` prefix

**Alternatives Considered**:

1. `SR_JIRA_` prefix
   - ✅ Shorter, easier to type
   - ❌ Abbreviation is less clear
   - ❌ Could conflict with other tools

2. `JIRA_` prefix only
   - ✅ Shortest option
   - ❌ Very generic, high collision risk
   - ❌ Doesn't indicate this is for semantic-release

**Rationale**:

- Explicit prefix prevents environment variable collisions
- Clear intent: these are for the semantic-release-jira plugin
- Consistency with the npm package name
- Worth the extra verbosity for clarity and safety

### Decision 2: Environment Variables Always Override

**Chosen**: Environment variables always take precedence over config file values

**Alternatives Considered**:

1. Env vars only as fallback
   - ❌ Can't override shared config at runtime
   - ❌ Less flexible for CI/CD
   - ✅ More predictable merging

2. Explicit opt-in per value
   - ❌ Too complex
   - ❌ Requires special syntax in config
   - ✅ Maximum control

**Rationale**:

- Standard practice in 12-factor apps: env vars control runtime behavior
- Enables easy per-environment customization
- Matches user expectations (env vars = runtime overrides)
- Solves the primary use case: deploying same code to multiple environments

### Decision 3: Strict Boolean Parsing

**Chosen**: Accept 'true', 'false', '1', '0' (envalid default)

**Alternatives Considered**:

1. Very flexible parsing (true/false, 1/0, yes/no, YES/NO, TRUE/FALSE, etc.)
   - ❌ Too ambiguous ('yes' vs 'YES' vs 'Yes')
   - ❌ Harder to debug misconfigurations
   - ✅ More user-friendly

2. Truthy values only (any value = true)
   - ✅ Simplest
   - ❌ Very error-prone (typo = enabled)
   - ❌ No way to explicitly disable

3. Only 'true'/'false' (stricter than envalid)
   - ✅ Most explicit
   - ❌ Rejects common '1'/'0' convention
   - ❌ Less user-friendly

**Rationale**:

- Envalid's bool() validator accepts: 'true', 'false', '1', '0'
- Rejects ambiguous values ('yes', 'no', 'TRUE', 'FALSE', etc.)
- Strikes good balance between strictness and usability
- Clear error messages guide users to correct syntax
- Standard across many configuration libraries

### Decision 4: Support All Config Options

**Chosen**: All 14 config options available as env vars

**Alternatives Considered**:

1. Only sensitive credentials
   - ❌ Doesn't solve runtime override use case
   - ✅ Simpler implementation
   - ❌ Users will request more options anyway

2. Common subset (credentials + booleans)
   - ❌ Arbitrary limitation
   - ❌ Users need numeric options too
   - ✅ Less testing surface

**Rationale**:

- Consistency: why allow some but not others?
- Completeness: different users need different options
- Future-proof: won't need to add more later
- Minimal additional complexity

## Implementation Details

### File Structure

**Chosen Approach**: Keep everything in `src/config/validate.ts`

```
src/config/
└── validate.ts                      # Main validation (updated with env var loading)
```

**Rationale**:

- Envalid keeps the env var schema simple (~30 lines)
- Config merging is just object spread (~5 lines)
- No need for separate files - keeps code co-located
- Easier to understand and maintain
- Total addition: ~50-70 lines to existing file

**Alternative (not chosen)**: Separate `environment.ts` file

- Would be useful if implementation was more complex
- Unnecessary abstraction with envalid
- More files to navigate

### Testing Strategy

**Unit Tests** (`test/config/environment.test.ts`):

- Parse each env var type correctly
- Handle undefined env vars
- Throw errors for invalid values
- Merge env vars with config correctly

**Integration Tests** (`test/config/validate.test.ts` additions):

- Env var overrides config file
- Config file used when env var missing
- Defaults applied when both missing
- Error messages are clear and helpful

**Test Coverage Target**: 100% of new environment loading code

## Performance Considerations

- **Environment variable access**: Negligible cost (`process.env` lookup is fast)
- **Parsing overhead**: Minimal (happens once during `verifyConditions`)
- **Memory**: No additional memory beyond existing config object
- **Impact**: Zero performance impact on existing users

## Security Considerations

### Environment Variable Logging

**Critical**: Never log environment variables that may contain credentials:

```typescript
// ❌ NEVER do this
logger.log("Loaded env config", envConfig);

// ✅ Safe approach
logger.log("Configuration loaded from environment variables", {
  hasServerUrl: !!envConfig.jiraServerUrl,
  hasUsername: !!envConfig.jiraUsername,
  hasApiToken: !!envConfig.jiraApiToken,
  // Log presence, not values
});
```

### Existing Sanitization

The plugin already sanitizes credentials in logs (via Pino-noir and structured logger). This continues to work with env var values.

## Documentation Updates

### README.md Additions

#### Section: Environment Variable Configuration

Add comprehensive section after "Configuration Options" table:

````markdown
### Environment Variable Configuration

All configuration options can be provided via environment variables with the `SEMANTIC_RELEASE_JIRA_` prefix. Environment variables take precedence over config file values.

#### Available Environment Variables

| Environment Variable               | Config Option   | Type   | Example                         |
| ---------------------------------- | --------------- | ------ | ------------------------------- |
| `SEMANTIC_RELEASE_JIRA_SERVER_URL` | `jiraServerUrl` | string | `https://company.atlassian.net` |

| ... (complete table)

#### Common Use Cases

**Credentials in CI/CD**:

```bash
export SEMANTIC_RELEASE_JIRA_SERVER_URL=https://company.atlassian.net
export SEMANTIC_RELEASE_JIRA_USERNAME=bot@company.com
export SEMANTIC_RELEASE_JIRA_API_TOKEN=$JIRA_TOKEN
npx semantic-release
```
````

**Per-Environment Behavior**:

```bash
# Staging: dry run
export SEMANTIC_RELEASE_JIRA_DRY_RUN=true

# Production: write mode
export SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES=true
export SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS=true
```

```

## Migration Path

**Existing Users**: Zero changes required
- Current config files continue to work
- No deprecations
- Environment variable support is purely additive

**New Users**: Can choose their preferred approach
- Config file only
- Environment variables only
- Hybrid: base config + env var overrides

## Validation

### Success Criteria

1. All 14 config options work via environment variables
2. Environment variables override config file values
3. Clear error messages for invalid env var values
4. 100% test coverage of new code
5. Documentation is complete and includes examples
6. Zero breaking changes
7. Performance is unchanged

### Testing Checklist

- [ ] Parse all string env vars correctly
- [ ] Parse all boolean env vars correctly (strict 'true'/'false')
- [ ] Parse all numeric env vars correctly
- [ ] Reject invalid boolean values with clear error
- [ ] Reject invalid numeric values with clear error
- [ ] Env var overrides config file value
- [ ] Config file used when env var missing
- [ ] Defaults applied when both missing
- [ ] Required field validation still works
- [ ] URL validation still works
- [ ] Credential sanitization still works
- [ ] All existing tests still pass
```
