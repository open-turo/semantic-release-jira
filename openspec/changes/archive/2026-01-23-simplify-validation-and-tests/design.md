# Design: Simplify Validation and Tests

## Architecture

### Current State

```
┌─────────────────────────────────────────┐
│   Plugin Configuration Loading          │
│                                          │
│  1. Load config from semantic-release   │
│  2. Parse env vars with envalid         │
│  3. Merge config (env overrides config) │
│  4. Run custom validation functions:    │
│     - validateRequiredFields()          │
│     - validateTransitionConfig()        │
│     - validateNumericFields()           │
│     - validateBooleanFields()           │
│     - validateCustomPattern()           │
│     - validateCredentials()             │
│  5. Return ValidatedPluginConfig        │
└─────────────────────────────────────────┘

Problems:
- Dual systems (envalid + custom)
- High cognitive complexity in validators
- Imperative, hard to understand
- 392 lines of validation code
```

### Target State

```
┌─────────────────────────────────────────┐
│   Unified Zod Validation Pipeline       │
│                                          │
│  1. Define configSchema (Zod object)    │
│  2. Define envSchema (Zod object)       │
│  3. Parse env vars: envSchema.parse()   │
│  4. Merge with config                   │
│  5. Validate merged: configSchema       │
│     .parse(merged)                      │
│  6. Return ValidatedPluginConfig        │
└─────────────────────────────────────────┘

Benefits:
- Single validation system
- Declarative, easy to understand
- Built-in type inference
- Reduced complexity
- Target: ~200-250 lines
```

## Validation Schema Design

### Core Schema Structure

