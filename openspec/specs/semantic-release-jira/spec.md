# semantic-release-jira Specification

## Purpose

TBD - created by archiving change jira-refinement. Update Purpose after archive.

## Requirements

### Requirement: Enhanced Release Notes with Issue Titles

When generating release notes, the plugin SHALL fetch issue summaries from Jira and include them in the formatted output to provide context without requiring users to click through to Jira. This addresses the poor user experience where release notes only show issue keys (e.g., `TEST-123`) without titles, requiring users to click each link to understand what was addressed.

#### Scenario: Fetch issue summaries when credentials are available

**Given** the plugin is configured with `jiraUsername` and `jiraApiToken` (not read-only mode)
**And** the `generateNotes` hook is executing
**And** there are collected Jira issues from commit messages
**When** the plugin generates release notes
**Then** the plugin SHALL fetch issue details for each collected issue using the Jira REST API endpoint `/rest/api/2/issue/{key}?fields=summary`
**And** the plugin SHALL use the existing rate limiter to control concurrent API calls
**And** the plugin SHALL gracefully handle API failures by continuing with unfetched issues

**Example**:

```
Input: Collected issues = [{ key: 'TEST-123', projectKey: 'TEST' }]
API Response: { key: 'TEST-123', fields: { summary: 'Implement user authentication' } }
Output: [{ key: 'TEST-123', projectKey: 'TEST', summary: 'Implement user authentication' }]
```

---

#### Scenario: Skip fetching in read-only mode

**Given** the plugin is configured WITHOUT `jiraUsername` or `jiraApiToken` (read-only mode)
**And** the `generateNotes` hook is executing
**When** the plugin generates release notes
**Then** the plugin SHALL NOT fetch issue details from Jira
**And** the plugin SHALL generate release notes using only issue keys

**Example**:

```
Input: Collected issues = [{ key: 'TEST-123', projectKey: 'TEST' }]
Output: Release notes show "- [TEST-123](url)" without title
```

---

#### Scenario: Graceful degradation when API calls fail

**Given** the plugin is fetching issue summaries
**And** one or more API calls fail (network error, timeout, 404, etc.)
**When** the plugin formats release notes
**Then** the plugin SHALL include issues without summaries in the output
**And** the plugin SHALL log a warning about failed fetches
**And** the plugin SHALL NOT fail the entire release process

**Example**:

```
Input: Collected issues = [
  { key: 'TEST-123', projectKey: 'TEST' },
  { key: 'TEST-456', projectKey: 'TEST' }
]
API: TEST-123 succeeds, TEST-456 fails (404)
Output:
- [TEST-123](url): Successfully fetched title
- [TEST-456](url)
```

---

### Requirement: Include issue titles in formatted release notes

When formatting Jira release notes, the plugin SHALL include issue summaries (titles) when they have been successfully fetched, while maintaining backward compatibility with issues that have no summary.

#### Scenario: Format issue with title

**Given** an issue has a `summary` field populated
**When** the plugin formats the issue for release notes
**Then** the output SHALL follow the format `- [ISSUE-KEY](url): Issue title`
**And** the title SHALL be rendered as plain text (not a link)
**And** special characters in the title SHALL be preserved

**Example**:

```
Input: { key: 'TEST-123', summary: 'Fix memory leak in cache layer' }
Output: "- [TEST-123](https://jira.example.com/browse/TEST-123): Fix memory leak in cache layer"
```

---

#### Scenario: Format issue without title

**Given** an issue does NOT have a `summary` field (fetch failed or read-only mode)
**When** the plugin formats the issue for release notes
**Then** the output SHALL follow the format `- [ISSUE-KEY](url)` (current behavior)
**And** no title SHALL be appended

**Example**:

```
Input: { key: 'TEST-123' } (no summary)
Output: "- [TEST-123](https://jira.example.com/browse/TEST-123)"
```

---

#### Scenario: Markdown compatibility

**Given** an issue has a summary containing markdown special characters
**When** the plugin formats the issue for release notes
**Then** special characters SHALL be rendered safely (no injection)
**And** the output SHALL remain valid markdown

