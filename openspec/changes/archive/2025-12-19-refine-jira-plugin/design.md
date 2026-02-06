# Design Document: Jira Plugin Refinements

## Context

Two comprehensive reviews (code quality and platform/security) identified critical issues that prevent production deployment. The plugin architecture is sound, but implementation details have significant gaps in reliability, security, and observability.

**Severity Breakdown:**

- 2 Critical bugs (module state, missing timeouts)
- 8 High-priority issues (security, reliability, testing)
- 15 Medium-priority issues (observability, configuration)
- 10 Low-priority issues (code quality, nice-to-haves)

**Stakeholders:**

- Security teams requiring credential sanitization
- SRE teams requiring observability and reliability
- Development teams requiring maintainable code
- End users requiring stable releases

## Goals / Non-Goals

### Goals

- Fix all critical and high-priority issues
- Improve production readiness score from 5/10 to 9/10
- Add comprehensive integration testing
- Implement enterprise-grade reliability patterns
- Maintain backward compatibility where possible
- Keep changes focused and incremental

### Non-Goals

- Complete architectural rewrite
- Support for additional VCS platforms beyond GitHub
- Advanced Jira workflow automation
- Custom metrics backends (provide interfaces only)
- Performance optimization beyond fixing obvious issues

## Decisions

### 1. State Management Refactoring

**Decision:** Use class-based plugin with instance state

**Current (BROKEN):**

```typescript
let collectedIssues: JiraIssue[] = [];
let validatedConfig: PluginConfig;

export async function verifyConditions(...) { /*...*/ }
export async function analyzeCommits(...) { /*...*/ }
```

**New Approach:**

```typescript
export default class SemanticReleaseJiraPlugin {
  private collectedIssues: JiraIssue[] = [];
  private config: ValidatedPluginConfig;

  async verifyConditions(pluginConfig, context) {
    /*...*/
  }
  async analyzeCommits(pluginConfig, context) {
    /*...*/
  }
  async generateNotes(pluginConfig, context) {
    /*...*/
  }
  async success(pluginConfig, context) {
    /*...*/
  }
}
```

**Rationale:**

- Instance state prevents cross-execution contamination
- Better testability with dependency injection
- Follows semantic-release plugin patterns
- Maintains compatibility (semantic-release supports both exports)

**Alternative Considered:** Pass state through context

- Rejected: Pollutes semantic-release context with plugin data
- Rejected: More complex to track across hooks

### 2. HTTP Client Configuration

**Decision:** Centralized HTTP client factory with standard configuration

**Pattern:**

```typescript
interface HttpClientConfig {
  baseURL: string;
  timeout?: number; // Default: 30000ms
  retries?: number; // Default: 3
  retryDelay?: number; // Default: 1000ms (exponential)
  concurrency?: number; // Default: 10
  headers?: Record<string, string>;
}

function createResilientHttpClient(config: HttpClientConfig): AxiosInstance {
  const client = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout ?? 30000,
    httpAgent: new http.Agent({
      keepAlive: true,
      maxSockets: config.concurrency ?? 10,
    }),
    httpsAgent: new https.Agent({
      keepAlive: true,
      maxSockets: config.concurrency ?? 10,
    }),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `semantic-release-jira/${version}`,
      ...config.headers,
    },
  });

  // Add retry interceptor
  axiosRetry(client, {
    retries: config.retries ?? 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 429 ||
        error.response?.status >= 500
      );
    },
  });

  // Add credential sanitization interceptor
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.config?.headers?.Authorization) {
        error.config.headers.Authorization = "[REDACTED]";
      }
      return Promise.reject(error);
    },
  );

  return client;
}
```

**Rationale:**

- Centralizes all reliability patterns
- Makes configuration consistent
- Easy to test and mock
- Follows industry best practices

### 3. Rate Limiting Strategy

**Decision:** Use p-limit for concurrency control

**Implementation:**

```typescript
import pLimit from 'p-limit';

// In plugin class
private readonly limit = pLimit(this.config.concurrency ?? 10);

// Usage
async verifyIssues(issues: JiraIssue[]): Promise<JiraIssue[]> {
  const results = await Promise.allSettled(
    issues.map(issue =>
      this.limit(() => this.verifyIssueExists(issue.key))
    )
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map((r, i) => issues[i]);
}
```

**Rationale:**

- Simple and effective
- No external services required
- Configurable per-user needs
- Prevents API rate limit issues

**Alternative Considered:** bottleneck package

- Rejected: More complex, overkill for this use case

### 4. Credential Sanitization

**Decision:** Multi-layer approach with interceptors and log sanitization

**Layers:**

1. **Axios interceptor** (prevents credentials in error objects)
2. **Log sanitization** (prevents credentials in log messages)
3. **Error wrapping** (custom error class strips sensitive data)

**Implementation:**

