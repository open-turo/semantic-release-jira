# Spec Delta: semantic-release-jira (Configuration Validation)

## MODIFIED Requirements

### Requirement: Type-Safe Environment Variable Parsing

The plugin SHALL use Zod for environment variable parsing to provide better type inference, declarative schemas, and improved error messages. This replaces envalid with a more maintainable declarative approach that provides compile-time type safety and better TypeScript integration.

#### Scenario: Parse environment variables with Zod

**Given** environment variables are set with the `SEMANTIC_RELEASE_JIRA_` prefix
**When** the plugin loads configuration
**Then** the plugin SHALL use Zod schemas to parse environment variables
**And** Zod SHALL validate types and constraints declaratively
**And** error messages SHALL be formatted in a user-friendly manner

**Example**:

```typescript
// Environment variables
SEMANTIC_RELEASE_JIRA_SERVER_URL=https://company.atlassian.net
SEMANTIC_RELEASE_JIRA_TIMEOUT=30000
SEMANTIC_RELEASE_JIRA_DRY_RUN=true

// Parsed with Zod schema
const envSchema = z.object({
  SEMANTIC_RELEASE_JIRA_SERVER_URL: z.string().optional(),
  SEMANTIC_RELEASE_JIRA_TIMEOUT: z.coerce.number().int().positive().optional(),
  SEMANTIC_RELEASE_JIRA_DRY_RUN: z
    .enum(['true', 'false', '1', '0'])
    .transform(val => val === 'true' || val === '1')
    .optional(),
  // ...
});

const result = envSchema.safeParse(process.env);
// Type-safe, validated, and transformed
```

---

#### Scenario: Boolean environment variables accept standard formats (unchanged behavior)

**Given** `SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES` is set to `true`, `false`, `1`, or `0`
**When** the plugin loads configuration
**Then** Zod SHALL parse lowercase `true`/`false` and `1`/`0` as boolean values
**And** uppercase or other formats SHALL be rejected with clear error messages

**Example**:

```
✅ SEMANTIC_RELEASE_JIRA_DRY_RUN=true  → parsed as true (boolean)
✅ SEMANTIC_RELEASE_JIRA_DRY_RUN=false → parsed as false (boolean)
✅ SEMANTIC_RELEASE_JIRA_DRY_RUN=1     → parsed as true (boolean)
✅ SEMANTIC_RELEASE_JIRA_DRY_RUN=0     → parsed as false (boolean)
❌ SEMANTIC_RELEASE_JIRA_DRY_RUN=TRUE  → Zod error: Invalid enum value
❌ SEMANTIC_RELEASE_JIRA_DRY_RUN=yes   → Zod error: Invalid enum value
```

---

#### Scenario: Numeric environment variables parse with validation

**Given** numeric environment variables like `SEMANTIC_RELEASE_JIRA_TIMEOUT`
**When** the plugin loads configuration
**Then** Zod SHALL coerce strings to numbers
**And** Zod SHALL validate constraints (positive, min, max, integer)
**And** invalid numeric values SHALL produce clear error messages

**Example**:

```
✅ SEMANTIC_RELEASE_JIRA_TIMEOUT=30000     → parsed as 30000 (number)
✅ SEMANTIC_RELEASE_JIRA_CONCURRENCY=10    → parsed as 10 (number)
✅ SEMANTIC_RELEASE_JIRA_RETRIES=3         → parsed as 3 (number, min 0, max 10)
❌ SEMANTIC_RELEASE_JIRA_TIMEOUT=abc       → Zod error: Expected number
❌ SEMANTIC_RELEASE_JIRA_TIMEOUT=-1000     → Zod error: Number must be positive
❌ SEMANTIC_RELEASE_JIRA_CONCURRENCY=500   → Zod error: Number must be <= 100
```

---

### Requirement: Declarative Configuration Validation

The plugin SHALL use declarative Zod schemas for configuration validation to reduce cognitive complexity and improve maintainability. Declarative schemas replace imperative validation functions with nested conditionals, making validation logic easier to understand and modify. Zod provides built-in validators that eliminate the need for custom validation logic.

#### Scenario: Validate configuration with Zod schemas

**Given** plugin configuration is provided
**When** `validateConfig()` is called
**Then** the plugin SHALL use a Zod schema to validate all configuration fields
**And** the schema SHALL enforce all existing validation rules declaratively
**And** validation errors SHALL be collected and formatted together
**And** no imperative validation helper functions SHALL be needed

**Example**:

```typescript
// Before (imperative, 392 lines):
function validateConfig(config: Partial<PluginConfig>): ValidatedPluginConfig {
  loadConfigFromEnvironment();
  validateRequiredFields(config);
  validateTransitionConfig(config);
  validateNumericFields(config);
  validateBooleanFields(config);
  validateCustomPattern(config);
  validateCredentials(config);
  return applyDefaults(config);
}

// After (declarative, ~200-250 lines):
const configSchema = z
  .object({
    jiraServerUrl: z.string().url().refine(isHttps),
    timeout: z.number().int().positive().default(30_000),
    transitionIssues: z.boolean().default(false),
    // ... all fields with inline validation
  })
  .refine(requiresCredentials);

function validateConfig(config: Partial<PluginConfig>): ValidatedPluginConfig {
  const envConfig = envSchema.parse(process.env);
  const merged = { ...config, ...transformEnvToConfig(envConfig) };
  return configSchema.parse(merged);
}
```

