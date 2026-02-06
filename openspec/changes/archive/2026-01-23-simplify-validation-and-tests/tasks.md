# Tasks: Simplify Validation and Tests

## Phase 1: Zod Validation Migration

### 1.1 Add Zod Dependency

- [x] Install Zod: `npm install zod`
- [x] Update package.json and package-lock.json
- [x] Verify build still works: `npm run build`

### 1.2 Create Zod Schemas

- [x] Create environment variable schema (`envVarSchema`) in `src/config/validate.ts`
  - Define all 14 environment variables with proper types
  - Add boolean transformers for 'true'/'false'/'1'/'0' parsing
  - Add numeric coercion with `z.coerce.number()`
  - Add validation constraints (min, max, positive, etc.)

- [x] Create main config schema (`configSchema`) in `src/config/validate.ts`
  - Define all config fields with proper Zod types
  - Add URL validation with HTTPS enforcement
  - Add regex validation for customIssuePattern
  - Add ReDoS protection with `safeRegex` refinement
  - Add unexpanded env var detection refinements
  - Add credential requirement refinement (transitionIssues/createVersions check)

- [x] Create `transformEnvToConfig()` function
  - Map SCREAMING_SNAKE_CASE to camelCase
  - Handle all 14 environment variable mappings

### 1.3 Implement New validateConfig Function

- [x] Create new `validateConfig()` implementation
  - Parse environment variables with `envVarSchema.safeParse()`
  - Transform env vars with `transformEnvToConfig()`
  - Merge config (env overrides config file)
  - Validate merged config with `configSchema.safeParse()`
  - Format and throw errors with helpful messages

- [x] Create `formatZodError()` helper function
  - Format Zod errors into user-friendly messages
  - Match existing error message patterns where possible

### 1.4 Update Existing Helper Functions

- [x] Keep `isUnexpandedEnvironmentVariable()` as-is (still needed)
- [x] Keep `getIssuePattern()` as-is (still needed)
- [x] Keep `isValidIssueKeyFormat()` as-is (still needed)
- [x] Remove all old validation helper functions:
  - `validateRequiredFields()`
  - `validateTransitionConfig()`
  - `validateNumericFields()`
  - `validateBooleanFields()`
  - `validateCustomPattern()`
  - `validateCredentials()`
  - `loadConfigFromEnvironment()`
  - `environmentVariableToConfigKey()`

### 1.5 Update Validation Tests

- [x] Update `test/config/validate.test.ts`
  - Verify all existing tests pass with Zod implementation
  - Update test assertions if error message format changed slightly
  - Ensure ReDoS protection tests still work
  - Ensure URL validation tests still work
  - Ensure credential validation tests still work

- [x] Update `test/config/validate.environment.test.ts`
  - Verify all environment variable parsing tests pass
  - Ensure boolean parsing tests work (true/false/1/0)
  - Ensure numeric parsing tests work
  - Ensure invalid env var error messages are clear

### 1.6 Remove Envalid

- [x] Remove envalid import from `src/config/validate.ts`
- [x] Uninstall envalid: `npm uninstall envalid`
- [x] Update package.json and package-lock.json
- [x] Verify build still works: `npm run build`

### 1.7 Validation Quality Checks

- [x] Run `npm run lint` - ensure zero errors
- [x] Run `npm run check-types` - ensure zero TypeScript errors
- [x] Run `npm test` - ensure all tests pass
- [x] Check cognitive complexity of validation functions
  - `validateConfig` should be < 8
  - `formatZodError` should be < 5
  - All other helpers should be < 5
- [x] Verify test coverage maintained: run coverage report

## Phase 2: Test Consolidation

### 2.1 Analyze Current Test Structure

- [x] Read through `test/integration/environment-config.test.ts`
- [x] Identify groups of similar tests that can be parameterized
- [x] Identify tests that have redundant mock setup
- [x] Identify tests that can use `mockJiraFullWorkflow()` utility
- [x] Document test scenarios that provide unique value

### 2.2 Create Parameterized Tests

- [x] Create `it.each()` test for boolean environment variable overrides
  - Combine: transitionIssues, createVersions, dryRun override tests
  - Use table-driven approach with test data
  - Share mock setup across iterations

- [x] Create `it.each()` test for string environment variable overrides
  - Combine: serverUrl, username, token, versionPrefix override tests
  - Use table-driven approach
  - Use `mockJiraFullWorkflow()` for common mock setup

- [x] Create `it.each()` test for numeric environment variable overrides
  - Combine: timeout, retries, concurrency, retryDelay override tests
  - Use table-driven approach

- [x] Create `it.each()` test for invalid environment variable types
  - Combine: invalid boolean formats, invalid numeric formats
  - Use table-driven approach