**Example**:

```
Input: { key: 'TEST-123', summary: 'Fix [urgent] bug in <script>' }
Output: "- [TEST-123](url): Fix [urgent] bug in <script>"
(markdown renders literally, no script execution)
```

---

### Requirement: Structured Logging with Pino

The plugin SHALL use the `pino` library for structured logging to provide industry-standard logging with better performance and maintainability. This replaces the custom logging implementation (121 lines) that duplicates functionality available in battle-tested libraries, increasing maintenance burden and missing performance optimizations.

#### Scenario: Logger API compatibility

**Given** the plugin uses `StructuredLogger` class
**When** code calls `logger.log()`, `logger.error()`, or `logger.success()`
**Then** the logger SHALL maintain the same public API
**And** the logger SHALL use the semantic-release baseLogger for output
**And** the logger SHALL format messages for semantic-release compatibility

**Example**:

```typescript
logger.log("Fetched issue details", { issueKey: "TEST-123" });
// Output: "Fetched issue details {"issueKey":"TEST-123"}"
```

---

#### Scenario: Automatic correlation ID generation

**Given** a `StructuredLogger` instance is created
**When** no correlation ID is provided in the constructor
**Then** the logger SHALL generate a UUID correlation ID automatically
**And** the correlation ID SHALL be included in the pino base context

**Example**:

```typescript
const logger = new StructuredLogger(baseLogger);
// Internal pino instance has: { correlationId: '123e4567-e89b-12d3-a456-426614174000' }
```

---

#### Scenario: Timer functionality preserved

**Given** a `StructuredLogger` instance
**When** code calls `logger.startTimer()`
**Then** the logger SHALL return a function that calculates elapsed time in milliseconds
**And** the implementation SHALL remain independent of pino

**Example**:

```typescript
const timer = logger.startTimer();
// ... do work ...
const elapsed = timer(); // 1523 (milliseconds)
```

---

### Requirement: Automatic Credential Redaction with Pino-Noir

The plugin SHALL use `pino-noir` for automatic credential redaction to ensure sensitive data never appears in logs without requiring manual sanitization. This replaces the custom sanitization implementation (205 lines) that requires manual pattern maintenance and lacks community security audits.

#### Scenario: Automatic field-based redaction

**Given** pino-noir is configured with redaction paths:

- `req.headers.authorization`
- `res.headers.authorization`
- `*.password`
- `*.apiToken`
- `*.jiraApiToken`
- `*.token`
- `*.secret`
- `*.credential`

**When** structured data is logged containing sensitive fields
**Then** the logger SHALL automatically redact values matching the configured paths
**And** redacted values SHALL be replaced with `[REDACTED]`

**Example**:

```typescript
logger.log("HTTP request", {
  headers: { authorization: "Bearer abc123" },
  password: "secret123",
});
// Output includes: { headers: { authorization: '[REDACTED]' }, password: '[REDACTED]' }
```

---

#### Scenario: No manual sanitization required

**Given** pino-noir is configured
**When** code logs objects with sensitive data
**Then** developers SHALL NOT need to call `sanitizeForLogging()` manually
**And** redaction SHALL happen automatically
**And** the `sanitizeForLogging()` function SHALL be removed from the codebase

**Example**:

```typescript
// Before (with custom sanitization):
logger.log("Config", sanitizeForLogging(config));

// After (with pino-noir):
logger.log("Config", config); // Automatic redaction
```

---

#### Scenario: Circular reference handling

**Given** pino-noir is configured
**When** an object with circular references is logged
**Then** pino SHALL handle circular references without throwing errors
**And** circular references SHALL be replaced with `[Circular]` markers

**Example**:

```typescript
const obj: any = { name: "test" };
obj.self = obj; // circular reference
logger.log("Object", obj);
// No error thrown, circular reference handled safely
```

---

### Requirement: API call performance for issue fetching

When the plugin is fetching issue summaries for N issues, API calls SHALL be rate-limited using the existing `p-limit` mechanism, concurrent fetches SHALL NOT exceed the configured concurrency limit (default: 5), and fetching 50 issues SHALL complete in less than 15 seconds under normal network conditions.