```typescript
import { z } from "zod";

// Environment variable schema (SCREAMING_SNAKE_CASE inputs)
const envVarSchema = z.object({
  SEMANTIC_RELEASE_JIRA_SERVER_URL: z.string().optional(),
  SEMANTIC_RELEASE_JIRA_USERNAME: z.string().optional(),
  SEMANTIC_RELEASE_JIRA_API_TOKEN: z.string().optional(),
  SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS: z.string().optional(),
  SEMANTIC_RELEASE_JIRA_VERSION_PREFIX: z.string().optional(),
  SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN: z.string().optional(),
  SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES: z
    .enum(["true", "false", "1", "0"])
    .transform((val) => val === "true" || val === "1")
    .optional(),
  SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS: z
    .enum(["true", "false", "1", "0"])
    .transform((val) => val === "true" || val === "1")
    .optional(),
  SEMANTIC_RELEASE_JIRA_DRY_RUN: z
    .enum(["true", "false", "1", "0"])
    .transform((val) => val === "true" || val === "1")
    .optional(),
  SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR: z
    .enum(["true", "false", "1", "0"])
    .transform((val) => val === "true" || val === "1")
    .optional(),
  SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED: z
    .enum(["true", "false", "1", "0"])
    .transform((val) => val === "true" || val === "1")
    .optional(),
  SEMANTIC_RELEASE_JIRA_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .optional(),
  SEMANTIC_RELEASE_JIRA_TIMEOUT: z.coerce.number().int().positive().optional(),
  SEMANTIC_RELEASE_JIRA_RETRIES: z.coerce
    .number()
    .int()
    .min(0)
    .max(10)
    .optional(),
  SEMANTIC_RELEASE_JIRA_RETRY_DELAY: z.coerce.number().int().min(0).optional(),
});

// Transform env vars to camelCase config keys
function transformEnvToConfig(
  env: z.infer<typeof envVarSchema>,
): Partial<PluginConfig> {
  return {
    jiraServerUrl: env.SEMANTIC_RELEASE_JIRA_SERVER_URL,
    jiraUsername: env.SEMANTIC_RELEASE_JIRA_USERNAME,
    jiraApiToken: env.SEMANTIC_RELEASE_JIRA_API_TOKEN,
    transitionToStatus: env.SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS,
    versionPrefix: env.SEMANTIC_RELEASE_JIRA_VERSION_PREFIX,
    customIssuePattern: env.SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN,
    transitionIssues: env.SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES,
    createVersions: env.SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS,
    dryRun: env.SEMANTIC_RELEASE_JIRA_DRY_RUN,
    failOnJiraError: env.SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR,
    rejectUnauthorized: env.SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED,
    concurrency: env.SEMANTIC_RELEASE_JIRA_CONCURRENCY,
    timeout: env.SEMANTIC_RELEASE_JIRA_TIMEOUT,
    retries: env.SEMANTIC_RELEASE_JIRA_RETRIES,
    retryDelay: env.SEMANTIC_RELEASE_JIRA_RETRY_DELAY,
  };
}

// Main configuration schema (camelCase)
const configSchema = z
  .object({
    // Required fields
    jiraServerUrl: z
      .string()
      .url({ message: "Invalid jiraServerUrl" })
      .refine(
        (url) => {
          const parsedUrl = new URL(url);
          return (
            parsedUrl.protocol === "https:" ||
            ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname)
          );
        },
        {
          message:
            "jiraServerUrl must use HTTPS for security (got http://). HTTP is only allowed for localhost.",
        },
      )
      .refine((value) => !isUnexpandedEnvironmentVariable(value), {
        message:
          "jiraServerUrl appears to contain an unexpanded environment variable",
      }),

    // Credentials
    jiraUsername: z
      .string()
      .optional()
      .refine((value) => !isUnexpandedEnvironmentVariable(value), {
        message:
          "jiraUsername appears to contain an unexpanded environment variable",
      }),
    jiraApiToken: z
      .string()
      .optional()
      .refine((value) => !isUnexpandedEnvironmentVariable(value), {
        message:
          "jiraApiToken appears to contain an unexpanded environment variable",
      }),

    // Optional string fields
    transitionToStatus: z.string().trim().min(1).optional(),
    versionPrefix: z.string().optional(),
    customIssuePattern: z
      .string()
      .refine(
        (pattern) => {
          try {
            new RegExp(pattern);
            return true;
          } catch {
            return false;
          }
        },
        { message: "Invalid customIssuePattern: must be a valid regex" },
      )
      .refine((pattern) => safeRegex(pattern), {
        message:
          "customIssuePattern may cause ReDoS. Avoid nested quantifiers.",
      })
      .optional(),

    // Boolean fields with defaults
    transitionIssues: z.boolean().default(false),
    createVersions: z.boolean().default(false),
    dryRun: z.boolean().default(false),
    failOnJiraError: z.boolean().default(false),
    rejectUnauthorized: z.boolean().default(true),

    // Numeric fields with defaults
    concurrency: z.number().int().min(1).max(100).default(10),
    timeout: z.number().int().positive().default(30_000),
    retries: z.number().int().min(0).max(10).default(3),
    retryDelay: z.number().int().min(0).default(1000),
  })
  .refine(
    (data) => {
      // Credentials required when transitionIssues or createVersions is enabled
      if (data.transitionIssues || data.createVersions) {
        return data.jiraUsername && data.jiraApiToken;
      }
      return true;
    },
    {
      message:
        "Jira credentials (jiraUsername and jiraApiToken) are required when transitionIssues or createVersions is enabled",
      path: ["jiraUsername"], // Show error on username field
    },
  );
```

### Validation Flow

```typescript
export function validateConfig(
  config: Partial<PluginConfig>,
): ValidatedPluginConfig {
  // Step 1: Parse environment variables
  const envResult = envVarSchema.safeParse(process.env);

  if (!envResult.success) {
    const formatted = formatZodError(envResult.error);
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }

  // Step 2: Transform env vars to config format
  const envConfig = transformEnvToConfig(envResult.data);

  // Step 3: Merge (env vars override config file)
  const merged = { ...config, ...envConfig };

  // Step 4: Validate merged config
  const configResult = configSchema.safeParse(merged);

  if (!configResult.success) {
    const formatted = formatZodError(configResult.error);
    throw new Error(`Configuration validation failed:\n${formatted}`);
  }

  // Step 5: Return validated config (Zod infers the type)
  return configResult.data;
}
```

## Error Message Formatting

Zod's default error messages are technical. We'll create a custom formatter for user-friendly messages:

```typescript
function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((err) => {
      const path = err.path.join(".");
      return `  ${path}: ${err.message}`;
    })
    .join("\n");
}
```

## Helper Functions

Keep utility functions that are reused:

