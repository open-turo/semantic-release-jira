# Design: Code Quality Improvements

## Architecture Overview

Four independent improvements that enhance code quality, developer experience, and dependency management:

1. **Lint Error Resolution**: Fix TypeScript safety, style, and test quality issues
2. **Test Output Cleanup**: Configure Pino to be silent during tests
3. **Test Performance Optimization**: Reduce test duration by >40%
4. **Peer Dependency Declaration**: Add semantic-release as peer dependency

## Component Design

### 1. Lint Error Resolution Strategy

#### TypeScript Safety Fixes (~180 errors)

**Problem**: Extensive use of `any` types and unsafe operations in `src/index.ts`

**Root Cause**: The plugin class uses `this.config`, `this.logger`, etc. but TypeScript can't verify they're initialized before use.

**Solution 1: Type Guards** (Recommended)

```typescript
export default class SemanticReleaseJiraPlugin {
  private config?: ValidatedPluginConfig;
  private logger?: StructuredLogger;

  private ensureInitialized(): asserts this is this & {
    config: ValidatedPluginConfig;
    logger: StructuredLogger;
  } {
    if (!this.config || !this.logger) {
      throw new Error("Plugin not initialized");
    }
  }

  async analyzeCommits(context: any): Promise<void> {
    this.ensureInitialized(); // After this, TS knows config/logger are defined
    const timer = this.logger.startTimer(); // ✅ No error
    // ...
  }
}
```

**Solution 2: Definite Assignment Assertions** (Alternative)

```typescript
export default class SemanticReleaseJiraPlugin {
  private config!: ValidatedPluginConfig;
  private logger!: StructuredLogger;
  // ! tells TS these will be assigned before use
}
```

**Recommendation**: Use Solution 1 (type guards) for runtime safety.

#### Cognitive Complexity Reduction

**File**: `src/config/validate.ts` - `validatePluginConfig()` function

**Current**: Cognitive complexity 36 (allowed: 15)

**Strategy**: Extract nested validation logic into helper functions

**Before**:

```typescript
export function validatePluginConfig(config: unknown): ValidatedPluginConfig {
  // ... 100+ lines of nested if/else validation
  if (hasUsername) {
    if (!hasToken) {
      // ...
    }
  }
  if (transitionIssues) {
    if (!hasCredentials) {
      // ...
    }
  }
  // etc...
}
```

**After**:

```typescript
export function validatePluginConfig(config: unknown): ValidatedPluginConfig {
  validateBaseConfig(config);
  validateCredentials(config);
  validateTransitionConfig(config);
  validateVersionConfig(config);
  validateCustomPattern(config);
  return normalizeConfig(config);
}

function validateCredentials(config: RawConfig): void {
  // Extracted credential validation logic
}

function validateTransitionConfig(config: RawConfig): void {
  // Extracted transition validation logic
}
```

**Benefit**: Each function has lower complexity, easier to test and maintain.

#### Test Quality Fixes

**Missing Assertions** (vitest/expect-expect):

- Some tests verify behavior through side effects (nock mocks consumed)
- **Solution**: Add explicit `expect()` calls or use `// @ts-expect-error` suppression with comment

**Disabled Tests** (vitest/no-disabled-tests):

- Two tests use `.skip()` with TODO comments
- **Solution**: Convert to `.todo()` with clear description of what needs fixing

### 2. Test Output Cleanup

#### Current Behavior

Pino outputs structured JSON logs during tests:

```json
{"level":30,"time":1766190157758,"correlationId":"test-correlation-id","msg":"Test message"}
{"level":30,"time":1766190157760,"correlationId":"cd3a5c09-3e02-42ac-a579-02cfe35ce7b1","msg":"Test message"}
```

This creates hundreds of lines of noise during test runs.

#### Solution: Environment-Based Log Level

**Implementation** (`src/utils/logger.ts`):

```typescript
export class StructuredLogger {
  private logger: pino.Logger;

  constructor(
    private baseLogger: Logger,
    correlationId?: string,
  ) {
    this.logger = pino({
      level: process.env.NODE_ENV === "test" ? "silent" : "info",
      base: { correlationId: correlationId ?? crypto.randomUUID() },
      serializers: noir(redactPaths, "[REDACTED]"),
    });
  }
}
```

**Test Configuration** (`vitest.config.ts`):

```typescript
export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
    },
    // ... other config
  },
});
```

**Alternative**: Use `pino.destination('/dev/null')` to completely discard logs during tests.

**Benefits**:

- Clean test output
- Faster test execution (no I/O)
- Easier debugging
- No changes to production logging

### 3. Test Performance Optimization

#### Current Performance

```
Test Files  19 passed (19)
Tests       362 passed | 2 skipped (364)
Duration    ~34 seconds
```

**Target**: Under 20 seconds (>40% improvement)

#### Performance Analysis

**Suspected Bottlenecks**:

1. Integration tests with long timeouts (30-34 seconds for `test/integration/plugin.test.ts`)
2. Network retry logic in HTTP client tests (10-11 seconds for `test/http/client.test.ts`)
3. Unnecessary delays in mocked responses

#### Optimization Strategies

**Strategy 1: Reduce Test Timeouts**

Current integration tests use 30-second timeouts. Most complete much faster.

```typescript
// Before
it("should handle network errors", async () => {
  // ...
}, 30000); // 30 second timeout

// After
it("should handle network errors", async () => {
  // ...
}, 10000); // 10 second timeout (still plenty for mocked requests)
```

**Strategy 2: Optimize Retry Tests**

