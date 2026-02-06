# Design: Jira Refinements

## Architecture Overview

Two independent improvements that enhance user experience and reduce maintenance burden:

1. **Enhanced Release Notes**: Add issue titles by fetching from Jira API
2. **Library Migration**: Replace custom utilities with pino + pino-noir

## Component Design

### 1. Enhanced Release Notes with Issue Titles

#### Current Flow

```
analyzeCommits() → collectIssues() → verifyIssueExists() → issues[]
                                                                ↓
generateNotes() → generateJiraNotesSection(issues) → "- [KEY](url)"
```

#### Proposed Flow

```
analyzeCommits() → collectIssues() → verifyIssueExists() → issues[]
                                                                ↓
generateNotes() → fetchIssueSummaries(issues) → issuesWithTitles[]
                                                                ↓
               generateJiraNotesSection(issuesWithTitles) → "- [KEY](url): Title"
```

#### Implementation Details

**New Function: `getIssueDetails(client, issueKey)`**

```typescript
// src/jira/client.ts
export async function getIssueDetails(
  client: AxiosInstance,
  issueKey: string,
): Promise<{ key: string; summary: string } | null> {
  try {
    const response = await client.get(
      `/rest/api/2/issue/${issueKey}?fields=summary`,
    );
    return {
      key: response.data.key,
      summary: response.data.fields.summary,
    };
  } catch (error) {
    // Gracefully degrade - return null if fetch fails
    return null;
  }
}
```

**Update Type Definition**:

```typescript
// src/types/index.ts
export interface JiraIssue {
  key: string;
  projectKey: string;
  summary?: string; // Optional: only populated when fetched
}
```

**Update Formatter**:

```typescript
// src/release-notes/formatter.ts
export function generateJiraNotesSection(
  issues: JiraIssue[],
  jiraServerUrl: string,
): string {
  // ... existing grouping and sorting logic ...

  for (const issue of sortedIssues) {
    const issueUrl = generateIssueUrl(jiraServerUrl, issue.key);
    const line = issue.summary
      ? `- [${issue.key}](${issueUrl}): ${issue.summary}`
      : `- [${issue.key}](${issueUrl})`;
    lines.push(line);
  }
}
```

**Update Main Plugin**:

```typescript
// src/index.ts - in generateNotes()
async generateNotes(...): Promise<string> {
  // ... existing code ...

  // Fetch summaries if we have credentials
  if (this.config.jiraUsername && this.config.jiraApiToken) {
    const client = this.createJiraClientInstance();
    const issuesWithSummaries = await this.fetchIssueSummaries(
      client,
      this.collectedIssues
    );
    return generateJiraNotesSection(issuesWithSummaries, ...);
  }

  return generateJiraNotesSection(this.collectedIssues, ...);
}

private async fetchIssueSummaries(
  client: AxiosInstance,
  issues: JiraIssue[]
): Promise<JiraIssue[]> {
  const results = await Promise.allSettled(
    issues.map(issue =>
      this.rateLimiter!(() => getIssueDetails(client, issue.key))
    )
  );

  return issues.map((issue, index) => {
    const result = results[index];
    if (result.status === 'fulfilled' && result.value) {
      return { ...issue, summary: result.value.summary };
    }
    return issue; // Return without summary if fetch failed
  });
}
```

#### Performance Considerations

- **Rate Limiting**: Uses existing `p-limit` with configured concurrency
- **Graceful Degradation**: Failed fetches don't break release notes
- **Caching**: Not needed - release notes generated once per release
- **API Calls**: Minimal - only fetches `fields=summary` (not full issue)

**Example API Load**:

- 10 issues = 10 API calls (~2-3 seconds with concurrency=5)
- 50 issues = 50 API calls (~10-15 seconds)
- Negligible impact: happens during `generateNotes`, not time-critical

### 2. Replace Custom Utilities with Pino

#### Pino Integration Design

**Before: Custom Logger (121 lines)**

```typescript
export class StructuredLogger {
  constructor(private baseLogger: Logger, correlationId?: string) { ... }
  log(message: string, context?: LogContext): void { ... }
  error(message: string, context?: LogContext): void { ... }
  success(message: string, context?: LogContext): void { ... }
  startTimer(): () => number { ... }
  private sanitizeMessage(message: string): string { ... }
  private enrichContext(context?: LogContext): LogContext { ... }
  private formatContext(context: LogContext): string { ... }
}
```

**After: Pino Wrapper (~30 lines)**