### 2.3 Replace Manual Mocks with Utilities

- [x] Replace manual nock setup with `mockJiraFullWorkflow()` where applicable
  - "Scenario 1: Only env vars" tests
  - "Scenario 2: Mixed config" tests
  - "Scenario 5: Base config with credential override" tests
  - "Scenario 6: Shared config with env-specific behavior" tests

- [x] Replace manual auth mocks with `mockJiraAuth()` where applicable
- [x] Replace manual issue verification with `mockJiraIssueVerification()` where applicable
- [x] Replace manual transition mocks with `mockJiraTransitions()` where applicable
- [x] Replace manual version mocks with `mockJiraVersionCreation()` where applicable

### 2.4 Simplify Test Assertions

- [x] Use `expectLogContains()` helper instead of manual log checking
- [x] Use `expectAllScopesAreDone()` helper for nock verification
- [x] Remove verbose assertions that check every config field
- [x] Focus assertions on the specific behavior being tested

### 2.5 Remove Redundant Tests

- [x] Identify tests that cover the same scenario with minor variations
- [x] Consolidate or remove tests that don't add unique value
- [x] Keep at least one test per unique validation rule
- [x] Document why tests were removed (in commit message)

### 2.6 Reorganize Test Structure

- [x] Simplify describe block nesting
- [x] Group tests by what they validate (not by scenario number)
  - Environment Variable Overrides
  - Full Workflow Tests
  - Credential Validation
  - Edge Cases and Error Handling
- [x] Ensure logical flow and readability

### 2.7 Test Quality Checks

- [x] Run `npm test` - ensure all tests pass
- [x] Run coverage report - ensure no reduction in coverage percentage
  - `npm run test -- --coverage`
- [x] Verify test file reduced from 710 to ~509 lines (28% reduction)
- [x] Verify test execution time improved or maintained
- [x] Run `npm run lint` on test files - ensure zero errors
- [x] Verify all tests use proper TypeScript types

## Phase 3: Final Cleanup and Validation

### 3.1 Code Quality

- [x] Remove any unused imports across all changed files
- [x] Remove any commented-out code
- [x] Ensure consistent code style and formatting
- [x] Run `npm run lint` on entire codebase - zero errors
- [x] Run `npm run check-types` - zero TypeScript errors

### 3.2 Documentation

- [x] Update inline code comments if needed
- [x] Verify README.md still accurate (likely no changes needed)
- [x] Update CHANGELOG.md or release notes if applicable (no changes needed)

### 3.3 Comprehensive Testing

- [x] Run full test suite 3 times to check for flakiness
  - `npm test && npm test && npm test`
- [x] Run tests with coverage: `npm run test -- --coverage`
- [x] Verify test pass rate: 100% (358 tests passing, 2 skipped)
- [x] Verify test coverage maintained or improved
- [x] Run build: `npm run build` - must succeed
- [x] Run lint: `npm run lint` - zero errors

### 3.4 Pre-commit Validation

- [x] Run pre-commit hooks: `pre-commit run -a`
- [x] Ensure all hooks pass
- [x] Fix any issues reported by hooks

### 3.5 Success Metrics Validation

- [x] Verify `src/config/validate.ts` reduced to 424 lines (from 392) - slightly larger but much more declarative with Zod schemas
- [x] Verify `test/integration/environment-config.test.ts` reduced to 509 lines (from 710) - 28% reduction
- [x] Verify all cognitive complexity < 15
- [x] Verify 100% test pass rate (358 passing, 2 skipped)
- [x] Verify zero TypeScript errors
- [x] Verify zero ESLint errors (only 4 pre-existing warnings in mock files)
- [x] Verify test coverage maintained

## Dependencies

- Phase 2 depends on Phase 1 completion (Zod migration must be done first)
- Phase 3 depends on Phase 1 and 2 completion
- Within Phase 1: Tasks 1.1-1.3 must be sequential, 1.4-1.6 can be done together
- Within Phase 2: Tasks 2.1-2.3 should be sequential, 2.4-2.6 can overlap

## Estimated Effort

- Phase 1 (Zod Migration): Primary implementation work
- Phase 2 (Test Consolidation): Significant refactoring work
- Phase 3 (Cleanup): Verification and quality checks

Total: Can be completed in a focused implementation session

## Rollback Plan

If issues are discovered after implementation:

1. Git revert to commit before changes
2. Identify specific issue
3. Fix forward or stay on old implementation
4. Zod and envalid are independent, so rollback is clean

## Notes

- Keep commits atomic (one task or group of related tasks per commit)
- Run tests after each task completion
- Use conventional commit messages
- Don't batch unrelated changes together
- Focus on maintaining 100% test coverage throughout