#### Scenario: Rate limiting prevents API overload

**Given** the plugin is configured to fetch issue summaries
**And** there are 50 collected issues
**When** the plugin fetches issue details
**Then** no more than 5 concurrent API calls SHALL be in-flight at any time
**And** the rate limiter SHALL queue remaining requests
**And** all 50 issues SHALL be fetched within 15 seconds

---

### Requirement: Logging performance improvement

When the plugin uses pino for logging, compared to the custom logging implementation, logging operations SHALL be at least 5x faster (measured by pino benchmarks) and logging overhead SHALL be negligible (less than 1% of total execution time).

#### Scenario: Pino improves logging performance

**Given** the plugin uses pino for logging
**When** executing a release with verbose logging
**Then** logging operations SHALL consume less than 1% of total execution time
**And** pino SHALL outperform the custom logger by at least 5x (based on published benchmarks)

---

### Requirement: Zero credential leakage

Given pino-noir automatic redaction is configured, when any log message is output, credentials SHALL NEVER appear in plain text. The following patterns SHALL be automatically redacted: Bearer tokens, Basic authentication headers, API tokens, Passwords, Secrets, and Authorization headers.

#### Scenario: Credentials are automatically redacted in all logs

**Given** pino-noir is configured
**When** tests are run with `npm test 2>&1 | rg -i "password|token|secret"`
**Then** the output SHALL only contain `[REDACTED]` values
**And** no plain text credentials SHALL appear

---

### Requirement: HTTPS enforcement maintained

When the plugin fetches issue details from Jira, all API calls SHALL use HTTPS (enforced by existing URL validation) and the HTTP client SHALL use the existing resilient client with retries and timeouts.

#### Scenario: All Jira API calls use HTTPS

**Given** the plugin is configured with a Jira server URL
**When** fetching issue details
**Then** all API calls SHALL use HTTPS protocol
**And** HTTP URLs SHALL be rejected during validation
**And** the existing resilient HTTP client SHALL handle retries and timeouts

---

### Requirement: No breaking changes to release notes format

When the plugin generates release notes with titles, and an issue has no summary (fetch failed or read-only mode), the output SHALL match the current format `- [KEY](url)`. Existing users SHALL see no difference in read-only mode, and users with credentials SHALL see enhanced output with titles.

#### Scenario: Backward compatible output for issues without summaries

**Given** the plugin is in read-only mode OR an API call failed
**And** an issue has no `summary` field
**When** release notes are generated
**Then** the output SHALL be `- [KEY](url)` (current format)
**And** no breaking changes SHALL occur for existing users

---

### Requirement: Logger API compatibility

When the plugin migrates to pino, all existing method signatures on the `StructuredLogger` class SHALL remain unchanged, no code outside `src/utils/logger.ts` SHALL require changes, and the logger SHALL continue to work with semantic-release's baseLogger.

#### Scenario: No API changes to StructuredLogger

**Given** the plugin migrates to pino
**When** internal code uses `StructuredLogger` methods
**Then** all method signatures SHALL remain unchanged
**And** no breaking changes SHALL occur for internal consumers

---

### Requirement: Graceful degradation for network failures

All new API interactions SHALL gracefully degrade on failures, ensuring the release process continues even if optional enhancements (like fetching titles) fail. This ensures network issues or API changes do not break releases.

#### Scenario: Continue release when title fetch fails

**Given** the plugin is fetching issue titles
**When** all API calls fail
**Then** the plugin SHALL generate release notes without titles
**And** the release process SHALL continue successfully
**And** warnings SHALL be logged for debugging

---

### Requirement: Maintainability improvement through code reduction

The pino migration SHALL reduce custom code by at least 250 lines (121 from logger + 205 from sanitize - 30 for pino wrapper) while maintaining or improving functionality. This addresses the maintenance burden of custom utilities.

#### Scenario: Significant reduction in custom code

**Given** the plugin migrates to pino and pino-noir
**When** comparing before and after
**Then** custom code SHALL be reduced by approximately 296 lines net
**And** test coverage SHALL be maintained or improved
**And** security SHALL be improved through battle-tested libraries