---

#### Scenario: Validation complexity reduction

**Given** the Zod-based validation implementation
**When** measuring cognitive complexity
**Then** `validateConfig()` SHALL have complexity < 8
**And** `formatZodError()` SHALL have complexity < 5
**And** `transformEnvToConfig()` SHALL have complexity < 3
**And** Zod schemas SHALL have 0 complexity (declarative, not imperative)
**And** all old validation helper functions SHALL be removed:

- `validateRequiredFields()`
- `validateTransitionConfig()`
- `validateNumericFields()`
- `validateBooleanFields()`
- `validateCustomPattern()`
- `validateCredentials()`
- `loadConfigFromEnvironment()`
- `environmentVariableToConfigKey()`

---

#### Scenario: User-friendly error messages

**Given** Zod validation fails
**When** an error is thrown
**Then** the error message SHALL be formatted for readability
**And** the message SHALL include:

- Clear field names
- Specific validation failures
- Helpful suggestions (where applicable)
  **And** error message patterns SHALL match existing patterns where possible (backward compatibility)

**Example**:

```
// Invalid timeout
❌ Input: { timeout: -1000 }
Error: Configuration validation failed:
  timeout: Number must be positive

// Missing credentials
❌ Input: { transitionIssues: true }
Error: Configuration validation failed:
  jiraUsername: Jira credentials (jiraUsername and jiraApiToken) are required when transitionIssues or createVersions is enabled

// Invalid env var
❌ SEMANTIC_RELEASE_JIRA_TIMEOUT=abc
Error: Invalid environment variables:
  SEMANTIC_RELEASE_JIRA_TIMEOUT: Expected number, received string
```

---

### Requirement: Maintained Validation Behavior

All existing validation rules SHALL remain unchanged in behavior when migrating from envalid and imperative validation to Zod-based declarative validation. Only the implementation mechanism changes; all validation logic, error messages, and behavior SHALL be preserved to ensure backward compatibility and avoid breaking changes for users.

#### Scenario: Existing validation rules preserved

**Given** the Zod-based validation implementation
**When** validating configuration
**Then** all existing validation rules SHALL behave identically:

- Required field validation (jiraServerUrl)
- URL format validation (must be valid URL)
- HTTPS enforcement (except localhost)
- Unexpanded environment variable detection
- Credential requirements (when transitionIssues/createVersions enabled)
- Custom issue pattern ReDoS protection
- Numeric field constraints (min, max, positive)
- Boolean field validation
- Transition status validation (non-empty)
- Environment variable override behavior (env > config)

---

#### Scenario: Existing tests pass without modification

**Given** existing validation tests in:

- `test/config/validate.test.ts` (446 lines)
- `test/config/validate.environment.test.ts` (308 lines)
  **When** the Zod implementation is used
  **Then** all existing tests SHALL pass
  **And** test behavior SHALL remain identical
  **And** only minor test assertion updates MAY be needed if error message format changed
  **And** no test logic changes SHALL be required

---

### Requirement: Code Reduction and Maintainability

The Zod migration SHALL reduce validation code size by 35-40% (from 392 lines to ~200-250 lines) while maintaining or improving functionality. Less code means fewer bugs, easier maintenance, and improved developer experience. The reduction comes from eliminating imperative validation helper functions and using Zod's built-in validators instead of custom logic.

#### Scenario: Validation code size reduction

**Given** the current validation implementation has 392 lines
**When** migrating to Zod
**Then** the new implementation SHALL be ~200-250 lines (35-40% reduction)
**And** the reduction SHALL come from:

- Eliminating imperative validation helper functions
- Using Zod's built-in validators instead of custom logic
- Declarative schemas instead of nested conditionals
  **And** functionality SHALL be maintained or improved

---

#### Scenario: Improved maintainability

**Given** the Zod-based validation
**When** a developer needs to add or modify validation rules
**Then** changes SHALL be made by updating the schema declaration
**And** no new helper functions SHALL be needed
**And** TypeScript SHALL infer types automatically from schemas
**And** changes SHALL be localized to the schema definition

**Example**:

```typescript
// Adding a new field validation with Zod
const configSchema = z.object({
  // ... existing fields

  // Add new field with validation
  maxIssuesPerRelease: z.number().int().min(1).max(1000).default(100),
});

// TypeScript automatically knows ValidatedPluginConfig now includes maxIssuesPerRelease
```

---

## REMOVED Requirements

None. All existing requirements are maintained.

## ADDED Requirements

None. This is a refactoring change, not a feature addition.

---

## Implementation Impact

### Files Modified

- `src/config/validate.ts` - Complete refactor (~200-250 lines, down from 392)
- `test/config/validate.test.ts` - Minor assertion updates if needed
- `test/config/validate.environment.test.ts` - Minor assertion updates if needed

### Dependencies Changed

- **Added**: `zod` (latest stable version)
- **Removed**: `envalid`

### Breaking Changes

None. This is an internal implementation change with no user-facing API changes.

### Risk Mitigation

- Comprehensive test coverage ensures behavior parity
- Zod is a battle-tested, widely-used library
- Rollback is straightforward (git revert)
- Feature can be developed behind a feature flag if needed

---

## Cross-References

- Related to "Cognitive Complexity Limits" requirement (complexity reduction)
- Related to "Type Safety with Runtime Guards" requirement (type safety improvement)
- Related to "Environment Variable Configuration Support" requirement (parsing mechanism change)
