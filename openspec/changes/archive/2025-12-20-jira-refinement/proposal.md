# Change: Refine Jira Release Notes and Replace Custom Utilities

## Why

Current implementation has two areas for improvement:

1. **Release Notes Missing Context**: Release notes only show issue keys (e.g., `TEST-123`) without titles, requiring users to click each link to understand what was fixed. This provides poor user experience for changelog readers.

2. **Reinventing the Wheel**: Custom implementations of logging (121 lines) and sanitization (205 lines) duplicate functionality available in battle-tested open-source libraries. This increases maintenance burden, reduces confidence in security, and misses performance optimizations from mature libraries.

## What Changes

### Enhanced Release Notes with Issue Titles

When credentials are provided (not read-only mode), automatically fetch Jira issue summaries and include them in release notes:

**Before**:

```markdown
## Jira Issues

### PROJECT

- [PROJECT-123](https://jira.example.com/browse/PROJECT-123)
- [PROJECT-456](https://jira.example.com/browse/PROJECT-456)
```

**After**:

```markdown
## Jira Issues

### PROJECT

- [PROJECT-123](https://jira.example.com/browse/PROJECT-123): Implement user authentication
- [PROJECT-456](https://jira.example.com/browse/PROJECT-456): Fix memory leak in cache layer
```

Implementation approach:

- Fetch issue details using existing `verifyIssueExists` pattern
- Only fetch when credentials are provided (not read-only mode)
- Use existing rate limiting (p-limit) for concurrent fetches
- Gracefully degrade: if fetch fails, show issue key without title
- No new configuration required

### Replace Custom Utilities with Pino

Replace custom logging and sanitization with industry-standard libraries:

**Replace `src/utils/logger.ts` (121 lines)**:

- Use `pino` for structured logging
- Automatic JSON output, correlation IDs, timestamps
- 5-10x faster than custom implementation
- Built-in serializers for errors, request/response objects

**Replace `src/utils/sanitize.ts` (205 lines)**:

- Use `pino-noir` for automatic credential redaction
- Configurable path-based redaction (e.g., `req.headers.authorization`)
- Handles circular references automatically
- Well-tested with edge cases

**Benefits**:

- Remove 326 lines of custom code (121 + 205)
- Better performance (pino is the fastest logger in Node.js)
- More secure (battle-tested redaction patterns)
- Easier maintenance (community support)
- Better TypeScript types

## Impact

- **Affected specs**: `semantic-release-jira` (new requirements for both changes)
- **Affected code**:
  - `src/release-notes/formatter.ts` - Fetch and include issue titles
  - `src/jira/client.ts` - Add `getIssueDetails()` function
  - `src/index.ts` - Pass fetched details to formatter
  - `src/utils/logger.ts` - Replace with pino wrapper (reduce from 121 to ~30 lines)
  - `src/utils/sanitize.ts` - Delete (replaced by pino-noir)
  - `src/http/client.ts` - Update to use pino serializers
  - All test files - Update mocks and expectations
- **External dependencies**:
  - Add `pino` (~5.8k weekly downloads, battle-tested)
  - Add `pino-noir` (official pino plugin for redaction)
  - Add `pino-pretty` (dev dependency for readable logs during development)
- **Breaking changes**: None
  - Logger API remains compatible (same methods: log, error, success)
  - Output format changes but semantic-release handles this
  - Release notes format enhanced but backward compatible

## Non-Goals

- Adding custom formatters or complex release note templates
- Supporting other logging backends (winston, bunyan)
- Fetching additional issue fields beyond summary (status, assignee, etc.)
- Adding configuration for controlling which issues fetch titles
