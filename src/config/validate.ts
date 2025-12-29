/**
 * Configuration validation for semantic-release-jira plugin
 */

import safeRegex from "safe-regex";
import { z, type ZodIssue } from "zod";

import type { PluginConfig, ValidatedPluginConfig } from "~/types/index.js";

/**
 * Default regex pattern for matching Jira issue keys
 * Matches: PROJECT-123, ABC-456, etc.
 */
const DEFAULT_ISSUE_PATTERN = String.raw`[A-Z][A-Z0-9]+-\d+`;

/**
 * Gets the issue pattern from config or returns default
 */
export function getIssuePattern(config: ValidatedPluginConfig): RegExp {
  const pattern = config.customIssuePattern ?? DEFAULT_ISSUE_PATTERN;
  return new RegExp(pattern, "g");
}

/**
 * Checks if a string contains unexpanded environment variables
 * Detects patterns like ${VAR} or $VAR that suggest failed env var expansion
 */
export function isUnexpandedEnvironmentVariable(
  value: string | undefined,
): boolean {
  if (!value) return false;

  // Matches ${VAR} or $VAR format - entire string, uppercase only, valid env var name characters
  return (
    /^\$\{[A-Z_][A-Z0-9_]*\}$/.test(value) || /^\$[A-Z_][A-Z0-9_]*$/.test(value)
  );
}

/**
 * Validates that a string is a valid Jira issue key format (PROJECT-123).
 * If a custom pattern is provided it is wrapped with anchors and used instead
 * of the default. The supplied pattern must not use the global flag so that
 * repeated calls to `test()` behave deterministically.
 */
export function isValidIssueKeyFormat(key: string, pattern?: RegExp): boolean {
  const source = pattern ? pattern.source : DEFAULT_ISSUE_PATTERN;
  const anchoredPattern = new RegExp(`^${source}$`);
  return anchoredPattern.test(key);
}

/**
 * Helper to create a Zod schema for parsing boolean environment variables
 */
function environmentBooleanSchema() {
  return z
    .enum(["true", "false", "1", "0"])
    .transform((value) => value === "true" || value === "1")
    .optional();
}

/**
 * Zod schema for parsing environment variables
 * All environment variables are optional
 */
const environmentVariableSchema = z.object({
  SEMANTIC_RELEASE_JIRA_API_TOKEN: z.string().optional(),
  SEMANTIC_RELEASE_JIRA_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1, {
      message:
        "SEMANTIC_RELEASE_JIRA_CONCURRENCY: Invalid concurrency: must be between 1 and 100",
    })
    .max(100, {
      message:
        "SEMANTIC_RELEASE_JIRA_CONCURRENCY: Invalid concurrency: must be between 1 and 100",
    })
    .optional(),
  SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS: environmentBooleanSchema(),
  SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN: z.string().optional(),
  SEMANTIC_RELEASE_JIRA_DRY_RUN: environmentBooleanSchema(),
  SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR: environmentBooleanSchema(),
  SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED: environmentBooleanSchema(),
  SEMANTIC_RELEASE_JIRA_RETRIES: z.coerce
    .number()
    .int()
    .min(0, {
      message:
        "SEMANTIC_RELEASE_JIRA_RETRIES: Invalid retries: must be between 0 and 10",
    })
    .max(10, {
      message:
        "SEMANTIC_RELEASE_JIRA_RETRIES: Invalid retries: must be between 0 and 10",
    })
    .optional(),
  SEMANTIC_RELEASE_JIRA_RETRY_DELAY: z.coerce.number().int().min(0).optional(),
  SEMANTIC_RELEASE_JIRA_SERVER_URL: z.string().optional(),
  SEMANTIC_RELEASE_JIRA_TIMEOUT: z.coerce.number().int().positive().optional(),
  SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES: environmentBooleanSchema(),
  SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS: z.string().optional(),
  SEMANTIC_RELEASE_JIRA_USERNAME: z.string().optional(),
  SEMANTIC_RELEASE_JIRA_VERSION_PREFIX: z.string().optional(),
});

type EnvironmentVariables = z.infer<typeof environmentVariableSchema>;

/**
 * Helper to create a Zod preprocessor for boolean config fields
 */
function booleanPreprocessor(fieldName: string, defaultValue: boolean) {
  return z.preprocess((value) => {
    if (value === undefined) return defaultValue;
    if (typeof value === "boolean") return value;
    throw new Error(`Invalid ${fieldName}: must be a boolean`);
  }, z.boolean());
}