```typescript
class SanitizedError extends Error {
  constructor(message: string, originalError: unknown) {
    super(message);
    this.name = "SanitizedError";
    // Original error available for debugging but not serialized
    Object.defineProperty(this, "original", {
      value: originalError,
      enumerable: false,
      writable: false,
    });
  }
}

function sanitizeForLogging(obj: unknown): unknown {
  if (typeof obj === "string") {
    return obj
      .replace(/Bearer\s+[A-Za-z0-9\-._~+\/]+=*/g, "Bearer [REDACTED]")
      .replace(/Basic\s+[A-Za-z0-9+\/=]+/g, "Basic [REDACTED]");
  }
  // ... handle objects, arrays, etc.
}
```

**Rationale:**

- Defense in depth
- Protects against multiple leak vectors
- Maintains debuggability in dev environments

### 5. ReDoS Protection

**Decision:** Use safe-regex package for pattern validation

**Implementation:**

```typescript
import safeRegex from "safe-regex";

export function validateConfig(
  config: Partial<PluginConfig>,
): ValidatedPluginConfig {
  if (config.customIssuePattern) {
    if (!safeRegex(config.customIssuePattern)) {
      throw new ConfigurationError(
        `customIssuePattern may cause ReDoS (Regular Expression Denial of Service): ${config.customIssuePattern}`,
      );
    }

    try {
      new RegExp(config.customIssuePattern);
    } catch (error) {
      throw new ConfigurationError(
        `Invalid customIssuePattern: ${error.message}`,
      );
    }
  }
  // ...
}
```

**Rationale:**

- Prevents CPU exhaustion attacks
- Minimal overhead
- Industry standard tool

### 6. Structured Logging

**Decision:** Enhance existing logger with context objects

**Pattern:**

```typescript
interface LogContext {
  correlationId?: string;
  operation?: string;
  duration?: number;
  issueCount?: number;
  success?: boolean;
  errorCode?: string;
  statusCode?: number;
  [key: string]: unknown;
}

class StructuredLogger {
  constructor(
    private baseLogger: Logger,
    private correlationId: string,
  ) {}

  log(message: string, context?: LogContext) {
    const fullContext = {
      ...context,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
    };

    this.baseLogger.log(`${message} ${JSON.stringify(fullContext)}`);
  }

  // Similar for error, success, etc.
}
```

**Rationale:**

- Backward compatible with semantic-release logger
- Parseable by log aggregation systems
- Adds context without changing API
- Optional - degrades gracefully

**Alternative Considered:** Replace with pino

- Rejected: Adds dependency, not needed for this use case

### 7. Testing Strategy Expansion

**Decision:** Three-tier testing with comprehensive coverage

**Tier 1: Unit Tests (Existing + Enhancements)**

- All individual functions
- Edge cases and error paths
- Mocked dependencies

**Tier 2: Integration Tests (NEW - CRITICAL)**

```typescript
describe("SemanticReleaseJiraPlugin Integration", () => {
  let plugin: SemanticReleaseJiraPlugin;
  let mockContext: SemanticReleaseContext;

  beforeEach(() => {
    nock("https://jira.example.com")
      .get("/rest/api/2/myself")
      .reply(200, { username: "test" });

    plugin = new SemanticReleaseJiraPlugin();
    mockContext = createMockContext();
  });

  test("verifyConditions validates config and credentials", async () => {
    await plugin.verifyConditions(validConfig, mockContext);
    expect(mockContext.logger.success).toHaveBeenCalledWith(
      "Jira authentication verified",
    );
  });

  test("analyzeCommits collects and verifies issues", async () => {
    nock("https://jira.example.com")
      .get("/rest/api/2/issue/PROJECT-123")
      .reply(200, { key: "PROJECT-123" });

    await plugin.analyzeCommits(validConfig, mockContext);
    // Assertions
  });

  // Tests for generateNotes, success hooks
});
```

**Tier 3: E2E Tests (NEW - Manual/CI)**

- Real Jira test instance
- Real GitHub repository
- Full release cycle simulation
- Run in CI with test credentials

**Rationale:**

- Catches integration bugs before production
- Validates HTTP client configuration
- Tests error handling paths
- Documents expected behavior

### 8. Type Safety Improvements

**Decision:** Create validated config type and result discriminated unions

**Validated Config:**

```typescript
export interface ValidatedPluginConfig {
  // Required after validation
  jiraServerUrl: string;

  // Optional with defaults
  transitionIssues: boolean;
  createVersions: boolean;
  timeout: number;
  retries: number;
  concurrency: number;

  // Optional
  jiraUsername?: string;
  jiraApiToken?: string;
  transitionToStatus?: string;
  versionPrefix?: string;
  customIssuePattern?: string;
}
```

**Result Types:**

