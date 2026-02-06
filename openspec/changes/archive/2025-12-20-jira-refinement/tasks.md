# Tasks: Jira Refinements

## Phase 1: Enhanced Release Notes with Issue Titles

### Task 1: Add Issue Details Fetching (CRITICAL)

**Priority**: CRITICAL
**Estimate**: Medium
**Dependencies**: None

**Work Items**:

1. Add `getIssueDetails()` function to `src/jira/client.ts`
   - Fetch from `/rest/api/2/issue/{key}?fields=summary`
   - Return `{ key: string, summary: string } | null`
   - Graceful degradation on errors (return null)
2. Update `JiraIssue` interface in `src/types/index.ts`
   - Add optional `summary?: string` field
3. Write unit tests for `getIssueDetails()`
   - Success case with mock response
   - Error case returning null
   - Network timeout handling

**Validation**:

- `npm test -- test/jira/client.test.ts` passes
- Type checking passes with `npm run type-check`

---

### Task 2: Integrate Issue Fetching in Plugin (CRITICAL)

**Priority**: CRITICAL
**Estimate**: Medium
**Dependencies**: Task 1

**Work Items**:

1. Add `fetchIssueSummaries()` private method to `SemanticReleaseJiraPlugin`
   - Use `Promise.allSettled()` for parallel fetches
   - Use existing `rateLimiter` for concurrency control
   - Map results back to issues array
2. Update `generateNotes()` to call `fetchIssueSummaries()` when credentials available
   - Only fetch when `jiraUsername` and `jiraApiToken` are provided
   - Pass enriched issues to formatter
3. Write unit tests for `fetchIssueSummaries()`
   - Multiple issues with mixed success/failure
   - Rate limiting verification
   - Read-only mode (no fetch)

**Validation**:

- `npm test -- test/index.test.ts` passes
- Integration tests with nock mocking work

---

### Task 3: Update Release Notes Formatter (HIGH)

**Priority**: HIGH
**Estimate**: Small
**Dependencies**: Task 1

**Work Items**:

1. Update `generateJiraNotesSection()` in `src/release-notes/formatter.ts`
   - Check if `issue.summary` exists
   - Format as `- [KEY](url): Summary` when present
   - Fallback to `- [KEY](url)` when missing
2. Update existing tests in `test/release-notes/formatter.test.ts`
   - Test with issues containing summaries
   - Test with issues without summaries (mixed)
   - Verify markdown output format

**Validation**:

- `npm test -- test/release-notes/formatter.test.ts` passes
- Manual review of generated markdown looks correct

---

### Task 4: Integration Testing for Enhanced Release Notes (HIGH)

**Priority**: HIGH
**Estimate**: Medium
**Dependencies**: Tasks 1, 2, 3

**Work Items**:

1. Add integration test in `test/integration/plugin.test.ts`
   - Mock Jira API responses with issue summaries
   - Verify release notes include titles
   - Test graceful degradation (some API calls fail)
   - Test read-only mode (no fetching)
2. Add performance test for many issues
   - Mock 50 issues
   - Verify rate limiting works
   - Measure execution time (should be <15s)

**Validation**:

- `npm test -- test/integration/plugin.test.ts` passes
- All 374+ tests pass

---

## Phase 2: Replace Custom Utilities with Pino

### Task 5: Install Pino Dependencies (MEDIUM)

**Priority**: MEDIUM
**Estimate**: Small
**Dependencies**: None

**Work Items**:

1. Install production dependencies
   - `npm install pino pino-noir --save`
2. Install development dependencies
   - `npm install pino-pretty --save-dev`
3. Verify package.json and package-lock.json updated
4. Run `npm ci` to ensure clean install works

**Validation**:

- `npm ci` succeeds
- Dependencies appear in package.json with pinned versions

---

### Task 6: Replace StructuredLogger with Pino (CRITICAL)

**Priority**: CRITICAL
**Estimate**: Large
**Dependencies**: Task 5

**Work Items**:

1. Rewrite `src/utils/logger.ts` to use pino
   - Configure pino with correlation ID
   - Configure pino-noir with redaction paths
   - Keep same public API (log, error, success, startTimer)
   - Use baseLogger for semantic-release compatibility
2. Configure redaction paths for pino-noir
   - `req.headers.authorization`
   - `res.headers.authorization`
   - `*.password`, `*.apiToken`, `*.token`, `*.secret`, `*.credential`
