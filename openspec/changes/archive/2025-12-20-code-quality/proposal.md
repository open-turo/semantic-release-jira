# Change: Improve Code Quality, Test Output, and Dependencies

## Why

The codebase has several quality and developer experience issues that need addressing:

1. **Linting Failures**: Running `npm run lint` produces 224 errors and 20 warnings, preventing clean builds and masking real issues. Errors include:
   - TypeScript safety violations (@typescript-eslint/no-unsafe-\* rules)
   - Style inconsistencies (unicorn rules)
   - Test quality issues (vitest rules)
   - Cognitive complexity violations (sonarjs rules)

2. **Test Output Pollution**: Tests output verbose Pino JSON logs that clutter the console, making it difficult to read test results and identify failures. Example output:

   ```json
   {"level":30,"time":1766190157758,"correlationId":"test-correlation-id",...}
   {"level":30,"time":1766190157760,"correlationId":"cd3a5c09-3e02-42ac...",...}
   ```

   This pollutes hundreds of lines during test runs.

3. **Slow Test Performance**: Test suite takes ~34 seconds to run 362 tests. This is longer than expected for a plugin of this size, potentially due to:
   - Actual HTTP requests or slow mocking
   - Inefficient test setups
   - Unnecessary integration overhead

4. **Missing Peer Dependency**: `semantic-release` is not declared as a peer dependency, which is incorrect for a semantic-release plugin. This can lead to:
   - Version conflicts in consuming projects
   - Unclear dependency requirements
   - Potential runtime errors with incompatible versions

## What Changes

### 1. Fix All Linting Errors

Resolve all 224 linting errors across the codebase:

**TypeScript Safety Issues** (majority of errors):

- Fix `@typescript-eslint/no-unsafe-assignment` violations
- Fix `@typescript-eslint/no-unsafe-member-access` violations
- Fix `@typescript-eslint/no-unsafe-call` violations
- Fix `@typescript-eslint/no-unsafe-argument` violations
- Add proper type assertions with `@typescript-eslint/consistent-type-assertions`
- Fix `@typescript-eslint/restrict-template-expressions` for template literals

**Style and Convention Issues**:

- Rename `isUnexpandedEnvVar` to `isUnexpandedEnvironmentVariable` (unicorn/prevent-abbreviations)
- Fix `import/no-default-export` by using named exports where appropriate
- Fix `unicorn/import-style` for node imports
- Fix `unicorn/text-encoding-identifier-case` (utf8 vs utf-8)
- Fix `unicorn/no-null` by using undefined instead

**Code Quality Issues**:

- Reduce cognitive complexity in `validate.ts` from 36 to ≤15 (sonarjs/cognitive-complexity)
- Move functions to outer scope (unicorn/consistent-function-scoping)
- Fix hardcoded password warnings (sonarjs/no-hardcoded-passwords) - these are test fixtures
- Fix code-eval warnings for javascript: URLs in tests (sonarjs/code-eval)

**Test Issues**:

- Add assertions to tests without expect statements (vitest/expect-expect, sonarjs/assertions-in-tests)
- Convert `.skip()` tests to `.todo()` (vitest/no-disabled-tests)
- Fix nock import warnings (import/no-named-as-default-member)

### 2. Silence Pino Logs During Tests

Configure Pino to be completely silent during test runs:

**Implementation**:

```typescript
// In src/utils/logger.ts or test setup
const logger = pino({
  level: process.env.NODE_ENV === "test" ? "silent" : "info",
  // ... other config
});
```

**Benefits**:

- Clean console output showing only test results
- Easier identification of test failures
- Faster test execution (no I/O for logs)
- Better developer experience

### 3. Optimize Test Performance

Target: Reduce test duration from ~34 seconds to under 20 seconds (>40% improvement)

**Strategies**:

- Review integration tests for unnecessary delays
- Optimize nock mocking to avoid real network overhead
- Reduce timeout configurations where possible
- Parallelize independent test suites if not already done
- Remove any actual semantic-release executions if present
- Cache expensive test setups

### 4. Add Semantic-Release Peer Dependency

Declare `semantic-release` as a peer dependency with appropriate version constraint:

**package.json**:

```json
{
  "peerDependencies": {
    "semantic-release": ">=23.0.0"
  }
}
```

**Rationale**:

- Ensures compatibility with semantic-release v23+
- Follows plugin best practices
- Prevents version conflicts
- Documents minimum required version

## Impact

- **Affected specs**: `semantic-release-jira` (updated quality requirements)
- **Affected code**:
  - All source files with TypeScript safety issues
  - `src/config/validate.ts` - cognitive complexity refactoring
  - `src/utils/logger.ts` - test environment configuration
  - Test files - add missing assertions, fix imports
  - `package.json` - add peerDependencies
- **Breaking changes**: None
  - All changes are internal quality improvements
  - Public API remains unchanged
  - Peer dependency addition is non-breaking (semantic-release is already required to use the plugin)

## Non-Goals

- Changing linting rules or disabling valid warnings
- Rewriting large portions of code for style preferences
- Removing or significantly changing test coverage
- Upgrading major dependencies beyond peer dependency declaration