```typescript
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Usage
async function transitionIssueToDone(
  client: HttpClient,
  issueKey: string,
): Promise<Result<void, string>> {
  try {
    // ... transition logic
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

**Rationale:**

- Eliminates unsafe type assertions
- Makes error handling explicit
- Improves IDE autocomplete
- Prevents runtime type errors

### 9. URL Encoding

**Decision:** Use URL constructor with proper encoding

**Implementation:**

```typescript
export function generateIssueUrl(
  jiraServerUrl: string,
  issueKey: string,
): string {
  try {
    const url = new URL(jiraServerUrl);
    url.pathname = `/browse/${encodeURIComponent(issueKey)}`;
    return url.toString();
  } catch (error) {
    // Fallback to string concatenation if URL parsing fails
    return `${jiraServerUrl}/browse/${encodeURIComponent(issueKey)}`;
  }
}
```

**Rationale:**

- Prevents XSS in markdown
- Handles special characters correctly
- Validates URL structure
- Graceful fallback

### 10. Configuration Expansion

**Decision:** Add new optional configuration for reliability features

**New Fields:**

```typescript
export interface PluginConfig {
  // Existing fields...

  // NEW - Reliability
  timeout?: number; // HTTP timeout in ms (default: 30000)
  retries?: number; // Retry attempts (default: 3)
  retryDelay?: number; // Initial retry delay in ms (default: 1000)
  concurrency?: number; // Max concurrent requests (default: 10)

  // NEW - Features
  dryRun?: boolean; // Log actions without executing (default: false)
  failOnJiraError?: boolean; // Fail release on Jira errors (default: false)

  // NEW - TLS
  rejectUnauthorized?: boolean; // Validate SSL certificates (default: true)
  caCerts?: string[]; // Custom CA certificates
}
```

**Defaults Philosophy:**

- Safe defaults that work for 80% of users
- All reliability features enabled by default
- Allow opt-out for advanced users

## Risks / Trade-offs

### Risk: Breaking Changes in Plugin Export

**Mitigation:**

- Support both default export (class) and named exports (functions)
- Provide migration guide
- Mark old exports as deprecated with warnings
- Keep for 2-3 major versions before removal

### Risk: Increased Dependencies

**Mitigation:**

- Carefully evaluate each dependency
- Choose well-maintained packages
- Consider bundle size impact
- Document why each dependency is needed

### Risk: Performance Overhead from Logging/Metrics

**Mitigation:**

- Make structured logging optional
- Use fast logging libraries (pino)
- Batch metrics if using external collector
- Measure impact in benchmarks

### Risk: Retry Logic Increasing Release Time

**Mitigation:**

- Make retry count configurable
- Use exponential backoff with jitter
- Set reasonable timeout limits
- Document expected latency ranges

### Trade-off: Complexity vs Reliability

**Decision:** Favor reliability

Justification:

- Plugin blocks production releases - must be reliable
- Users prefer slower releases over failed releases
- Configuration allows tuning for specific needs
- Documentation helps users understand tradeoffs

## Migration Plan

### Phase 1: Critical Fixes (This Change)

1. Remove module-level state
2. Add HTTP timeouts and retry
3. Implement credential sanitization
4. Add rate limiting
5. Create integration tests
6. Add ReDoS protection

### Phase 2: Observability (Next Release)

1. Structured logging
2. Metrics/telemetry interfaces
3. Performance tracking
4. Enhanced error context

### Phase 3: Advanced Features (Future)

1. Circuit breaker
2. Dry-run mode
3. Advanced configuration
4. Monitoring examples

### Backward Compatibility Strategy

**Plugin Export:**

```typescript
// New (recommended)
export default class SemanticReleaseJiraPlugin {
  /*...*/
}

// Old (deprecated but supported)
export const verifyConditions = (...args) =>
  new SemanticReleaseJiraPlugin().verifyConditions(...args);
// ... other exports
```

**Configuration:**

```typescript
// All new fields optional with sensible defaults
// Existing configs continue to work unchanged
```

### Rollback Plan

If critical bugs found after release:

1. Revert to previous version via npm
2. No data migration needed (stateless plugin)
3. Configuration is forward-compatible
4. Document known issues and workarounds

## Open Questions

1. **Should we add circuit breaker in initial release or defer?**
   - Answer: Defer to Phase 3 - retry + timeout + concurrency limiting sufficient for initial release

2. **Which structured logging format?**
   - Answer: JSON with standard fields (timestamp, level, message, context)
   - Keep format simple and parseable

3. **Should plugin fail fast or retry indefinitely?**
   - Answer: Fail after N retries (default 3) - prefer fast failure over hanging
   - Make configurable via `failOnJiraError` flag

4. **How to handle version conflicts in concurrent releases?**
   - Answer: Idempotent version creation (use existing if found)
   - Already partially implemented, add better error handling

5. **Should we provide metrics interface or implementation?**
   - Answer: Interface only - let users choose their metrics backend
   - Provide console logger implementation as example
