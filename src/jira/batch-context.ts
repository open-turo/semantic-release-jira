/**
 * Shared types and utilities for batch Jira operations
 */

import type pLimit from "p-limit";

import type { StructuredLogger } from "~/utils/logger.js";

/**
 * Dependencies shared across batch Jira operations
 */
export interface BatchContext {
  failOnJiraError: boolean;
  logger: StructuredLogger;
  rateLimiter: ReturnType<typeof pLimit>;
}

/**
 * Processes Promise.allSettled results from batch operations, logs per-item
 * outcomes, and returns aggregate counts.
 *
 * @param results - The settled promise results
 * @param labels - One label string per result, used in log messages (e.g. issue key, version name)
 * @param logger - Structured logger
 * @param options - Verbs and optional extra context for log messages
 */
export function processBatchResults(
  results: PromiseSettledResult<{ error?: string; success: boolean }>[],
  labels: string[],
  logger: StructuredLogger,
  options: {
    errorContext?: (label: string, index: number) => Record<string, unknown>;
    failureVerb: string;
    successVerb: string;
  },
): { failureCount: number; successCount: number } {
  let successCount = 0;
  let failureCount = 0;

  for (const [index, result] of results.entries()) {
    const label = labels[index];

    if (result.status === "fulfilled") {
      if (result.value.success) {
        logger.success(`${options.successVerb} ${label}`);
        successCount++;
      } else {
        logger.log(`${options.failureVerb} ${label}: ${result.value.error}`);
        failureCount++;
      }
    } else {
      logger.error(`Error: ${options.failureVerb.toLowerCase()} ${label}`, {
        error: result.reason,
        ...options.errorContext?.(label, index),
      });
      failureCount++;
    }
  }

  return { failureCount, successCount };
}
