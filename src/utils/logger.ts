/**
 * Structured logging utilities using semantic-release logger
 * Provides automatic credential redaction using fast-redact
 */

import fastRedact from "fast-redact";

export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  error: (message: string, ...arguments_: unknown[]) => void;
  log: (message: string, ...arguments_: unknown[]) => void;
  success: (message: string, ...arguments_: unknown[]) => void;
}

// Paths to redact using fast-redact syntax
const REDACT_PATHS = [
  "jiraApiToken",
  "jiraUsername",
  "apiToken",
  "token",
  "password",
  "secret",
  "credential",
  "authorization",
  "auth",
  "*.jiraApiToken",
  "*.apiToken",
  "*.token",
  "*.password",
  "*.secret",
  "*.credential",
  "*.authorization",
  "*.auth",
  "*.headers.authorization",
  "*.headers.Authorization",
  "config.headers.authorization",
  "config.headers.Authorization",
  "config.auth.password",
  "error.config.headers.authorization",
  "error.config.headers.Authorization",
  "error.config.auth.password",
  "error.message",
  "error.stack",
];

// Create redactor instance
const redact = fastRedact({
  censor: "[REDACTED]",
  paths: REDACT_PATHS,
  serialize: false, // We'll handle serialization ourselves
});

/**
 * Wraps semantic-release logger with automatic credential redaction
 */
export class StructuredLogger {
  constructor(private baseLogger: Logger) {}

  error(message: string, context?: LogContext): void {
    this.writeLog(this.baseLogger.error, message, context);
  }

  log(message: string, context?: LogContext): void {
    this.writeLog(this.baseLogger.log, message, context);
  }

  startTimer(): () => number {
    const startTime = Date.now();
    return () => Date.now() - startTime;
  }

  success(message: string, context?: LogContext): void {
    this.writeLog(this.baseLogger.success, message, context);
  }

  /**
   * Normalize context by converting Error objects to plain objects
   * This allows fast-redact to properly sanitize error messages and stacks
   */
  private normalizeContext(context: LogContext): LogContext {
    const normalized: LogContext = {};

    for (const [key, value] of Object.entries(context)) {
      normalized[key] = this.normalizeValue(value);
    }

    return normalized;
  }

  /**
   * Normalize a value by converting Error objects to plain objects
   */
  private normalizeValue(value: unknown): unknown {
    if (value === null || value === undefined) return value;

    if (value instanceof Error) {
      return {
        message: this.sanitizeString(value.message),
        name: value.name,
        stack: value.stack ? this.sanitizeString(value.stack) : undefined,
      };
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeValue(item));
    }

    if (typeof value === "object") {
      const normalized: Record<string, unknown> = {};
      for (const [key, value_] of Object.entries(value)) {
        normalized[key] = this.normalizeValue(value_);
      }
      return normalized;
    }

    return value;
  }

  /**
   * Sanitize credentials in string messages using regex patterns
   */
  private sanitizeString(string_: string): string {
    let result = string_;

    // Sanitize Bearer tokens
    result = result.replaceAll(/Bearer\s+[\w\-.~+/]+=*/gi, "Bearer [REDACTED]");

    // Sanitize Basic auth
    result = result.replaceAll(/Basic\s+[\w+/=]+/gi, "Basic [REDACTED]");

    // Sanitize long hex tokens (32+ chars)
    result = result.replaceAll(/\b[a-f\d]{32,}\b/gi, "[REDACTED_TOKEN]");

    // Sanitize base64-like tokens (20+ chars with mixed case and digits)
    result = result.replaceAll(/\b[\w+/]{20,}={0,2}\b/g, (match: string) => {
      // Only redact if it looks like a token (has mixed case and digits)
      return /[A-Z]/.test(match) && /[a-z]/.test(match) && /\d/.test(match)
        ? "[REDACTED_BASE64]"
        : match;
    });

    return result;
  }

  /**
   * Common logging implementation with sanitization
   */
  private writeLog(
    logFunction: (message: string) => void,
    message: string,
    context?: LogContext,
  ): void {
    const safeMessage = this.sanitizeString(message);
    const safeContext = context
      ? redact(this.normalizeContext({ ...context }))
      : undefined;
    const output = safeContext
      ? `${safeMessage} ${JSON.stringify(safeContext)}`
      : safeMessage;
    logFunction(output);
  }
}
