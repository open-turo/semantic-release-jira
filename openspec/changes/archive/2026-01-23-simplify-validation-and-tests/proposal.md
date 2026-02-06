# Proposal: Simplify Validation and Tests

## Overview

Refactor configuration validation to use Zod schemas for better type safety and developer experience, and consolidate integration tests to reduce verbosity and improve maintainability.

## Motivation

### Current Pain Points

1. **Validation Complexity**: The current validation in `src/config/validate.ts` (392 lines) uses envalid for environment variables but implements custom validation logic with high cognitive complexity. Multiple helper functions with nested conditionals make the code hard to maintain and extend.

2. **Test Verbosity**: The integration test file `test/integration/environment-config.test.ts` (710 lines) contains repetitive test scenarios with duplicate mock setup code and redundant assertions. Many tests verify similar behavior with slight variations, leading to maintenance burden.

3. **Dual Validation Approaches**: The codebase uses envalid for env var parsing and custom functions for business logic validation. This split creates confusion about where to add new validation rules.

### Proposed Solution

1. **Unified Zod Validation**: Replace envalid and custom validation functions with Zod schemas that handle both environment variable parsing and business logic validation in a single, declarative approach.

2. **Test Consolidation**: Reduce test file size by 40-50% through:
   - Combining similar test scenarios using parameterized tests
   - Leveraging existing mock utilities from `test/mocks/`
   - Removing redundant assertions
   - Better test organization

## Benefits

1. **Type Safety**: Zod provides better TypeScript inference and compile-time type checking
2. **Maintainability**: Declarative schemas are easier to understand and modify than imperative validation code
3. **Developer Experience**: Better error messages with Zod's built-in error formatting
4. **Reduced Complexity**: Eliminate high-complexity validation functions
5. **Test Efficiency**: Faster test execution and easier maintenance with consolidated tests

## Scope

### In Scope

- Replace envalid with Zod for environment variable parsing
- Refactor all validation logic in `src/config/validate.ts` to use Zod schemas
- Update validation tests in `test/config/validate.test.ts` and `test/config/validate.environment.test.ts`
- Consolidate `test/integration/environment-config.test.ts` by combining similar scenarios and using test utilities
- Maintain 100% test coverage and all existing validation behavior

### Out of Scope

- Changes to logger implementation (keeping StructuredLogger as-is)
- Changes to other parts of the codebase beyond validation
- New validation rules or features (only refactoring existing functionality)
- Changes to public API or plugin interface

## Impact Assessment

### Files Changed

**Core Changes** (2 files):

- `src/config/validate.ts` - Complete refactor using Zod schemas
- `test/integration/environment-config.test.ts` - Consolidate and simplify

**Test Updates** (2 files):

- `test/config/validate.test.ts` - Update to work with Zod validation
- `test/config/validate.environment.test.ts` - Update to work with Zod parsing

**Package Changes**:

- Add `zod` dependency
- Remove `envalid` dependency

### Risk Assessment

**Low Risk** - This is primarily an internal refactoring:

- No changes to public plugin API
- No breaking changes for plugin users
- All existing validation behavior preserved
- Comprehensive test coverage maintained

**Mitigation Strategies**:

- Validate that all existing tests pass before and after
- Use git bisect if regressions are discovered
- Maintain same error message patterns for user-facing errors

## Success Criteria

1. **Validation Refactoring**:
   - [ ] All validation logic migrated to Zod schemas
   - [ ] Cognitive complexity of validation functions < 15
   - [ ] All 64 validation tests passing
   - [ ] Zero TypeScript or linting errors
   - [ ] Error messages remain user-friendly and actionable

2. **Test Consolidation**:
   - [ ] `test/integration/environment-config.test.ts` reduced by 40-50% (710 lines → ~350-400 lines)
   - [ ] All integration tests passing
   - [ ] No reduction in test coverage
   - [ ] Mock utilities properly utilized

3. **Quality Metrics**:
   - [ ] `npm test` passes all tests
   - [ ] `npm run lint` reports zero errors
   - [ ] `npm run check-types` succeeds
   - [ ] Test execution time improved or maintained

## Implementation Notes

### Zod Schema Structure

```typescript
// Rough outline of Zod schema approach
const configSchema = z
  .object({
    jiraServerUrl: z.string().url().refine(isHttps, "Must use HTTPS"),
    jiraUsername: z.string().optional(),
    jiraApiToken: z.string().optional(),
    transitionIssues: z.boolean().default(false),
    createVersions: z.boolean().default(false),
    customIssuePattern: z.string().regex(safeRegexPattern).optional(),
    // ... other fields
  })
  .refine(
    (data) =>
      !data.transitionIssues || (data.jiraUsername && data.jiraApiToken),
    { message: "Credentials required when transitionIssues enabled" },
  );
```

### Test Consolidation Strategy

1. **Combine related scenarios**: Merge tests that differ only in input values using `it.each()`
2. **Use mock utilities**: Replace inline nock setup with `mockJiraFullWorkflow()` and similar helpers
3. **Remove redundant assertions**: Keep only assertions that verify unique behavior
4. **Group by concern**: Reorganize test suites by what they validate rather than minor variations

## Questions & Clarifications

1. Should we keep the same error message format for backward compatibility with any tooling that might parse errors?
   - **Decision**: Yes, maintain similar error messages to avoid breaking CI/CD scripts

2. Should we validate environment variables at plugin initialization or lazily when first needed?
   - **Decision**: Validate at initialization (existing behavior) to fail fast

## Related Work

- This refactoring aligns with the "Cognitive Complexity Limits" requirement in `semantic-release-jira` spec
- Uses existing mock utilities from "Mock Utilities Library" requirement in `test-quality` spec
- Complements the "Type Safety with Runtime Guards" patterns already established in the codebase

## Rollout Plan

1. **Phase 1**: Implement Zod validation
   - Add Zod dependency
   - Create Zod schemas for config and env vars
   - Migrate validation logic
   - Update validation tests

2. **Phase 2**: Consolidate integration tests
   - Identify redundant test scenarios
   - Combine similar tests using parameterization
   - Apply mock utilities
   - Verify coverage maintained

3. **Phase 3**: Cleanup
   - Remove envalid dependency
   - Update documentation if needed
   - Run full test suite
   - Lint and type-check

## Timeline

This is a focused refactoring that can be completed in a single implementation cycle.
