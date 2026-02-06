# Spec Delta: test-quality (Test Consolidation)

## MODIFIED Requirements

### Requirement: Test Verbosity Reduction

The integration test file `test/integration/environment-config.test.ts` SHALL be consolidated to reduce verbosity by 40-50% (from 710 lines to ~350-400 lines) while maintaining test coverage and quality. The current test file contains significant redundancy with repetitive mock setup, similar test scenarios, and verbose assertions. Consolidation improves maintainability without sacrificing coverage.

#### Scenario: Integration test file size reduction

**Given** `test/integration/environment-config.test.ts` currently has 710 lines
**When** tests are consolidated
**Then** the file SHALL be reduced to approximately 350-400 lines (40-50% reduction)
**And** all unique test scenarios SHALL be preserved
**And** test coverage percentage SHALL be maintained or improved
**And** all tests SHALL pass

---

#### Scenario: Parameterized tests replace repetitive scenarios

**Given** multiple tests verify similar behavior with different input values
**When** consolidating tests
**Then** similar tests SHALL be combined using `it.each()` parameterization
**And** test data SHALL be defined in tables
**And** mock setup SHALL be shared across test iterations
**And** assertions SHALL verify the same behavior for each parameter set

**Example**:

```typescript
// Before: 3 separate tests (~78 lines)
it("should override transitionIssues via env var", async () => {
  // 26 lines of setup + mocks + assertions
});
it("should override createVersions via env var", async () => {
  // 26 lines of setup + mocks + assertions
});
it("should override dryRun via env var", async () => {
  // 26 lines of setup + mocks + assertions
});

// After: 1 parameterized test (~20 lines)
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
    // Shared setup and assertions
  },
);
```

**Coverage**: Same behavior tested, 75% less code

---

### Requirement: Mock Utilities Library Usage

Integration tests SHALL leverage existing mock utilities from `test/mocks/` instead of manual nock setup to reduce code duplication and improve maintainability. The test file currently contains repetitive nock() setup code that duplicates functionality already available in mock utilities, increasing maintenance burden. Using the utilities eliminates this duplication.

#### Scenario: Use mockJiraFullWorkflow for complete scenarios

**Given** a test requires full Jira workflow mocking (auth + issues + transitions + versions)
**When** setting up test mocks
**Then** the test SHALL use `mockJiraFullWorkflow()` from `test/mocks/jira-mocks.ts`
**And** manual nock() setup SHALL be eliminated
**And** mock configuration SHALL be passed via options object

**Example**:

```typescript
// Before: Manual nock setup (~30 lines)
const authScope = nock(jiraServerUrl)
  .get('/rest/api/2/myself')
  .reply(200, { emailAddress: jiraUsername });

const issueScope = nock(jiraServerUrl)
  .get('/rest/api/2/issue/PROJ-123?fields=key')
  .reply(200, { key: 'PROJ-123' })
  .get('/rest/api/2/issue/PROJ-456?fields=key')
  .reply(200, { key: 'PROJ-456' });

const transitionScope = nock(jiraServerUrl)
  .get('/rest/api/2/issue/PROJ-123/transitions')
  .reply(200, { transitions: [...] })
  .post('/rest/api/2/issue/PROJ-123/transitions')
  .reply(204)
  // ... repeat for PROJ-456

// After: Using mock utility (~5 lines)
const scopes = mockJiraFullWorkflow({
  serverUrl: jiraServerUrl,
  username: jiraUsername,
  includeTransitions: true,
  issues: [
    { key: 'PROJ-123', summary: 'Test summary' },
    { key: 'PROJ-456', summary: 'Test summary 2' },
  ],
});
```

**Coverage**: Identical behavior, 85% less code

---

#### Scenario: Use specific mock utilities for partial workflows

**Given** a test requires only specific Jira API interactions
**When** setting up test mocks
**Then** the test SHALL use specific utilities:

