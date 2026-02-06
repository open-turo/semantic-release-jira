# Spec: semantic-release-jira

## ADDED Requirements

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