```typescript
// Keep these helpers
export function isUnexpandedEnvironmentVariable(
  value: string | undefined,
): boolean {
  if (!value) return false;
  if (/^\$\{[A-Z_][A-Z0-9_]*\}$/.test(value)) return true;
  if (/^\$[A-Z_][A-Z0-9_]*$/.test(value)) return true;
  return false;
}

export function getIssuePattern(config: ValidatedPluginConfig): RegExp {
  const pattern = config.customIssuePattern ?? DEFAULT_ISSUE_PATTERN;
  return new RegExp(pattern, "g");
}

export function isValidIssueKeyFormat(key: string): boolean {
  const issueKeyPattern = /^[A-Z][A-Z0-9]*-\d+$/;
  return issueKeyPattern.test(key);
}
```

## Test Consolidation Strategy

### Current Test Structure

```
environment-config.test.ts (710 lines)
├── Scenario 1: Only env vars (47 lines)
│   ├── should work with only environment variables
│   └── should work with only env vars for read-only mode
├── Scenario 2: Mixed env vars and config (54 lines)
│   ├── should use config for server URL and env vars for credentials
│   └── should use config defaults and env var overrides for numeric options
├── Scenario 3: Env vars override config (78 lines)
│   ├── should use env var when overriding transitionIssues
│   ├── should use env var when overriding dryRun
│   └── should use env var to override createVersions
├── Scenario 4: Credentials from env vars (90 lines)
│   ├── should use credentials from env vars in HTTP requests
│   └── should fail with invalid credentials from env vars
├── Scenario 5: Base config with credential override (84 lines)
│   ├── should work with shared config file and runtime env credentials
│   └── should use env var to override server URL from config
├── Scenario 6: Shared config with environment-specific behavior (197 lines)
│   ├── should enable dry run in staging via env var
│   ├── should enable transitions in production via env var
│   ├── should handle different timeout configurations per environment
│   └── should support different custom patterns per environment
└── Edge Cases and Error Handling (160 lines)
    ├── should fail when credentials are required but not provided
    ├── should handle invalid environment variable types
    ├── should handle boolean env vars with standard formats
    ├── should reject boolean env vars with invalid formats
    ├── should handle env vars that need trimming by failing validation
    └── should validate that env vars override config for all 14 options
```

**Problems:**

- Repetitive mock setup (same nock patterns repeated)
- Many tests verify the same behavior with different values
- Verbose assertions checking every config field
- Not using mock utilities from test/mocks/

### Target Test Structure

```
environment-config.test.ts (~350-400 lines, -40-50%)

├── Environment Variable Overrides (parameterized tests)
│   ├── it.each: Boolean overrides (transitionIssues, createVersions, dryRun)
│   ├── it.each: String overrides (serverUrl, username, token, versionPrefix)
│   └── it.each: Numeric overrides (timeout, retries, concurrency, retryDelay)
│
├── Full Workflows (using mockJiraFullWorkflow)
│   ├── should work with env vars only
│   ├── should work with mixed config and env vars
│   └── should work with shared config and runtime credentials
│
├── Credential Validation
│   ├── should fail when credentials required but missing
│   └── should validate credentials in HTTP headers (simplified with mock utils)
│
└── Edge Cases
    ├── it.each: Invalid env var types (boolean, numeric)
    └── should handle all 14 options override
```

**Improvements:**

- Use `it.each()` for parameterized tests
- Use `mockJiraFullWorkflow()` instead of manual nock setup
- Combine assertions using helper functions
- Focus on unique behavior, not redundant checks
- Remove verbose describe nesting

### Example: Before and After

**Before (78 lines):**

```typescript
describe("Scenario 3: Env vars override config in real plugin execution", () => {
  it("should use env var when overriding transitionIssues", async () => {
    const config: Partial<PluginConfig> = {
      jiraServerUrl,
      transitionIssues: false,
    };

    process.env.SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES = "true";
    process.env.SEMANTIC_RELEASE_JIRA_USERNAME = jiraUsername;
    process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = jiraApiToken;

    const plugin = new SemanticReleaseJiraPlugin();
    const context = createMockContext();

    const authScope = mockJiraAuth({ serverUrl, username });
    const issueScope = mockJiraIssueVerification(serverUrl, [
      "PROJ-123",
      "PROJ-456",
    ]);
    const transitionScope = mockJiraTransitions(serverUrl, [
      { key: "PROJ-123" },
      { key: "PROJ-456" },
    ]);

    await plugin.verifyConditions(config, context);
    await plugin.analyzeCommits(config, context);
    await plugin.success(config, context);

    expectAllScopesAreDone([authScope, issueScope, transitionScope]);
  });

  // 2 more similar tests...
});
```