HTTP client tests that verify exponential backoff are slow because they actually wait for delays.

```typescript
// Before - waits for actual delays
it("should increase delay between retries exponentially", async () => {
  // Actually waits: 100ms, 200ms, 400ms = 700ms minimum
});

// After - mock timers or reduce delay base
it("should increase delay between retries exponentially", async () => {
  vi.useFakeTimers();
  // ... fast test ...
  vi.useRealTimers();
});
```

**Strategy 3: Parallel Test Execution**

Ensure Vitest is configured for maximum parallelism:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 2,
      },
    },
  },
});
```

**Strategy 4: Remove Actual Semantic-Release Executions**

Verify that no tests are actually running semantic-release (they should all be unit/integration tests with mocks).

```bash
# Check for actual semantic-release invocations
rg "require.*semantic-release" test/
```

If found, replace with mocks.

**Expected Results**:

- Integration tests: 34s → ~15s (reduce timeouts, optimize mocks)
- HTTP client tests: 11s → ~5s (mock timers for retry tests)
- Other tests: minimal impact
- **Total**: 34s → ~18-20s

### 4. Peer Dependency Declaration

#### Current State

```json
{
  "dependencies": {
    "@octokit/rest": "21.0.2"
    // ... other deps
  },
  "devDependencies": {
    // ... dev deps
  }
  // No peerDependencies
}
```

#### Proposed State

```json
{
  "dependencies": {
    "@octokit/rest": "21.0.2"
    // ... other deps
  },
  "peerDependencies": {
    "semantic-release": ">=23.0.0"
  },
  "devDependencies": {
    "semantic-release": "^24.2.0" // Example version for testing
    // ... other dev deps
  }
}
```

#### Version Selection Rationale

**semantic-release >=23.0.0**:

- v23 introduced Node.js 20+ requirement (matches our engine requirement)
- Latest stable major version
- Provides modern plugin API
- Balances compatibility with modernity

**Alternative Considerations**:

- `>=22.0.0`: Broader compatibility but includes older practices
- `>=20.0.0`: Very broad but may not support all features we use
- `^23.0.0`: Too restrictive, doesn't allow v24+

**Recommendation**: Use `>=23.0.0` for forward compatibility while maintaining stability.

## Trade-offs and Decisions

### Decision 1: Type Guards vs Definite Assignment

**Chosen**: Type guards with `ensureInitialized()`

**Alternatives**:

1. Definite assignment assertions (`!`)
   - ❌ No runtime safety
   - ✅ Simpler code
   - ❌ Can mask real bugs

2. Make properties required and initialize in constructor
   - ❌ Would require refactoring plugin initialization
   - ❌ semantic-release plugins use lifecycle hooks, not constructors
   - ✅ Most type-safe

**Rationale**: Type guards provide both compile-time and runtime safety without major refactoring.

### Decision 2: Silent Logs vs Formatted Logs in Tests

**Chosen**: Completely silent (`level: 'silent'`)

**Alternatives**:

1. Use pino-pretty for readable logs
   - ❌ Still creates output noise
   - ✅ Useful for debugging failing tests
   - ❌ Slows down test execution

2. Log to file during tests
   - ❌ Added complexity
   - ❌ File I/O overhead
   - ✅ Preserves logs for debugging

**Rationale**: Clean console output is highest priority. Developers can enable logs temporarily for debugging if needed.

### Decision 3: Aggressive vs Conservative Test Optimization

**Chosen**: Balanced approach (reduce timeouts, mock timers, parallel execution)

**Alternatives**:

1. Aggressive optimization (remove all integration tests, use only unit tests)
   - ❌ Loses confidence in real-world behavior
   - ✅ Fastest tests
   - ❌ May miss integration bugs

2. Conservative (only reduce timeouts)
   - ❌ Minimal improvement
   - ✅ Zero risk
   - ❌ Won't hit <20 second target

**Rationale**: Balanced approach maintains test quality while achieving performance goals.

## Implementation Sequence

### Phase 1: Quick Wins (Low Risk, High Impact)

1. Add peer dependency (5 min)
2. Silence Pino in tests (10 min)
3. Run tests to verify output is clean

### Phase 2: Lint Fixes (Medium Risk, High Value)

4. Fix TypeScript safety issues with type guards (2-3 hours)
5. Fix style and convention issues (1 hour)
6. Refactor cognitive complexity (1 hour)
7. Fix test quality issues (30 min)

### Phase 3: Test Performance (Medium Risk, Medium Value)

8. Reduce test timeouts (15 min)
9. Mock timers in retry tests (30 min)
10. Verify parallel execution config (15 min)
11. Measure and validate <20 second target

## Validation Strategy

**Lint Validation**:

```bash
npm run lint # Should show 0 errors, 0 warnings
```

**Test Output Validation**:

```bash
npm test # Should show clean output, no JSON logs
```

**Test Performance Validation**:

```bash
time npm test # Should complete in <20 seconds
```

**Peer Dependency Validation**:

```bash
npm info semantic-release version # Verify compatibility
npm install # Should show peer dependency warnings if not installed
```

## Risk Assessment

**Low Risk**:

- Peer dependency addition (non-breaking)
- Pino silence configuration (no production impact)

**Medium Risk**:

- TypeScript safety fixes (potential logic changes)
- Cognitive complexity refactoring (behavior must remain identical)
- Test timeout reductions (must not cause flaky tests)

**Mitigation**:

- Comprehensive test coverage validates behavior preservation
- Manual testing of critical flows
- Gradual rollout with monitoring
