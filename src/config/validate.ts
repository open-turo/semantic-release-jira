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
 * Checks if any semantic-release-jira environment variables are set
 * Returns true if ANY of the plugin-specific environment variables are defined
 */
export function hasEnvironmentVariables(): boolean {
  const environmentVariables = [
    "SEMANTIC_RELEASE_JIRA_SERVER_URL",
    "SEMANTIC_RELEASE_JIRA_USERNAME",
    "SEMANTIC_RELEASE_JIRA_API_TOKEN",
    "SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES",
    "SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS",
    "SEMANTIC_RELEASE_JIRA_DRY_RUN",
    "SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR",
    "SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED",
    "SEMANTIC_RELEASE_JIRA_CONCURRENCY",
    "SEMANTIC_RELEASE_JIRA_TIMEOUT",
    "SEMANTIC_RELEASE_JIRA_RETRIES",
    "SEMANTIC_RELEASE_JIRA_RETRY_DELAY",
    "SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS",
    "SEMANTIC_RELEASE_JIRA_VERSION_PREFIX",
    "SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN",
  ];

  return environmentVariables.some(
    (environmentVariable) => process.env[environmentVariable] !== undefined,
  );
}

/**
 * Checks if configuration has been provided either through config object or environment variables
 * Returns true if EITHER isPluginEnabled(config) OR hasEnvironmentVariables() returns true
 */
export function isConfigurationProvided(
  config: Record<string, unknown>,
): boolean {
  return isPluginEnabled(config) || hasEnvironmentVariables();
}

/**
 * Plugin-specific config keys that cannot come from semantic-release global options.
 * semantic-release merges its global options (branches, repositoryUrl, tagFormat, dryRun, etc.)
 * into pluginConfig via `{ ...options, ...config }`. Generic keys like dryRun, timeout, retries,
 * and concurrency are excluded because they overlap with semantic-release global options.
 */
const PLUGIN_SPECIFIC_KEYS: ReadonlySet<string> = new Set([
  "createVersions",
  "customIssuePattern",
  "failOnJiraError",
  "jiraApiToken",
  "jiraServerUrl",
  "jiraUsername",
  "transitionIssues",
  "transitionToStatus",
  "versionPrefix",
]);

/**
 * Checks if the plugin is enabled by verifying if any plugin-specific config property is set.
 * Only checks keys that are unambiguously plugin-specific to avoid false positives from
 * semantic-release global options merged into the pluginConfig object.
 */
export function isPluginEnabled(config: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(config)) {
    if (PLUGIN_SPECIFIC_KEYS.has(key) && value !== undefined) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a string contains unexpanded environment variables
 * Detects patterns like ${VAR} or $VAR that suggest failed env var expansion
 */
export function isUnexpandedEnvironmentVariable(
  value: string | undefined,
): boolean {
  if (!value) return false;

  // Check for ${VAR} format - must be the ENTIRE string, uppercase only, valid characters
  // Valid env var names: uppercase letters, digits, underscores
  if (/^\$\{[A-Z_][A-Z0-9_]*\}$/.test(value)) return true;

  // Check for $VAR format - must be the ENTIRE string, uppercase only, valid characters
  // Must start with $ and be followed by uppercase letter or underscore, then alphanumeric/underscores
  if (/^\$[A-Z_][A-Z0-9_]*$/.test(value)) return true;

  return false;
}

/**
 * Validates that a string is a valid Jira issue key format (PROJECT-123)
 */
export function isValidIssueKeyFormat(key: string): boolean {
  const issueKeyPattern = getDefaultIssuePatternForValidation();
  return issueKeyPattern.test(key);
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
 * Gets the default issue pattern as a non-global RegExp for validation
 */
function getDefaultIssuePatternForValidation(): RegExp {
  return new RegExp(`^${DEFAULT_ISSUE_PATTERN}$`);
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
 * Transforms parsed environment variables (SCREAMING_SNAKE_CASE) to config format (camelCase)
 */
function transformEnvironmentToConfig(
  environment: z.infer<typeof environmentVariableSchema>,
): Partial<PluginConfig> {
  const config: Partial<PluginConfig> = {};

  if (environment.SEMANTIC_RELEASE_JIRA_SERVER_URL !== undefined) {
    config.jiraServerUrl = environment.SEMANTIC_RELEASE_JIRA_SERVER_URL;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_USERNAME !== undefined) {
    config.jiraUsername = environment.SEMANTIC_RELEASE_JIRA_USERNAME;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_API_TOKEN !== undefined) {
    config.jiraApiToken = environment.SEMANTIC_RELEASE_JIRA_API_TOKEN;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS !== undefined) {
    config.transitionToStatus =
      environment.SEMANTIC_RELEASE_JIRA_TRANSITION_TO_STATUS;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_VERSION_PREFIX !== undefined) {
    config.versionPrefix = environment.SEMANTIC_RELEASE_JIRA_VERSION_PREFIX;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN !== undefined) {
    config.customIssuePattern =
      environment.SEMANTIC_RELEASE_JIRA_CUSTOM_ISSUE_PATTERN;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES !== undefined) {
    config.transitionIssues =
      environment.SEMANTIC_RELEASE_JIRA_TRANSITION_ISSUES;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS !== undefined) {
    config.createVersions = environment.SEMANTIC_RELEASE_JIRA_CREATE_VERSIONS;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_DRY_RUN !== undefined) {
    config.dryRun = environment.SEMANTIC_RELEASE_JIRA_DRY_RUN;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR !== undefined) {
    config.failOnJiraError =
      environment.SEMANTIC_RELEASE_JIRA_FAIL_ON_JIRA_ERROR;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED !== undefined) {
    config.rejectUnauthorized =
      environment.SEMANTIC_RELEASE_JIRA_REJECT_UNAUTHORIZED;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_CONCURRENCY !== undefined) {
    config.concurrency = environment.SEMANTIC_RELEASE_JIRA_CONCURRENCY;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_TIMEOUT !== undefined) {
    config.timeout = environment.SEMANTIC_RELEASE_JIRA_TIMEOUT;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_RETRIES !== undefined) {
    config.retries = environment.SEMANTIC_RELEASE_JIRA_RETRIES;
  }
  if (environment.SEMANTIC_RELEASE_JIRA_RETRY_DELAY !== undefined) {
    config.retryDelay = environment.SEMANTIC_RELEASE_JIRA_RETRY_DELAY;
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