**After (20 lines with parameterization):**

```typescript
describe("Environment variable overrides", () => {
  it.each([
    [
      "transitionIssues",
      "TRANSITION_ISSUES",
      "true",
      { includeTransitions: true },
    ],
    ["createVersions", "CREATE_VERSIONS", "true", { includeVersions: true }],
    ["dryRun", "DRY_RUN", "true", { dryRun: true }],
  ])(
    "should override %s via SEMANTIC_RELEASE_JIRA_%s",
    async (configKey, envKey, envValue, mockOptions) => {
      const config = { jiraServerUrl, [configKey]: false };
      process.env[`SEMANTIC_RELEASE_JIRA_${envKey}`] = envValue;
      process.env.SEMANTIC_RELEASE_JIRA_USERNAME = jiraUsername;
      process.env.SEMANTIC_RELEASE_JIRA_API_TOKEN = jiraApiToken;

      const plugin = new SemanticReleaseJiraPlugin();
      const context = createMockContext();
      const scopes = mockJiraFullWorkflow({
        serverUrl,
        username,
        ...mockOptions,
      });

      await plugin.verifyConditions(config, context);
      await plugin.success(config, context);

      expectAllScopesAreDone(scopes);
    },
  );
});
```

## Migration Strategy

### Phase 1: Zod Validation

1. Add Zod dependency: `npm install zod`
2. Create new validation implementation alongside existing
3. Add feature flag to switch between implementations
4. Run tests with both implementations to ensure parity
5. Switch to Zod implementation
6. Remove old implementation and envalid

### Phase 2: Test Consolidation

1. Identify groups of similar tests
2. Create parameterized versions using `it.each()`
3. Replace manual mocks with utilities from `test/mocks/`
4. Remove redundant test scenarios
5. Verify coverage maintained

### Phase 3: Cleanup

1. Remove envalid dependency
2. Remove unused helper functions
3. Update any documentation
4. Final lint and type-check pass

## Complexity Reduction

### Before

```
validateConfig - Cognitive Complexity: 8
validateRequiredFields - Complexity: 10
validateTransitionConfig - Complexity: 3
validateNumericFields - Complexity: 16
validateBooleanFields - Complexity: 9
validateCustomPattern - Complexity: 6
validateCredentials - Complexity: 5
```

### After

```
validateConfig - Cognitive Complexity: 5 (just parsing steps)
formatZodError - Complexity: 3
transformEnvToConfig - Complexity: 1
(Zod schemas have 0 complexity - they're declarations)
```

## Type Safety Improvements

### Before (envalid)

```typescript
// Runtime parsing only, manual type assertions needed
const env = cleanEnv(process.env, schema);
// Type of env is inferred but disconnected from PluginConfig
```

### After (Zod)

```typescript
// Compile-time type inference
const result = configSchema.parse(merged);
// result is automatically typed as ValidatedPluginConfig
// TypeScript knows all fields and their types
```

## Backwards Compatibility

- All existing error messages preserved or improved
- Same validation behavior (just different implementation)
- No breaking changes to plugin interface
- Environment variable names unchanged
- Config file format unchanged

## Testing Strategy

1. **Validation Tests**: All existing tests in `test/config/validate.test.ts` must pass
2. **Environment Tests**: All existing tests in `test/config/validate.environment.test.ts` must pass
3. **Integration Tests**: Consolidated `test/integration/environment-config.test.ts` must maintain coverage
4. **Coverage Requirement**: No reduction in code coverage percentage
5. **Regression Testing**: Run full test suite multiple times to catch flakes

## Success Metrics

- ✅ Reduce validation code from 392 lines to ~200-250 lines (-35-40%)
- ✅ Reduce integration tests from 710 lines to ~350-400 lines (-40-50%)
- ✅ All cognitive complexity scores < 15
- ✅ Zero TypeScript errors
- ✅ Zero ESLint errors
- ✅ 100% test pass rate
- ✅ Test coverage maintained or improved