### Requirement: Zero Linting Errors

The codebase SHALL pass all linting rules without errors or warnings to ensure code quality, type safety, and maintainability. This includes TypeScript safety checks, style conventions, code quality rules, and test quality standards.

#### Scenario: TypeScript type safety

**Given** the codebase uses TypeScript with strict type checking
**When** running `npm run lint` or `npm run check-types`
**Then** there SHALL be zero TypeScript safety violations
**And** all `@typescript-eslint/no-unsafe-*` rules SHALL pass
**And** all type assertions SHALL use proper types
**And** template literal expressions SHALL have valid types

**Example**:

```typescript
// ✅ Safe - uses type guard
this.ensureInitialized();
const timer = this.logger.startTimer(); // TypeScript knows logger is defined

// ❌ Unsafe - direct access to optional property
const timer = this.logger?.startTimer(); // lint error
```

---

#### Scenario: Code style compliance

**Given** the codebase follows unicorn and import conventions
**When** running `npm run lint`
**Then** all style rules SHALL pass
**And** abbreviations SHALL be avoided (e.g., `Env` → `Environment`)
**And** imports SHALL follow consistent patterns
**And** text encoding SHALL use standard identifiers (utf8 not utf-8)
**And** null SHALL be replaced with undefined where appropriate

---

#### Scenario: Code quality standards

**Given** the codebase follows SonarJS quality rules
**When** running `npm run lint`
**Then** cognitive complexity SHALL not exceed 15 for any function
**And** hardcoded sensitive values SHALL only appear in test fixtures with proper suppression
**And** functions SHALL be placed at appropriate scopes

---

#### Scenario: Test quality

**Given** the test suite uses Vitest
**When** running `npm run lint`
**Then** all tests SHALL contain assertions
**And** disabled tests SHALL use `.todo()` instead of `.skip()`
**And** test helpers SHALL be properly scoped
**And** mock imports SHALL use correct named imports

---

### Requirement: Clean Test Output

Test execution SHALL produce clean, readable console output without verbose logging noise to improve developer experience and make test failures easily identifiable.

#### Scenario: Silent logging during tests

**Given** the plugin uses Pino for structured logging
**And** the test environment is configured with `NODE_ENV=test`
**When** running `npm test`
**Then** Pino SHALL be configured with level 'silent'
**And** no JSON log lines SHALL appear in test output
**And** only test results SHALL be displayed

**Example**:

```bash
# ✅ Clean output
✓ test/utils/logger.test.ts (28 tests) 27ms
✓ test/config/validate.test.ts (64 tests) 15ms

# ❌ Polluted output (before fix)
{"level":30,"time":1766190157758,"correlationId":"test-id",...}
{"level":30,"time":1766190157760,"correlationId":"another-id",...}
✓ test/utils/logger.test.ts (28 tests) 27ms
```

---

#### Scenario: Test output readability

**Given** tests are running
**When** a test fails
**Then** the failure SHALL be immediately visible without scrolling through logs
**And** error messages SHALL be clear and unobstructed
**And** test summary SHALL be easy to read

---

### Requirement: Fast Test Execution

The test suite SHALL complete execution in under 20 seconds to provide rapid feedback during development and maintain developer productivity.

#### Scenario: Test performance target

**Given** the test suite contains 362 tests across 19 test files
**When** running `npm test`
**Then** total execution time SHALL be under 20 seconds
**And** no single test file SHALL take more than 11 seconds
**And** all tests SHALL remain stable and non-flaky

**Current baseline**: ~34 seconds
**Target improvement**: >40% reduction

---

#### Scenario: Optimized test timeouts

**Given** tests use mocked HTTP requests
**When** configuring test timeouts
**Then** integration tests SHALL use timeouts ≤10 seconds
**And** unit tests SHALL use default timeouts
**And** retry tests SHALL use mock timers instead of real delays
**And** no test SHALL wait unnecessarily for mocked responses

**Example**:

