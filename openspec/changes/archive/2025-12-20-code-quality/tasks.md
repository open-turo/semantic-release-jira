# Tasks: Code Quality Improvements

## Phase 1: Quick Wins (Low Risk, High Impact)

### Task 1: Add Semantic-Release Peer Dependency (CRITICAL)

**Priority**: CRITICAL
**Estimate**: 5 minutes
**Dependencies**: None

**Work Items**:

1. Add `peerDependencies` section to `package.json`
   - Add `"semantic-release": ">=23.0.0"`
2. Add `semantic-release` to `devDependencies` for testing
   - Use latest stable version (e.g., `^24.2.0`)
3. Run `npm install` to update lockfile
4. Verify no breaking changes in package resolution

**Validation**:

- `npm install` succeeds without errors
- `package.json` contains both `peerDependencies` and `devDependencies` entries
- Peer dependency warning shown if semantic-release not installed in consuming project

---

### Task 2: Silence Pino Logs During Tests (HIGH)

**Priority**: HIGH
**Estimate**: 10 minutes
**Dependencies**: None

**Work Items**:

1. Update `src/utils/logger.ts` constructor
   - Check `process.env.NODE_ENV`
   - Set Pino level to `'silent'` when `NODE_ENV === 'test'`
2. Verify `vitest.config.ts` sets `NODE_ENV=test` in env
3. Run tests and verify no Pino JSON output
4. Update tests if any explicitly verify log output

**Validation**:

- `npm test` produces clean output with no JSON logs
- Test results are clearly visible
- All 362 tests still pass

---

## Phase 2: Lint Fixes (TypeScript Safety)

### Task 3: Add Type Guards to Plugin Class (CRITICAL)

**Priority**: CRITICAL
**Estimate**: 1 hour
**Dependencies**: None

**Work Items**:

1. Add `ensureInitialized()` type guard method to `SemanticReleaseJiraPlugin` class
   ```typescript
   private ensureInitialized(): asserts this is this & {
     config: ValidatedPluginConfig;
     logger: StructuredLogger;
     rateLimiter: ReturnType<typeof pLimit>;
     collectedIssues: JiraIssue[];
   } {
     if (!this.config || !this.logger || !this.rateLimiter) {
       throw new Error('Plugin not initialized - verifyConditions must be called first');
     }
   }
   ```
2. Call `this.ensureInitialized()` at the start of each lifecycle method:
   - `analyzeCommits()`
   - `generateNotes()`
   - `success()`
3. Remove optional chaining (`?.`) after type guard calls
4. Run TypeScript compiler to verify errors are resolved

**Validation**:

- `npm run check-types` shows significantly fewer errors
- All tests pass
- Runtime behavior unchanged

---

### Task 4: Fix Remaining TypeScript Safety Issues (HIGH)

**Priority**: HIGH
**Estimate**: 2 hours
**Dependencies**: Task 3

**Work Items**:

1. Fix unsafe type assertions in test files
   - Replace `as any` with proper types
   - Use type guards where needed
2. Fix `@typescript-eslint/restrict-template-expressions` in `src/config/validate.ts`
   - Ensure template literal expressions have proper types
3. Fix unsafe member access in HTTP client error handler
   - Add proper type guards for axios error properties
4. Fix unsafe member access in test files
   - Add proper type assertions for nock responses
5. Fix `@typescript-eslint/prefer-promise-reject-errors` in HTTP client
   - Ensure rejected promises use Error objects

**Validation**:

- `npm run check-types` shows 0 TypeScript errors
- All tests pass
- No runtime behavior changes

---

## Phase 3: Lint Fixes (Style and Convention)

### Task 5: Fix Style and Naming Issues (MEDIUM)

**Priority**: MEDIUM
**Estimate**: 30 minutes
**Dependencies**: Tasks 3, 4

**Work Items**:

1. Rename `isUnexpandedEnvVar` to `isUnexpandedEnvironmentVariable`
   - Update function name in `src/config/validate.ts`
   - Update all call sites
   - Update tests
2. Fix `unicorn/import-style` for node imports
   - Change `import path from 'node:path'` to use named imports if required
3. Fix `unicorn/text-encoding-identifier-case`
   - Change `'utf-8'` to `'utf8'` in HTTP client
4. Fix `unicorn/no-null` in test files
   - Replace `null` with `undefined` where appropriate
5. Fix `import/no-default-export` in `src/index.ts`
   - Use named export for plugin class
   - Keep default export for backward compatibility

**Validation**:

- `npm run lint` shows reduced error count
- All tests pass
- No breaking changes to public API

---

### Task 6: Refactor Cognitive Complexity (MEDIUM)

**Priority**: MEDIUM
**Estimate**: 1 hour
**Dependencies**: Tasks 3, 4

**Work Items**:

1. Extract validation logic from `validatePluginConfig()` in `src/config/validate.ts`
   - Create `validateCredentials(config)` helper
   - Create `validateTransitionConfig(config)` helper
   - Create `validateVersionConfig(config)` helper
   - Create `validateCustomPattern(config)` helper
2. Update main function to call helpers sequentially
3. Ensure each helper function has complexity ≤15
4. Update tests to cover new helper functions

**Validation**:

- `npm run lint` shows cognitive complexity resolved
- All validation tests pass
- Behavior identical to original implementation

---

## Phase 4: Test Quality Fixes