- `mockJiraAuth()` for authentication only
- `mockJiraIssueVerification()` for issue existence checks
- `mockJiraTransitions()` for transition workflows
- `mockJiraVersionCreation()` for version creation
  **And** utilities SHALL be combined as needed
  **And** manual nock() setup SHALL be eliminated

---

### Requirement: Simplified Test Assertions

Integration tests SHALL use existing test helper utilities for assertions instead of manual checking to reduce code duplication and improve readability. The test file contains repetitive assertion patterns (log checking, nock verification) that can be simplified with helpers like `expectLogContains()` and `expectAllScopesAreDone()`.

#### Scenario: Use expectLogContains for log verification

**Given** a test needs to verify log output
**When** asserting log messages
**Then** the test SHALL use `expectLogContains(logger, text)` from `test/mocks/test-helpers.ts`
**And** manual log checking SHALL be eliminated

**Example**:

```typescript
// Before: Manual log checking
const logCalls = context.logger.log.mock.calls;
const successCalls = context.logger.success.mock.calls;
const allCalls = [...logCalls, ...successCalls];
const found = allCalls.some((call) =>
  call[0].includes("configuration validated"),
);
expect(found).toBe(true);

// After: Using helper
expectLogContains(context.logger, "configuration validated");
```

---

#### Scenario: Use expectAllScopesAreDone for nock verification

**Given** a test uses multiple nock scopes
**When** verifying all mocks were called
**Then** the test SHALL use `expectAllScopesAreDone(scopes)` from `test/mocks/test-helpers.ts`
**And** manual scope.isDone() checks SHALL be eliminated

**Example**:

```typescript
// Before: Manual checking
expect(authScope.isDone()).toBe(true);
expect(issueScope.isDone()).toBe(true);
expect(transitionScope.isDone()).toBe(true);

// After: Using helper
expectAllScopesAreDone([authScope, issueScope, transitionScope]);
```

---

### Requirement: Removal of Redundant Test Scenarios

Redundant test scenarios that don't add unique value beyond what other tests already verify SHALL be identified and removed or consolidated. Multiple tests currently verify essentially the same behavior with minor variations, creating maintenance overhead without coverage benefit. At least one test per unique validation rule SHALL be kept to maintain coverage.

#### Scenario: Consolidate tests verifying same behavior

**Given** multiple tests verify the same underlying behavior
**And** tests differ only in non-meaningful ways (different variable names, slightly different setup)
**When** consolidating tests
**Then** redundant tests SHALL be removed or merged
**And** at least one test per unique validation rule SHALL be kept
**And** test coverage percentage SHALL not decrease

**Example**:

```typescript
// Tests verifying "env vars override config" behavior:
// Before: 6 tests checking same override mechanism for different fields
it("should use env var to override server URL from config", async () => {
  // Verifies env > config priority
});
it("should use env var to override transitionIssues", async () => {
  // Verifies env > config priority (same mechanism)
});
it("should use env var to override dryRun", async () => {
  // Verifies env > config priority (same mechanism)
});
it("should use env var to override createVersions", async () => {
  // Verifies env > config priority (same mechanism)
});
// ... 2 more similar tests

// After: 1 parameterized test covering all cases
it.each([
  ["serverUrl", "SERVER_URL", "https://new.atlassian.net"],
  ["transitionIssues", "TRANSITION_ISSUES", "true"],
  ["dryRun", "DRY_RUN", "true"],
  ["createVersions", "CREATE_VERSIONS", "true"],
])(
  "should override %s from config via env var",
  async (field, envKey, envValue) => {
    // Single implementation testing override mechanism for all fields
  },
);
```

---

### Requirement: Improved Test Organization

Test structure SHALL be reorganized for better logical grouping and readability by grouping tests by concern rather than scenario numbers. Current test structure uses scenario numbers (Scenario 1, Scenario 2, etc.) which don't clearly communicate what's being tested. Tests SHALL be grouped by what they validate (Environment Variable Overrides, Full Workflow Tests, Credential Validation, Edge Cases) instead.

#### Scenario: Tests grouped by concern