/**
 * An array of extractor functions, each reading one environment variable and
 * returning a Partial<PluginConfig> with the mapped camelCase key set (or an
 * empty object when the variable is absent). This approach keeps a single
 * source of truth for the env→config mapping while satisfying strict TypeScript
 * type checks without requiring any type assertions.
 */
const ENVIRONMENT_EXTRACTORS: ReadonlyArray<
  (environment: EnvironmentVariables) => Partial<PluginConfig>
> = [
  ({ SEMANTIC_RELEASE_JIRA_API_TOKEN: value }) =>
    value === undefined ? {} : { jiraApiToken: value },
  ({ SEMANTIC_RELEASE_JIRA_CONCURRENCY: value }) =>
    value === undefined ? {} : { concurrency: value },
  ({ SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS: value }) =>
    value === undefined ? {} : { createVersions: value },
  ({ SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN: value }) =>
    value === undefined ? {} : { customIssuePattern: value },
  ({ SEMANTIC_RELEASE_JIRA_DRY_RUN: value }) =>
    value === undefined ? {} : { dryRun: value },
  ({ SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR: value }) =>
    value === undefined ? {} : { failOnJiraError: value },
  ({ SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED: value }) =>
    value === undefined ? {} : { rejectUnauthorized: value },
  ({ SEMANTIC_RELEASE_JIRA_RETRIES: value }) =>
    value === undefined ? {} : { retries: value },
  ({ SEMANTIC_RELEASE_JIRA_RETRY_DELAY: value }) =>
    value === undefined ? {} : { retryDelay: value },
  ({ SEMANTIC_RELEASE_JIRA_SERVER_URL: value }) =>
    value === undefined ? {} : { jiraServerUrl: value },
  ({ SEMANTIC_RELEASE_JIRA_TIMEOUT: value }) =>
    value === undefined ? {} : { timeout: value },
  ({ SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES: value }) =>
    value === undefined ? {} : { transitionIssues: value },
  ({ SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS: value }) =>
    value === undefined ? {} : { transitionToStatus: value },
  ({ SEMANTIC_RELEASE_JIRA_USERNAME: value }) =>
    value === undefined ? {} : { jiraUsername: value },
  ({ SEMANTIC_RELEASE_JIRA_VERSION_PREFIX: value }) =>
    value === undefined ? {} : { versionPrefix: value },
];

/**
 * Transforms parsed environment variables (SCREAMING_SNAKE_CASE) to config format (camelCase)
 */
function transformEnvironmentToConfig(
  environment: EnvironmentVariables,
): Partial<PluginConfig> {
  const config: Partial<PluginConfig> = {};
  for (const extract of ENVIRONMENT_EXTRACTORS) {
    Object.assign(config, extract(environment));
  }
  return config;
}

/**
 * Main configuration schema with validation rules and defaults
 */
