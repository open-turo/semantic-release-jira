/**
 * Jira version management
 */

import type { AxiosInstance } from "axios";

import type { JiraIssue, Result } from "~/types/index.js";

import { addVersionToIssue, createVersion } from "~/jira/client.js";
import { getErrorMessage } from "~/utils/error.js";

/**
 * Creates or gets an existing version and associates issues with it
 */
export async function createAndAssociateVersion(
  client: AxiosInstance,
  projectKey: string,
  versionName: string,
  issues: JiraIssue[],
): Promise<Result<void>> {
  try {
    const version = await createVersion(client, projectKey, versionName);

    const results = await Promise.allSettled(
      issues.map((issue) => addVersionToIssue(client, issue.key, version.id)),
    );

    const failures = results.filter((r) => r.status === "rejected").length;

    if (failures > 0) {
      return {
        error: `Failed to associate ${failures}/${issues.length} issues with version ${versionName}`,
        success: false,
      };
    }

    return { data: undefined, success: true };
  } catch (error) {
    return {
      error: `Failed to create version ${versionName}: ${getErrorMessage(error)}`,
      success: false,
    };
  }
}

/**
 * Generates version name from repository name and release version
 */
export function generateVersionName(
  repoName: string,
  version: string,
  customPrefix?: string,
): string {
  const prefix = customPrefix ?? repoName;
  return `${prefix}-v${version}`;
}