3. Update tests in `test/utils/logger.test.ts`
   - Verify API compatibility
   - Test automatic redaction
   - Remove custom sanitization tests (handled by pino-noir)

**Validation**:

- `npm test -- test/utils/logger.test.ts` passes
- No breaking changes to logger API

---

### Task 7: Remove Custom Sanitization (MEDIUM)

**Priority**: MEDIUM
**Estimate**: Medium
**Dependencies**: Task 6

**Work Items**:

1. Delete `src/utils/sanitize.ts` (205 lines)
2. Remove all `sanitizeForLogging()` imports throughout codebase
   - Search with `rg "sanitizeForLogging" --files-with-matches`
   - Remove imports and function calls
3. Update `src/http/client.ts` to use pino serializers
   - Remove manual sanitization
   - Rely on pino-noir automatic redaction
4. Delete `test/utils/sanitize.test.ts` (pino-noir is tested upstream)

**Validation**:

- `rg "sanitizeForLogging"` returns no results
- `npm test` passes with all sanitization handled by pino-noir
- No credential leaks in test output

---

### Task 8: Integration Testing for Pino Migration (HIGH)

**Priority**: HIGH
**Estimate**: Medium
**Dependencies**: Tasks 6, 7

**Work Items**:

1. Add integration tests verifying pino behavior
   - Test credential redaction in logs
   - Test correlation ID generation
   - Test structured logging output
   - Test semantic-release logger compatibility
2. Update existing integration tests
   - Adjust log output expectations
   - Verify no test failures from format changes
3. Manual testing with `pino-pretty` in development
   - Run plugin with `pino-pretty` for readable logs
   - Verify redaction works in development mode

**Validation**:

- All tests pass (no regressions)
- Credentials never appear in test logs
- `npm test 2>&1 | rg -i "password|token|secret"` returns only `[REDACTED]`

---

## Phase 3: Final Validation and Documentation

### Task 9: Update Documentation (MEDIUM)

**Priority**: MEDIUM
**Estimate**: Small
**Dependencies**: All above tasks

**Work Items**:

1. Update README.md
   - Document enhanced release notes behavior
   - Explain when issue titles are fetched
   - Note migration to pino (if visible to users)
2. Update CHANGELOG.md
   - Add entry for enhanced release notes
   - Add entry for pino migration
   - Note performance improvements
3. Update any developer documentation
   - Explain pino-noir redaction configuration
   - Document logging best practices

**Validation**:

- Documentation is clear and accurate
- Examples reflect new behavior

---

### Task 10: Performance and Security Audit (HIGH)

**Priority**: HIGH
**Estimate**: Small
**Dependencies**: All above tasks

**Work Items**:

1. Verify no credential leaks
   - Run tests with verbose logging
   - Check all error messages
   - Audit HTTP interceptor output
2. Verify performance is acceptable
   - Measure release notes generation time with 50 issues
   - Verify logging overhead is minimal
   - Check pino serialization performance
3. Review security implications
   - Pino-noir redaction coverage
   - API call security (HTTPS, auth)
   - Error message safety

**Validation**:

- Security audit checklist complete
- No credentials in any log output
- Performance meets requirements (<15s for 50 issues)

---

## Task Ordering and Parallelization

**Parallel Work** (can be done simultaneously):

- Phase 1 (Tasks 1-4): Enhanced Release Notes
- Phase 2 (Tasks 5-8): Pino Migration

**Sequential Dependencies**:

- Within Phase 1: Task 1 → Task 2 → Task 3 → Task 4
- Within Phase 2: Task 5 → Task 6 → Task 7 → Task 8
- Phase 3 (Tasks 9-10): After both Phase 1 and Phase 2 complete

**Critical Path**: Phase 1 (Enhanced Release Notes) is likely longer than Phase 2 (Pino Migration), so it determines overall timeline.

---

## Definition of Done

Each task is considered complete when:

1. All code is written and passes linting (`npm run lint`)
2. All tests pass (`npm test`)
3. Type checking passes (`npm run type-check` or `tsc --noEmit`)
4. Code review is complete (if applicable)
5. Documentation is updated (if applicable)

The entire change is complete when:

1. All 10 tasks are marked done
2. All tests pass (374+ passing)
3. No credential leaks in any logs
4. Performance requirements met
5. Documentation updated
6. OpenSpec proposal archived