**Given** tests in `environment-config.test.ts`
**When** reorganizing test structure
**Then** tests SHALL be grouped by what they validate:

- **Environment Variable Overrides**: Tests verifying env vars override config
- **Full Workflow Tests**: Tests verifying complete plugin execution
- **Credential Validation**: Tests verifying credential requirements
- **Edge Cases and Error Handling**: Tests for error conditions

**And** scenario numbering (Scenario 1, Scenario 2, etc.) SHALL be removed
**And** describe blocks SHALL use descriptive names matching the concern
**And** test organization SHALL improve code navigation and understanding

**Example**:

```typescript
// Before: Scenario-based organization
describe("Scenario 1: Plugin works with only env vars (no config file)", () => {
  // Tests
});
describe("Scenario 2: Plugin works with mixed env vars and config", () => {
  // Tests
});
describe("Scenario 3: Env vars override config in real plugin execution", () => {
  // Tests
});

// After: Concern-based organization
describe("Environment Variable Overrides", () => {
  describe("Boolean field overrides", () => {
    /* parameterized tests */
  });
  describe("String field overrides", () => {
    /* parameterized tests */
  });
  describe("Numeric field overrides", () => {
    /* parameterized tests */
  });
});

describe("Full Workflow Tests", () => {
  it("should work with env vars only", async () => {
    /* ... */
  });
  it("should work with mixed config and env vars", async () => {
    /* ... */
  });
  it("should work with shared config and runtime credentials", async () => {
    /* ... */
  });
});

describe("Credential Validation", () => {
  it("should fail when credentials required but missing", async () => {
    /* ... */
  });
  it("should validate credentials in HTTP headers", async () => {
    /* ... */
  });
});

describe("Edge Cases and Error Handling", () => {
  // Error scenarios
});
```

---

## REMOVED Requirements

None. All existing requirements are maintained.

## ADDED Requirements

None. This is a test refactoring change focused on maintainability.

---

## Implementation Impact

### Files Modified

- `test/integration/environment-config.test.ts` - Consolidated from 710 to ~350-400 lines

### Test Coverage

- **Before**: 100% coverage of environment variable override behavior
- **After**: 100% coverage maintained with improved maintainability

### Test Execution

- **Before**: ~710 lines, some redundant test execution
- **After**: ~350-400 lines, streamlined execution
- **Performance**: Expected improvement or no change in execution time

### Breaking Changes

None. This is a test-only change with no impact on production code.

---

## Success Metrics

1. **Code Reduction**:
   - ✅ File size reduced from 710 to 350-400 lines (40-50%)

2. **Quality Maintained**:
   - ✅ All tests passing
   - ✅ Test coverage percentage maintained or improved
   - ✅ No flaky tests introduced

3. **Maintainability Improved**:
   - ✅ Mock utilities properly utilized
   - ✅ Parameterized tests reduce duplication
   - ✅ Clear test organization by concern
   - ✅ Simplified assertions with helpers

4. **Documentation**:
   - ✅ Test intent clear from test names
   - ✅ Parameterized test tables self-documenting

---

## Cross-References

- Related to "Mock Utilities Library" requirement (proper utilization)
- Related to "Test Verbosity Reduction" requirement (consolidation)
- Related to "Overall Test Suite Improvement" requirement (maintainability)
- Aligns with "Test Coverage Preservation" requirement (no reduction in coverage)

---

## Risk Assessment

**Low Risk**:

- Test-only changes
- No impact on production code
- Easy to verify (test pass/fail)
- Rollback straightforward

**Validation**:

- Run full test suite before and after
- Compare coverage reports
- Verify test execution time

---

## Notes

- Focus on combining similar tests using `it.each()`
- Leverage `mockJiraFullWorkflow()` wherever possible
- Use assertion helpers (`expectLogContains`, `expectAllScopesAreDone`)
- Remove tests that verify the same mechanism multiple times
- Keep tests focused on unique behavior
- Maintain descriptive test names even in parameterized tests
