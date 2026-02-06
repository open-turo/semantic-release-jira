# Spec: semantic-release-jira

## ADDED Requirements

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

## Non-Functional Requirements

### Requirement: No Breaking Changes

All code quality improvements SHALL maintain backward compatibility with existing users and SHALL NOT introduce breaking changes to the public API.

#### Scenario: API compatibility

**Given** code quality improvements are implemented
**When** users upgrade to the new version
**Then** all existing plugin configurations SHALL continue to work
**And** all lifecycle hooks SHALL behave identically
**And** release notes format SHALL remain unchanged
**And** only internal implementation SHALL change

---

### Requirement: Preserved Test Coverage

All code quality improvements SHALL maintain or improve existing test coverage without removing or weakening tests.

#### Scenario: Test coverage maintenance

**Given** the test suite has 362 tests covering all functionality
**When** code quality improvements are implemented
**Then** all 362 tests SHALL still pass
**And** no tests SHALL be removed or disabled permanently
**And** test assertions SHALL remain comprehensive
**And** code coverage SHALL not decrease

---

### Requirement: Performance Improvement Stability

Test performance optimizations SHALL NOT introduce flakiness or instability in the test suite.

#### Scenario: Reliable fast tests

**Given** test timeouts are reduced and mock timers are used
**When** running the test suite multiple times
**Then** all tests SHALL pass consistently
**And** no random failures SHALL occur
**And** execution time SHALL be stable (±2 seconds)
**And** parallel execution SHALL not cause race conditions