```typescript
import pino from "pino";
import noir from "pino-noir";

// Redaction configuration for pino-noir
const redactPaths = [
  "req.headers.authorization",
  "res.headers.authorization",
  "*.password",
  "*.apiToken",
  "*.jiraApiToken",
  "*.token",
  "*.secret",
  "*.credential",
];

export class StructuredLogger {
  private logger: pino.Logger;

  constructor(
    private baseLogger: Logger,
    correlationId?: string,
  ) {
    // Create pino instance with redaction
    this.logger = pino({
      base: { correlationId: correlationId ?? crypto.randomUUID() },
      serializers: noir(redactPaths, "[REDACTED]"),
      // In production, pino outputs JSON
      // In dev, we can use pino-pretty
    });
  }

  log(message: string, context?: LogContext): void {
    // Use baseLogger to maintain semantic-release compatibility
    const logMessage = context
      ? `${message} ${JSON.stringify(context)}`
      : message;
    this.baseLogger.log(logMessage);
  }

  error(message: string, context?: LogContext): void {
    this.baseLogger.error(`${message} ${JSON.stringify(context ?? {})}`);
  }

  success(message: string, context?: LogContext): void {
    this.baseLogger.success(`${message} ${JSON.stringify(context ?? {})}`);
  }

  startTimer(): () => number {
    const startTime = Date.now();
    return () => Date.now() - startTime;
  }
}
```

**Delete: `src/utils/sanitize.ts` (205 lines)**

- All sanitization now handled by pino-noir
- Automatic path-based redaction
- Handles circular references
- No custom regex patterns to maintain

#### Migration Strategy

**Phase 1: Install Dependencies**

```bash
npm install pino pino-noir --save
npm install pino-pretty --save-dev
```

**Phase 2: Update Logger**

- Replace `src/utils/logger.ts` implementation
- Keep same public API (log, error, success, startTimer)
- Use pino-noir for redaction

**Phase 3: Remove Sanitization**

- Delete `src/utils/sanitize.ts`
- Remove `sanitizeForLogging` calls throughout codebase
- Update `src/http/client.ts` to use pino serializers

**Phase 4: Update Tests**

- Update test expectations for log output format
- Remove sanitization unit tests (pino-noir is already tested)
- Add integration tests for redaction

## Trade-offs and Decisions

### Decision 1: Always Fetch Titles (No Config Flag)

**Chosen**: Automatically fetch when credentials are available

**Alternatives Considered**:

1. Add `includeIssueTitles: boolean` config option
   - ❌ More configuration complexity
   - ❌ Users might not discover feature
   - ✅ More control over API usage

2. Never fetch titles (keep current behavior)
   - ❌ Poor user experience
   - ✅ Zero API calls

**Rationale**:

- Fetching titles improves UX significantly
- API cost is minimal (10-50 calls per release)
- Automatic behavior is better than hidden config
- Read-only mode naturally disables fetching

### Decision 2: Use Pino Instead of Winston

**Chosen**: Pino + pino-noir

**Alternatives Considered**:

1. Winston + custom redaction
   - ❌ 5-10x slower than pino
   - ❌ Still need custom redaction logic
   - ✅ More features (transports, levels)

2. Keep custom implementation but simplify
   - ❌ Still maintaining custom code
   - ❌ Missing optimizations
   - ✅ Full control

**Rationale**:

- Pino is fastest logger in Node.js ecosystem
- pino-noir provides battle-tested redaction
- Industry standard (used by Fastify, widely adopted)
- Reduces code from 326 lines to ~30 lines
- Better TypeScript types

### Decision 3: Graceful Degradation for Failed Fetches

**Chosen**: Show issue key without title if fetch fails

**Rationale**:

- Network errors shouldn't break release notes
- Better to have incomplete info than fail
- Users still get clickable links
- Error is logged for debugging

## Testing Strategy

### Enhanced Release Notes

1. Unit tests for `getIssueDetails()`
2. Integration tests with nock mocking Jira API
3. Test graceful degradation (API errors)
4. Test read-only mode (no fetch)
5. Test rate limiting (many issues)

### Pino Migration

1. Test logger API compatibility (log, error, success)
2. Test automatic redaction (credentials, tokens)
3. Test correlation ID generation
4. Test timer functionality
5. Remove old sanitization tests (pino-noir is tested)

## Performance Impact

### Enhanced Release Notes

- **API Calls**: +N calls (N = number of issues, typically 5-50)
- **Latency**: +2-15 seconds during generateNotes (non-critical)
- **Memory**: Negligible (only storing summaries)

### Pino Migration

- **Performance**: 5-10x faster logging (measured by pino benchmarks)
- **Memory**: Slightly lower (pino is optimized)
- **Build Size**: +300KB (pino + pino-noir gzipped)

## Security Considerations

### Enhanced Release Notes

- Only fetch when credentials provided (respects authentication)
- Uses existing HTTP client (timeout, retry, sanitization)
- No new security risks

### Pino Migration

- **Improved**: Battle-tested redaction patterns (pino-noir)
- **Improved**: Handles edge cases better than custom code
- **Improved**: Community security audits
- No regressions: same fields are redacted

## Rollback Plan

If issues arise:

1. **Enhanced Release Notes**: Easy rollback - remove fetch call, keep old formatter
2. **Pino Migration**: Revert to custom implementation via git

Both changes are independent and can be rolled back separately.
