/**
 * Jira API client
 */

import type { AxiosInstance } from "axios";

import type { BatchContext } from "~/jira/batch-context.js";
import type {
  JiraIssue,
  JiraTransition,
  JiraVersion,
  Result,
} from "~/types/index.js";

import { createResilientHttpClient } from "~/http/client.js";
import { processBatchResults } from "~/jira/batch-context.js";
import { groupIssuesByProject } from "~/parsers/issue-collector.js";
import { getErrorMessage } from "~/utils/error.js";

export interface JiraClientConfig {
  apiToken?: string;
  concurrency?: number;
  rejectUnauthorized?: boolean;
  retries?: number;
  retryDelay?: number;
  serverUrl: string;
  timeout?: number;
  username?: string;
}

interface JiraProject {
  id: string;
  key: string;
}

/**
 * Jira API client wrapping a resilient HTTP client with batch operations
 * for issue verification, enrichment, transitions, and version management.
 */
export class JiraClient {
  private readonly http: AxiosInstance;

  constructor(config: JiraClientConfig) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.username && config.apiToken) {
      const credentials = `${config.username}:${config.apiToken}`;
      const encodedCredentials = Buffer.from(credentials).toString("base64");
      headers["Authorization"] = `Basic ${encodedCredentials}`;
    }

    this.http = createResilientHttpClient({
      baseURL: config.serverUrl,
      concurrency: config.concurrency,
      headers,
      retries: config.retries,
      retryDelay: config.retryDelay,
      timeout: config.timeout,
    });
  }

  async addVersionToIssue(issueKey: string, versionId: string): Promise<void> {
    await this.http.put(`/rest/api/2/issue/${issueKey}`, {
      fields: { fixVersions: [{ id: versionId }] },
    });
  }

  async createVersion(
    projectKey: string,
    versionName: string,
  ): Promise<JiraVersion> {
    try {
      const { data: project } = await this.http.get<JiraProject>(
        `/rest/api/2/project/${projectKey}`,
      );

      const { data: existingVersions } = await this.http.get<JiraVersion[]>(
        `/rest/api/2/project/${projectKey}/versions`,
      );

      const existingVersion = existingVersions.find(
        (v) => v.name === versionName,
      );
      if (existingVersion) {
        return existingVersion;
      }

      const { data: newVersion } = await this.http.post<JiraVersion>(
        `/rest/api/2/version`,
        { name: versionName, projectId: project.id },
      );

      return newVersion;
    } catch (error) {
      throw new Error(
        `Failed to create version ${versionName} in project ${projectKey}: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Creates versions for a release grouped by project and associates issues
   */
  async createVersions(
    issues: JiraIssue[],
    versionName: string,
    context: BatchContext,
  ): Promise<void> {
    context.logger.log("Creating Jira versions and associating issues...", {
      operation: "createVersions",
    });

    const grouped = groupIssuesByProject(issues);
    const groupedEntries = [...grouped.entries()];

    const versionTimer = context.logger.startTimer();
    const results = await Promise.allSettled(
      groupedEntries.map(([projectKey, projectIssues]) =>
        context.rateLimiter(() =>
          this.createAndAssociateVersion(
            projectKey,
            versionName,
            projectIssues,
          ),
        ),
      ),
    );

    const { failureCount, successCount } = processBatchResults(
      results,
      groupedEntries.map(
        ([projectKey, projectIssues]) =>
          `version ${versionName} in project ${projectKey} with ${String(projectIssues.length)} issues`,
      ),
      context.logger,
      {
        errorContext: (_label, index) => ({
          projectKey: groupedEntries[index][0],
        }),
        failureVerb: "Could not create",
        successVerb: "Created",
      },
    );

    context.logger.log("Version creation completed", {
      duration: versionTimer(),
      failureCount,
      operation: "createVersions",
      successCount,
    });

    if (context.failOnJiraError && failureCount > 0) {
      throw new Error(
        `Jira version creation failed for ${String(failureCount)} project(s). See logs for details.`,
      );
    }
  }

  /**
   * Fetches issue summaries in parallel with rate limiting
   */
  async fetchIssueSummaries(
    issues: JiraIssue[],
    context: BatchContext,
  ): Promise<JiraIssue[]> {
    if (issues.length === 0) {
      return issues;
    }

    context.logger.log(
      `Fetching summaries for ${String(issues.length)} Jira issues...`,
      { issueCount: issues.length, operation: "fetchIssueSummaries" },
    );

    const fetchTimer = context.logger.startTimer();
    const results = await Promise.allSettled(
      issues.map((issue) =>
        context.rateLimiter(() => this.getIssueDetails(issue.key)),
      ),
    );

    const enrichedIssues: JiraIssue[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const [index, result] of results.entries()) {
      const issue = issues[index];

      if (result.status === "fulfilled" && result.value !== undefined) {
        enrichedIssues.push({ ...issue, summary: result.value.summary });
        successCount++;
      } else {
        enrichedIssues.push(issue);
        failureCount++;

        if (result.status === "rejected") {
          context.logger.log(
            `Could not fetch summary for ${issue.key} - including without summary`,
            {
              error: result.reason,
              issueKey: issue.key,
              operation: "fetchIssueSummaries",
            },
          );
        }
      }
    }

    context.logger.success(
      `Fetched ${String(successCount)} summaries (${String(failureCount)} skipped)`,
      {
        duration: fetchTimer(),
        failureCount,
        operation: "fetchIssueSummaries",
        successCount,
      },
    );

    if (context.failOnJiraError && failureCount > 0) {
      throw new Error(
        `Failed to fetch summaries for ${String(failureCount)} Jira issue(s). See logs for details.`,
      );
    }

    return enrichedIssues;
  }

  async getIssueDetails(
    issueKey: string,
  ): Promise<undefined | { key: string; summary: string }> {
    try {
      const { data } = await this.http.get<{
        fields: { summary: string };
        key: string;
      }>(`/rest/api/2/issue/${issueKey}`, {
        params: { fields: "summary" },
      });
      return { key: data.key, summary: data.fields.summary };
    } catch {
      return undefined;
    }
  }

  // -- Low-level REST wrappers used by batch methods and tests ----------------

  async getIssueTransitions(issueKey: string): Promise<JiraTransition[]> {
    const { data } = await this.http.get<{ transitions: JiraTransition[] }>(
      `/rest/api/2/issue/${issueKey}/transitions`,
    );
    return data.transitions;
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.http.post(`/rest/api/2/issue/${issueKey}/transitions`, {
      transition: { id: transitionId },
    });
  }

  /**
   * Transitions all issues to done status in parallel with rate limiting
   */
  async transitionIssues(
    issues: JiraIssue[],
    context: { transitionToStatus?: string } & BatchContext,
  ): Promise<void> {
    context.logger.log("Transitioning issues to done status...", {
      issueCount: issues.length,
      operation: "transitionIssues",
    });

    const transitionTimer = context.logger.startTimer();
    const results = await Promise.allSettled(
      issues.map((issue) =>
        context.rateLimiter(() =>
          this.transitionIssueToDone(issue.key, context.transitionToStatus),
        ),
      ),
    );

    const { failureCount, successCount } = processBatchResults(
      results,
      issues.map((index) => index.key),
      context.logger,
      {
        errorContext: (label) => ({ issueKey: label }),
        failureVerb: "Could not transition",
        successVerb: "Transitioned",
      },
    );

    context.logger.log("Issue transitions completed", {
      duration: transitionTimer(),
      failureCount,
      operation: "transitionIssues",
      successCount,
    });

    if (context.failOnJiraError && failureCount > 0) {
      throw new Error(
        `Jira issue transitions failed for ${String(failureCount)} issue(s). See logs for details.`,
      );
    }
  }

  /**
   * Verifies Jira authentication by calling the /myself endpoint
   */
  async verifyAuthentication(logger: BatchContext["logger"]): Promise<void> {
    try {
      const timer = logger.startTimer();
      await this.http.get("/rest/api/2/myself");
      logger.success("Jira authentication verified", {
        duration: timer(),
        operation: "verifyAuthentication",
      });
    } catch (error) {
      throw new Error(`Jira authentication failed: ${getErrorMessage(error)}`);
    }
  }

  async verifyIssueExists(issueKey: string): Promise<boolean> {
    try {
      await this.http.get(`/rest/api/2/issue/${issueKey}`, {
        params: { fields: "key" },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verifies that all issues exist in Jira, returning only those that do
   */
  async verifyIssues(
    issues: JiraIssue[],
    context: BatchContext,
  ): Promise<JiraIssue[]> {
    const verificationTimer = context.logger.startTimer();
    const results = await Promise.allSettled(
      issues.map((issue) =>
        context.rateLimiter(() => this.verifyIssueExists(issue.key)),
      ),
    );

    const verifiedIssues: JiraIssue[] = [];
    for (const [index, result] of results.entries()) {
      const issue = issues[index];

      if (result.status === "fulfilled") {
        if (result.value) {
          verifiedIssues.push(issue);
        } else {
          context.logger.log(`Issue ${issue.key} not found in Jira - skipping`);
        }
      } else {
        context.logger.log(`Could not verify issue ${issue.key}`, {
          error: result.reason,
          success: false,
        });
      }
    }

    context.logger.success(
      `Verified ${String(verifiedIssues.length)} issues exist in Jira`,
      {
        duration: verificationTimer(),
        issueCount: verifiedIssues.length,
        operation: "verifyIssues",
      },
    );

    return verifiedIssues;
  }

  // -- Private helpers --------------------------------------------------------

  private async createAndAssociateVersion(
    projectKey: string,
    versionName: string,
    issues: JiraIssue[],
  ): Promise<Result<void>> {
    try {
      const version = await this.createVersion(projectKey, versionName);
      const results = await Promise.allSettled(
        issues.map((issue) => this.addVersionToIssue(issue.key, version.id)),
      );
      const failures = results.filter((r) => r.status === "rejected").length;

      if (failures > 0) {
        return {
          error: `Failed to associate ${String(failures)}/${String(issues.length)} issues with version ${versionName}`,
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

  private async transitionIssueToDone(
    issueKey: string,
    targetStatus?: string,
  ): Promise<Result<void>> {
    try {
      const transitions = await this.getIssueTransitions(issueKey);
      const doneTransition = findDoneTransition(transitions, targetStatus);

      if (!doneTransition) {
        return {
          error: `No matching "done" transition found for issue ${issueKey}`,
          success: false,
        };
      }

      await this.transitionIssue(issueKey, doneTransition.id);
      return { data: undefined, success: true };
    } catch (error) {
      return {
        error: `Failed to transition issue ${issueKey}: ${getErrorMessage(error)}`,
        success: false,
      };
    }
  }
}

/**
 * Fuzzy matches a transition name against common "done" patterns
 */
export function findDoneTransition(
  transitions: JiraTransition[],
  targetStatus?: string,
): JiraTransition | undefined {
  if (targetStatus) {
    const exactMatch = transitions.find(
      (t) => t.name.toLowerCase() === targetStatus.toLowerCase(),
    );
    if (exactMatch) {
      return exactMatch;
    }
  }

  const donePatterns = ["done", "closed", "completed", "resolved"];

  for (const pattern of donePatterns) {
    const match = transitions.find((t) =>
      t.name.toLowerCase().includes(pattern),
    );
    if (match) {
      return match;
    }
  }

  return undefined;
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