const configSchema = z
  .object({
    // Numeric fields with defaults and constraints
    concurrency: z
      .number()
      .int()
      .min(1, { message: "Invalid concurrency: must be between 1 and 100" })
      .max(100, { message: "Invalid concurrency: must be between 1 and 100" })
      .default(10),

    // Boolean fields with defaults
    createVersions: booleanPreprocessor("createVersions", false),

    // Custom issue pattern with regex validation
    customIssuePattern: z
      .string()
      .optional()
      .superRefine((value, context) => {
        if (!value) return;

        // First check if it's valid regex syntax
        try {
          new RegExp(value);
        } catch {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Invalid customIssuePattern: must be a valid regular expression",
          });
          return;
        }

        // Then check for ReDoS vulnerability
        if (!safeRegex(value)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              `customIssuePattern may cause ReDoS (Regular Expression Denial of Service): ${value}. ` +
              "This pattern could hang the release process due to catastrophic backtracking. " +
              "Avoid nested quantifiers like (a+)+, (a*)*, or (a|a)*. " +
              "Use simpler patterns without complex alternations or nested repetitions. " +
              "For help, see: https://github.com/substack/safe-regex#readme",
          });
        }
      }),

    dryRun: booleanPreprocessor("dryRun", false),
    failOnJiraError: booleanPreprocessor("failOnJiraError", false),

    // Optional string fields with unexpanded env var checks
    jiraApiToken: z
      .string()
      .optional()
      .refine(
        (value) =>
          value === undefined || !isUnexpandedEnvironmentVariable(value),
        {
          message:
            "jiraApiToken appears to contain an unexpanded environment variable. " +
            "Ensure your environment variables are properly expanded before passing to the plugin.",
        },
      ),

    // Required field with URL and HTTPS validation
    jiraServerUrl: z
      .string()
      .min(1)
      .refine((value) => !isUnexpandedEnvironmentVariable(value), {
        message:
          "jiraServerUrl appears to contain an unexpanded environment variable. " +
          "Ensure your environment variables are properly expanded before passing to the plugin.",
      })
      .refine(
        (value) => {
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        },
        {
          message: "Invalid jiraServerUrl",
        },
      )
      .refine(
        (value) => {
          // Only check protocol if URL is valid (previous refine passed)
          try {
            const parsedUrl = new URL(value);
            return (
              parsedUrl.protocol === "https:" ||
              ["::1", "127.0.0.1", "localhost"].includes(parsedUrl.hostname)
            );
          } catch {
            // If URL parsing fails, let the previous refine handle it
            return true;
          }
        },
        {
          message:
            "jiraServerUrl must use HTTPS for security. HTTP is only allowed for localhost.",
        },
      ),
    jiraUsername: z
      .string()
      .optional()
      .refine(
        (value) =>
          value === undefined || !isUnexpandedEnvironmentVariable(value),
        {
          message:
            "jiraUsername appears to contain an unexpanded environment variable. " +
            "Ensure your environment variables are properly expanded before passing to the plugin.",
        },
      ),
    rejectUnauthorized: booleanPreprocessor("rejectUnauthorized", true),
    retries: z
      .number()
      .int()
      .min(0, { message: "Invalid retries: must be between 0 and 10" })
      .max(10, { message: "Invalid retries: must be between 0 and 10" })
      .default(3),
    retryDelay: z
      .number()
      .int()
      .min(0, {
        message: "Invalid retryDelay: must be a non-negative number",
      })
      .default(1000),
    timeout: z
      .number()
      .int()
      .positive({ message: "Invalid timeout: must be a positive number" })
      .default(30_000),
    transitionIssues: booleanPreprocessor("transitionIssues", false),

    // Transition configuration
    transitionToStatus: z
      .string()
      .trim()
      .min(1, {
        message: "transitionToStatus cannot be empty or whitespace-only",
      })
      .optional(),

    // Version prefix
    versionPrefix: z.string().optional(),
  })
  .refine(
    (config) => {
      // If transitionIssues or createVersions is enabled, require credentials
      if (config.transitionIssues || config.createVersions) {
        return !!config.jiraUsername && !!config.jiraApiToken;
      }
      return true;
    },
    {
      message:
        "Jira credentials (jiraUsername and jiraApiToken) are required when transitionIssues or createVersions is enabled\n" +
        "  Provide via config file: { jiraUsername: 'user@example.com', jiraApiToken: 'token' }\n" +
        "  Or environment variables: SEMANTIC_RELEASE_JIRA_USERNAME=user@example.com SEMANTIC_RELEASE_JIRA_API_TOKEN=token",
    },
  );

/**
 * Validates plugin configuration and applies defaults
 * @throws {Error} If configuration is invalid
 */
export function validateConfig(
  config: Partial<PluginConfig>,
): ValidatedPluginConfig {
  // Step 1: Parse environment variables
  const environmentResult = environmentVariableSchema.safeParse(process.env);
  if (!environmentResult.success) {
    const formatted = formatZodError(environmentResult.error.issues);
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }

  // Step 2: Transform env vars to config format
  const environmentConfig = transformEnvironmentToConfig(
    environmentResult.data,
  );

  // Step 3: Merge (env vars override config file)
  const merged = { ...config, ...environmentConfig };

  // Step 4: Validate merged config
  const configResult = configSchema.safeParse(merged);
  if (!configResult.success) {
    // Check for missing jiraServerUrl and provide helpful error
    const missingServerUrl = configResult.error.issues.some(
      (issue) =>
        issue.path[0] === "jiraServerUrl" &&
        (issue.code === "too_small" || issue.code === "invalid_type"),
    );

    if (missingServerUrl) {
      throw new Error(
        "Missing required configuration: jiraServerUrl\n" +
          "  Provide via config file: { jiraServerUrl: 'https://company.atlassian.net' }\n" +
          "  Or environment variable: SEMANTIC_RELEASE_JIRA_SERVER_URL=https://company.atlassian.net",
      );
    }

    const formatted = formatZodError(configResult.error.issues);
    throw new Error(`Configuration validation failed:\n${formatted}`);
  }

  // Step 5: Return validated config
  return configResult.data;
}

/**
 * Formats Zod validation errors into readable error messages
 */
function formatZodError(issues: ZodIssue[]): string {
  return issues
    .map((error) => {
      const path = error.path.length > 0 ? error.path.join(".") : "";
      if (path) {
        return `  ${path}: ${error.message}`;
      }
      return `  ${error.message}`;
    })
    .join("\n");
}