### Task 7: Fix Test Quality Issues (MEDIUM)

**Priority**: MEDIUM
**Estimate**: 30 minutes
**Dependencies**: None

**Work Items**:

1. Add assertions to tests missing `expect()` calls
   - `test/integration/plugin.test.ts`: Add `expect(nock.isDone()).toBe(true)` where appropriate
   - Add explicit assertions for state changes
2. Convert `.skip()` tests to `.todo()`
   - Update test descriptions to clearly state what needs fixing
3. Fix nock import warnings
   - Change to named imports: `import { disableNetConnect, cleanAll } from 'nock'`
4. Move helper functions to outer scope
   - Move `createMockContext` and `expectLogContains` to module level
5. Fix hardcoded password warnings
   - Add `/* eslint-disable sonarjs/no-hardcoded-passwords */` to test fixtures
6. Fix code-eval warnings for javascript: URLs
   - Add `/* eslint-disable sonarjs/code-eval */` to XSS prevention tests

**Validation**:

- `npm run lint` shows 0 errors
- All tests pass
- Test assertions verify expected behavior

---

## Phase 5: Test Performance Optimization

### Task 8: Reduce Test Timeouts (MEDIUM)

**Priority**: MEDIUM
**Estimate**: 15 minutes
**Dependencies**: Task 2 (so we can see timing clearly)

**Work Items**:

1. Audit current test timeouts
   - Identify tests with 30-second timeouts
   - Measure actual execution time
2. Reduce timeouts for tests that complete quickly
   - Integration tests: 30s → 10s (mocked requests should be fast)
   - HTTP client tests: Keep higher timeouts for retry tests
3. Update timeout configurations in test files
4. Run tests multiple times to verify no flakiness

**Validation**:

- All tests pass consistently
- No timeout failures
- Test duration reduced

---

### Task 9: Optimize Retry Tests with Mock Timers (MEDIUM)

**Priority**: MEDIUM
**Estimate**: 45 minutes
**Dependencies**: Task 8

**Work Items**:

1. Identify tests that verify exponential backoff
   - `test/http/client.test.ts`: "should increase delay between retries exponentially"
   - Other retry-related tests
2. Implement mock timers using Vitest
   ```typescript
   vi.useFakeTimers();
   // ... test code ...
   await vi.advanceTimersByTimeAsync(expectedDelay);
   vi.useRealTimers();
   ```
3. Update tests to use mock timers instead of real delays
4. Verify backoff logic is still tested correctly

**Validation**:

- Retry tests complete in <1 second instead of multiple seconds
- Backoff logic is properly verified
- All tests pass

---

### Task 10: Verify and Optimize Parallel Execution (LOW)

**Priority**: LOW
**Estimate**: 15 minutes
**Dependencies**: Tasks 8, 9

**Work Items**:

1. Review `vitest.config.ts` for parallel execution settings
2. Ensure `pool: 'threads'` is configured
3. Configure appropriate `maxThreads` (e.g., 4)
4. Run tests and measure duration
5. Verify all tests pass with parallel execution

**Validation**:

- Test duration under 20 seconds
- No race conditions or flaky tests
- Consistent results across multiple runs

---

### Task 11: Verify No Actual Semantic-Release Execution (LOW)

**Priority**: LOW
**Estimate**: 10 minutes
**Dependencies**: None

**Work Items**:

1. Search for actual semantic-release invocations
   ```bash
   rg "require.*semantic-release" test/
   rg "import.*semantic-release" test/
   ```
2. If found, replace with mocks
3. Verify all tests use plugin lifecycle methods directly
4. Ensure no subprocess executions of semantic-release

**Validation**:

- No actual semantic-release CLI executions found
- All tests are unit/integration tests with proper mocks
- Test duration not impacted by external process overhead

---

## Task Ordering and Parallelization

**Sequential Work** (must be done in order):

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

**Within Phases** (can be parallelized):

- Phase 2: Tasks 3 and 4 can be done separately but Task 4 is easier after Task 3
- Phase 3: Tasks 5 and 6 can be done in parallel
- Phase 4: Task 7 is independent
- Phase 5: Tasks 8, 9, 10, 11 are mostly independent but easier sequentially

**Critical Path**: Phase 1 (quick) → Phase 2 (TypeScript) → Phase 3 (style) → Phase 4 (tests) → Phase 5 (performance)

**Estimated Total Time**: 6-8 hours

---

## Definition of Done

Each task is considered complete when:

1. Implementation is correct and tested
2. `npm run lint` passes (for lint tasks)
3. `npm test` passes with all 362 tests
4. No regression in functionality
5. Performance targets met (for performance tasks)

The entire change is complete when:

1. All 11 tasks are marked done
2. `npm run lint` shows 0 errors, 0 warnings
3. `npm test` produces clean output with no JSON logs
4. Test duration is under 20 seconds
5. `semantic-release` is declared as peer dependency >=23.0.0
6. All 362 tests pass
7. No breaking changes introduced

---

## Success Metrics

**Before**:

- Lint errors: 224
- Lint warnings: 20
- Test duration: ~34 seconds
- Test output: Hundreds of lines of JSON logs
- Peer dependencies: None

**After**:

- Lint errors: 0 ✅
- Lint warnings: 0 ✅
- Test duration: <20 seconds ✅
- Test output: Clean, readable ✅
- Peer dependencies: semantic-release >=23.0.0 ✅