```typescript
// ✅ Optimized - uses mock timers
it("should retry with exponential backoff", async () => {
  vi.useFakeTimers();
  // Test completes instantly
  vi.useRealTimers();
});

// ❌ Slow - waits for real delays
it("should retry with exponential backoff", async () => {
  // Actually waits 100ms + 200ms + 400ms = 700ms
}, 30000);
```

---

#### Scenario: Parallel test execution

**Given** Vitest supports parallel test execution
**When** running the test suite
**Then** tests SHALL execute in parallel across multiple threads
**And** thread pool SHALL be configured for optimal CPU utilization
**And** no race conditions SHALL occur between parallel tests

---

### Requirement: Semantic-Release Peer Dependency

The plugin SHALL declare semantic-release as a peer dependency with appropriate version constraints to ensure compatibility and follow plugin best practices.

#### Scenario: Peer dependency declaration

**Given** this package is a semantic-release plugin
**When** reviewing package.json
**Then** semantic-release SHALL be listed in peerDependencies
**And** the version constraint SHALL be ">=23.0.0"
**And** semantic-release SHALL also be in devDependencies for testing

**Example**:

```json
{
  "peerDependencies": {
    "semantic-release": ">=23.0.0"
  },
  "devDependencies": {
    "semantic-release": "^24.2.0"
  }
}
```

---

#### Scenario: Version compatibility

**Given** semantic-release >=23.0.0 is specified
**When** the plugin is used with semantic-release v23 or v24
**Then** the plugin SHALL be fully compatible
**And** all lifecycle hooks SHALL work correctly
**And** no version-specific workarounds SHALL be needed

---

#### Scenario: Peer dependency warning

**Given** a consuming project installs this plugin
**And** semantic-release is not installed
**When** running `npm install`
**Then** npm SHALL display a peer dependency warning
**And** the warning SHALL specify the required version (>=23.0.0)
**And** the warning SHALL guide users to install semantic-release

---

### Requirement: Type Safety with Runtime Guards

The plugin SHALL use TypeScript type guards to ensure both compile-time type safety and runtime initialization safety without sacrificing correctness.

#### Scenario: Initialization assertion

**Given** the plugin class has optional properties that are initialized in verifyConditions
**When** lifecycle methods (analyzeCommits, generateNotes, success) are called
**Then** an ensureInitialized() type guard SHALL be called first
**And** TypeScript SHALL infer properties are defined after the guard
**And** runtime errors SHALL be thrown if properties are not initialized
**And** no unsafe type assertions SHALL be needed

**Example**:

```typescript
class SemanticReleaseJiraPlugin {
  private config?: ValidatedPluginConfig;

  private ensureInitialized(): asserts this is this & {
    config: ValidatedPluginConfig;
  } {
    if (!this.config) {
      throw new Error("Plugin not initialized");
    }
  }

  async analyzeCommits(): Promise<void> {
    this.ensureInitialized(); // ✅ Guards both compile-time and runtime
    console.log(this.config.jiraServerUrl); // ✅ TypeScript knows config is defined
  }
}
```

---

### Requirement: Cognitive Complexity Limits

Individual functions SHALL maintain cognitive complexity at or below 15 to ensure readability, maintainability, and ease of testing.

#### Scenario: Complex validation refactoring

**Given** a validation function exceeds cognitive complexity limit of 15
**When** refactoring the function
**Then** nested logic SHALL be extracted into helper functions
**And** each helper function SHALL handle a single validation concern
**And** the main function SHALL orchestrate helpers sequentially
**And** behavior SHALL remain identical to the original implementation

**Example**:

```typescript
// ❌ Complexity: 36 (too high)
export function validatePluginConfig(config: unknown): ValidatedPluginConfig {
  // 100+ lines of nested if/else validation
  if (hasUsername) {
    if (!hasToken) {
      if (transitionIssues) {
        // ... deep nesting
      }
    }
  }
}

// ✅ Complexity: 8 (within limit)
export function validatePluginConfig(config: unknown): ValidatedPluginConfig {
  validateBaseConfig(config);
  validateCredentials(config);
  validateTransitionConfig(config);
  validateVersionConfig(config);
  validateCustomPattern(config);
  return normalizeConfig(config);
}
```

---

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
