/**
 * Semantic Release Jira Plugin
 *
 * Orchestrates Jira issue tracking across the semantic-release lifecycle:
 * collecting issues from commits, branches, and PRs; generating release notes;
 * and optionally transitioning issues and creating fix versions.
 */

import pLimit from "p-limit";

import type {
  GitHubPullRequest,
  JiraIssue,
  PluginConfig,
  SemanticReleaseContext,
  ValidatedPluginConfig,
} from "~/types/index.js";

import {
  getIssuePattern,
  isConfigurationProvided,
  validateConfig,
} from "~/config/validate.js";
import {
  createGitHubClient,
  detectGitHubRepo,
  fetchPullRequestsForCommits,
} from "~/github/client.js";
import {
  createJiraClient,
  getIssueDetails,
  verifyIssueExists,
} from "~/jira/client.js";
import { transitionIssueToDone } from "~/jira/transitions.js";
import {
  createAndAssociateVersion,
  generateVersionName,
} from "~/jira/versions.js";
import {
  collectIssues,
  groupIssuesByProject,
  parseIssueKeys,
} from "~/parsers/issue-collector.js";
import { generateJiraNotesSection } from "~/release-notes/formatter.js";
import { getRepositoryName, shouldUpdateJira } from "~/utils.js";
import { getErrorMessage } from "~/utils/error.js";
import { StructuredLogger } from "~/utils/logger.js";

/**
 * Semantic Release Jira Plugin Class
 *
 * Uses instance state to prevent cross-execution contamination
 * when semantic-release reuses plugin instances.
 *
 * @example
 * // In .releaserc.js (automatic - semantic-release handles this)
 * export default {
 *   plugins: [
 *     ['@open-turo/semantic-release-jira', {
 *       jiraServerUrl: 'https://company.atlassian.net',
 *       jiraUsername: process.env.JIRA_USERNAME,
 *       jiraApiToken: process.env.JIRA_API_TOKEN,
 *       transitionIssues: true,
 *       createVersions: true,
 *     }]
 *   ]
 * };
 */
export class SemanticReleaseJiraPlugin {
  private _config: undefined | ValidatedPluginConfig;
  private _logger: StructuredLogger | undefined;
  private _rateLimiter: ReturnType<typeof pLimit> | undefined;
  // Instance state - prevents cross-execution contamination
  private collectedIssues: JiraIssue[] = [];

  /**
   * Get config with initialization check
   */
  private get config(): ValidatedPluginConfig {
    if (!this._config) {
      throw new Error(
        "Plugin not initialized. verifyConditions must be called first.",
      );
    }
    return this._config;
  }

  /**
   * Get logger with initialization check
   */
  private get logger(): StructuredLogger {
    if (!this._logger) {
      throw new Error(
        "Plugin not initialized. verifyConditions must be called first.",
      );
    }
    return this._logger;
  }

  /**
   * Get rate limiter with initialization check
   */
  private get rateLimiter(): ReturnType<typeof pLimit> {
    if (!this._rateLimiter) {
      throw new Error(
        "Plugin not initialized. verifyConditions must be called first.",
      );
    }
    return this._rateLimiter;
  }

  /**
   * Analyze commits to collect Jira issues
   */
  async analyzeCommits(
    _pluginConfig: Partial<PluginConfig>,
    context: SemanticReleaseContext,
  ): Promise<void> {
    if (this.collectedIssues.length > 0) {
      return;
    }

    const { branch, commits, env } = context;
    const timer = this.logger.startTimer();

    this.logger.log(
      "Collecting Jira issues from commits, branches, and PRs...",
      {
        operation: "analyzeCommits",
      },
    );

    const issuePattern = getIssuePattern(this.config);

    this.logger.log(`Branch name: ${branch.name}`, {
      operation: "analyzeCommits",
    });

    const pullRequests = await this.fetchGitHubPullRequests(commits, env);

    for (const pr of pullRequests) {
      this.logger.log(
        `PR #${String(pr.number)} (state: ${pr.state}, merged: ${String(pr.merged)})`,
        {
          body: pr.body ?? "(empty)",
          operation: "analyzeCommits",
        },
      );
    }

    const collected = collectIssues(
      commits,
      branch.name,
      pullRequests,
      issuePattern,
    );

    this.logCollectionResults(collected);

    const allIssues = parseIssueKeys(collected.issues, issuePattern);
    this.collectedIssues = this.hasJiraCredentials()
      ? await this.verifyIssuesInJira(allIssues)
      : allIssues;

    if (this.collectedIssues.length > 0) {
      this.logger.success(
        `Collected issues: ${this.collectedIssues.map((issue) => issue.key).join(", ")}`,
        {
          duration: timer(),
          issueCount: this.collectedIssues.length,
          operation: "analyzeCommits",
        },
      );
    }
  }

  /**
   * Generate release notes with Jira issues section
   */
  async generateNotes(
    _pluginConfig: Partial<PluginConfig>,
    _context: SemanticReleaseContext,
  ): Promise<string> {
    const timer = this.logger.startTimer();

    if (this.collectedIssues.length === 0) {
      this.logger.log("No Jira issues to add to release notes", {
        operation: "generateNotes",
      });
      return "";
    }

    this.logger.log(
      `Generating release notes for ${this.collectedIssues.length} Jira issues`,
      {
        issueCount: this.collectedIssues.length,
        operation: "generateNotes",
      },
    );

    let enrichedIssues = this.collectedIssues;
    if (this.hasJiraCredentials()) {
      const client = this.createJiraClientInstance();
      enrichedIssues = await this.fetchIssueSummaries(
        client,
        this.collectedIssues,
      );
    } else {
      this.logger.log(
        "No Jira credentials provided - skipping issue summary fetching",
        {
          operation: "generateNotes",
        },
      );
    }

    const notes = generateJiraNotesSection(
      enrichedIssues,
      this.config.jiraServerUrl,
    );

    this.logger.success("Generated Jira release notes section", {
      duration: timer(),
      operation: "generateNotes",
    });

    return notes;
  }

  /**
   * Update Jira after successful release
   */
  async success(
    _pluginConfig: Partial<PluginConfig>,
    context: SemanticReleaseContext,
  ): Promise<void> {
    const { env, nextRelease } = context;
    const timer = this.logger.startTimer();

    if (!nextRelease) {
      this.logger.log("No release to process - skipping Jira updates", {
        operation: "success",
      });
      return;
    }

    if (this.collectedIssues.length === 0) {
      this.logger.log("No Jira issues to update", { operation: "success" });
      return;
    }

    if (!shouldUpdateJira(context)) {
      this.logger.log(
        "Skipping Jira updates (not on default branch or is a prerelease)",
        { operation: "success" },
      );
      return;
    }

    if (!this.hasJiraCredentials()) {
      this.logger.log(
        "No Jira credentials provided - skipping write operations",
        {
          operation: "success",
        },
      );
      return;
    }

    if (this.config.dryRun) {
      this.logDryRunActions(env, nextRelease);
      return;
    }

    const client = this.createJiraClientInstance();

    if (this.config.transitionIssues) {
      await this.transitionIssues(client);
    }

    if (this.config.createVersions) {
      await this.createVersions(client, env, nextRelease);
    }

    this.logger.success("Jira update completed", {
      duration: timer(),
      operation: "success",
    });
  }

  /**
   * Verify plugin configuration and credentials
   */
  async verifyConditions(
    pluginConfig: Partial<PluginConfig>,
    context: SemanticReleaseContext,
  ): Promise<void> {
    if (this._config) {
      return;
    }

    try {
      this._config = validateConfig(pluginConfig);
      this._logger = new StructuredLogger(context.logger);
      this._rateLimiter = pLimit(this._config.concurrency);

      this._logger.log("Jira plugin configuration validated successfully", {
        config: {
          concurrency: this._config.concurrency,
          createVersions: this._config.createVersions,
          dryRun: this._config.dryRun,
          failOnJiraError: this._config.failOnJiraError,
          jiraServerUrl: this._config.jiraServerUrl,
          retries: this._config.retries,
          timeout: this._config.timeout,
          transitionIssues: this._config.transitionIssues,
        },
        operation: "verifyConditions",
      });

      if (this.hasJiraCredentials()) {
        await this.verifyJiraAuthentication();
      } else {
        this._logger.log(
          "No Jira credentials provided - running in read-only mode",
          {
            operation: "verifyConditions",
          },
        );
      }
    } catch (error) {
      const errorLogger = this._logger ?? new StructuredLogger(context.logger);
      const errorMessage = getErrorMessage(error);
      errorLogger.error(`Jira plugin configuration error: ${errorMessage}`, {
        error: error,
        operation: "verifyConditions",
        success: false,
      });
      throw error;
    }
  }

  /**
   * Create Jira client instance with current configuration
   */
  private createJiraClientInstance(): ReturnType<typeof createJiraClient> {
    return createJiraClient({
      apiToken: this.config.jiraApiToken,
      concurrency: this.config.concurrency,
      rejectUnauthorized: this.config.rejectUnauthorized,
      retries: this.config.retries,
      retryDelay: this.config.retryDelay,
      serverUrl: this.config.jiraServerUrl,
      timeout: this.config.timeout,
      username: this.config.jiraUsername,
    });
  }

  /**
   * Create versions and associate issues
   */
  private async createVersions(
    client: ReturnType<typeof createJiraClient>,
    environment: Record<string, string | undefined>,
    nextRelease: { version: string },
  ): Promise<void> {
    this.logger.log("Creating Jira versions and associating issues...", {
      operation: "createVersions",
    });

    const repoName = getRepositoryName(environment);
    const versionName = generateVersionName(
      repoName,
      nextRelease.version,
      this.config.versionPrefix,
    );

    const grouped = groupIssuesByProject(this.collectedIssues);
    const groupedEntries = [...grouped.entries()];

    const versionTimer = this.logger.startTimer();
    const results = await Promise.allSettled(
      groupedEntries.map(([projectKey, issues]) =>
        this.rateLimiter(() =>
          createAndAssociateVersion(client, projectKey, versionName, issues),
        ),
      ),
    );

    const { failureCount, successCount } = this.processVersionResults(
      results,
      groupedEntries,
      versionName,
    );

    this.logger.log("Version creation completed", {
      duration: versionTimer(),
      failureCount,
      operation: "createVersions",
      successCount,
    });

    if (this.config.failOnJiraError && failureCount > 0) {
      throw new Error(
        `Jira version creation failed for ${failureCount} project(s). See logs for details.`,
      );
    }
  }

  /**
   * Fetch GitHub pull requests for commits
   */
  private async fetchGitHubPullRequests(
    commits: Array<{ hash: string; message: string }>,
    environment: Record<string, string | undefined>,
  ): Promise<GitHubPullRequest[]> {
    const githubConfig = detectGitHubRepo(environment);

    if (!githubConfig) {
      this.logger.log(
        "Not running in GitHub environment - skipping PR parsing",
        {
          operation: "fetchPullRequests",
        },
      );
      return [];
    }

    try {
      const client = createGitHubClient(githubConfig.token);
      const commitShas = commits.map((c) => c.hash);

      const pullRequests = await fetchPullRequestsForCommits(
        client,
        githubConfig.owner,
        githubConfig.repo,
        commitShas,
        this.config.concurrency,
      );

      this.logger.log(
        `Fetched ${pullRequests.length} pull requests from GitHub`,
        {
          operation: "fetchPullRequests",
          prCount: pullRequests.length,
        },
      );
      return pullRequests;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.log(`Could not fetch GitHub PRs: ${errorMessage}`, {
        error: error,
        operation: "fetchPullRequests",
        success: false,
      });
      return [];
    }
  }

  /**
   * Fetch issue summaries from Jira with parallel requests and rate limiting
   */
  private async fetchIssueSummaries(
    client: ReturnType<typeof createJiraClient>,
    issues: JiraIssue[],
  ): Promise<JiraIssue[]> {
    if (issues.length === 0) {
      return issues;
    }

    this.logger.log(`Fetching summaries for ${issues.length} Jira issues...`, {
      issueCount: issues.length,
      operation: "fetchIssueSummaries",
    });

    const fetchTimer = this.logger.startTimer();
    const results = await Promise.allSettled(
      issues.map((issue) =>
        this.rateLimiter(() => getIssueDetails(client, issue.key)),
      ),
    );

    const enrichedIssues: JiraIssue[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const [index, result] of results.entries()) {
      const issue = issues[index];

      if (result.status === "fulfilled" && result.value !== undefined) {
        enrichedIssues.push({
          ...issue,
          summary: result.value.summary,
        });
        successCount++;
      } else {
        enrichedIssues.push(issue);
        failureCount++;

        if (result.status === "rejected") {
          this.logger.log(
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

    this.logger.success(
      `Fetched ${successCount} summaries (${failureCount} skipped)`,
      {
        duration: fetchTimer(),
        failureCount,
        operation: "fetchIssueSummaries",
        successCount,
      },
    );

    if (this.config.failOnJiraError && failureCount > 0) {
      throw new Error(
        `Failed to fetch summaries for ${failureCount} Jira issue(s). See logs for details.`,
      );
    }

    return enrichedIssues;
  }

  /**
   * Check if Jira credentials are configured
   */
  private hasJiraCredentials(): boolean {
    return Boolean(this.config.jiraUsername && this.config.jiraApiToken);
  }

  /**
   * Log collection results
   */
  private logCollectionResults(collected: {
    issues: Set<string>;
    sources: { branch: number; commits: number; pullRequests: number };
  }): void {
    this.logger.log(`Found ${collected.issues.size} unique Jira issues`, {
      issueCount: collected.issues.size,
      operation: "collectIssues",
      sources: collected.sources,
    });
  }

  /**
   * Log dry run actions without executing them
   */
  private logDryRunActions(
    environment: Record<string, string | undefined>,
    nextRelease: { version: string },
  ): void {
    this.logger.log("DRY RUN MODE: Would update Jira issues but skipping", {
      dryRun: true,
      issueCount: this.collectedIssues.length,
      operation: "success",
    });

    if (this.config.transitionIssues) {
      this.logger.log("Would transition issues:");
      for (const issue of this.collectedIssues) {
        this.logger.log(`  - ${issue.key} -> done`);
      }
    }

    if (this.config.createVersions) {
      const repoName = getRepositoryName(environment);
      const versionName = generateVersionName(
        repoName,
        nextRelease.version,
        this.config.versionPrefix,
      );
      const grouped = groupIssuesByProject(this.collectedIssues);

      this.logger.log("Would create versions:");
      for (const [projectKey, issues] of grouped) {
        this.logger.log(
          `  - ${projectKey}/${versionName} with ${issues.length} issues`,
        );
      }
    }
  }

  /**
   * Process issue transition results and log outcomes
   */
  private processTransitionResults(
    results: PromiseSettledResult<{ error?: string; success: boolean }>[],
    issues: JiraIssue[],
  ): { failureCount: number; successCount: number } {
    let successCount = 0;
    let failureCount = 0;

    for (const [index, result] of results.entries()) {
      const issue = issues[index];

      if (result.status === "fulfilled") {
        if (result.value.success) {
          this.logger.success(`Transitioned ${issue.key} to done`);
          successCount++;
        } else {
          this.logger.log(
            `Could not transition ${issue.key}: ${result.value.error}`,
          );
          failureCount++;
        }
      } else {
        this.logger.error(`Error transitioning ${issue.key}`, {
          error: result.reason,
          issueKey: issue.key,
        });
        failureCount++;
      }
    }

    return { failureCount, successCount };
  }

  /**
   * Process version creation results and log outcomes
   */
  private processVersionResults(
    results: PromiseSettledResult<{ error?: string; success: boolean }>[],
    groupedEntries: [string, JiraIssue[]][],
    versionName: string,
  ): { failureCount: number; successCount: number } {
    let successCount = 0;
    let failureCount = 0;

    for (const [index, result] of results.entries()) {
      const [projectKey, issues] = groupedEntries[index];

      if (result.status === "fulfilled") {
        if (result.value.success) {
          this.logger.success(
            `Created version ${versionName} in project ${projectKey} with ${issues.length} issues`,
          );
          successCount++;
        } else {
          this.logger.log(
            `Could not create version ${versionName}: ${result.value.error}`,
          );
          failureCount++;
        }
      } else {
        this.logger.error(`Error creating version ${versionName}`, {
          error: result.reason,
          projectKey,
        });
        failureCount++;
      }
    }

    return { failureCount, successCount };
  }

  /**
   * Transition issues to done status
   */
  private async transitionIssues(
    client: ReturnType<typeof createJiraClient>,
  ): Promise<void> {
    this.logger.log("Transitioning issues to done status...", {
      issueCount: this.collectedIssues.length,
      operation: "transitionIssues",
    });

    const transitionTimer = this.logger.startTimer();
    const results = await Promise.allSettled(
      this.collectedIssues.map((issue) =>
        this.rateLimiter(() =>
          transitionIssueToDone(
            client,
            issue.key,
            this.config.transitionToStatus,
          ),
        ),
      ),
    );

    const { failureCount, successCount } = this.processTransitionResults(
      results,
      this.collectedIssues,
    );

    this.logger.log("Issue transitions completed", {
      duration: transitionTimer(),
      failureCount,
      operation: "transitionIssues",
      successCount,
    });

    if (this.config.failOnJiraError && failureCount > 0) {
      throw new Error(
        `Jira issue transitions failed for ${failureCount} issue(s). See logs for details.`,
      );
    }
  }

  /**
   * Verify issues exist in Jira with concurrent requests
   */
  private async verifyIssuesInJira(
    allIssues: JiraIssue[],
  ): Promise<JiraIssue[]> {
    const client = this.createJiraClientInstance();
    const verificationTimer = this.logger.startTimer();
    const results = await Promise.allSettled(
      allIssues.map((issue) =>
        this.rateLimiter(() => verifyIssueExists(client, issue.key)),
      ),
    );

    const verifiedIssues: JiraIssue[] = [];
    for (const [index, result] of results.entries()) {
      const issue = allIssues[index];

      if (result.status === "fulfilled") {
        if (result.value) {
          verifiedIssues.push(issue);
        } else {
          this.logger.log(`Issue ${issue.key} not found in Jira - skipping`);
        }
      } else {
        this.logger.log(`Could not verify issue ${issue.key}`, {
          error: result.reason,
          success: false,
        });
      }
    }

    this.logger.success(
      `Verified ${verifiedIssues.length} issues exist in Jira`,
      {
        duration: verificationTimer(),
        issueCount: verifiedIssues.length,
        operation: "verifyIssues",
      },
    );

    return verifiedIssues;
  }

  /**
   * Verify Jira authentication
   */
  private async verifyJiraAuthentication(): Promise<void> {
    const client = this.createJiraClientInstance();

    try {
      const timer = this.logger.startTimer();
      await client.get("/rest/api/2/myself");
      this.logger.success("Jira authentication verified", {
        duration: timer(),
        operation: "verifyAuthentication",
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new Error(`Jira authentication failed: ${errorMessage}`);
    }
  }
}

const plugin = new SemanticReleaseJiraPlugin();

// ============================================================================
// Exports for semantic release. They need to be single function exports
// ============================================================================

export async function analyzeCommits(
  pluginConfig: Partial<PluginConfig>,
  context: SemanticReleaseContext,
): Promise<void> {
  if (!isConfigurationProvided(pluginConfig)) {
    context.logger.log("No configuration detected, plugin disabled");
    return;
  }
  await plugin.verifyConditions(pluginConfig, context);
  return plugin.analyzeCommits(pluginConfig, context);
}

export async function generateNotes(
  pluginConfig: Partial<PluginConfig>,
  context: SemanticReleaseContext,
): Promise<string> {
  if (!isConfigurationProvided(pluginConfig)) {
    context.logger.log("No configuration detected, plugin disabled");
    return "";
  }
  await plugin.verifyConditions(pluginConfig, context);
  await plugin.analyzeCommits(pluginConfig, context);
  return plugin.generateNotes(pluginConfig, context);
}

export async function success(
  pluginConfig: Partial<PluginConfig>,
  context: SemanticReleaseContext,
): Promise<void> {
  if (!isConfigurationProvided(pluginConfig)) {
    context.logger.log("No configuration detected, plugin disabled");
    return;
  }
  await plugin.verifyConditions(pluginConfig, context);
  await plugin.analyzeCommits(pluginConfig, context);
  return plugin.success(pluginConfig, context);
}

export async function verifyConditions(
  pluginConfig: Partial<PluginConfig>,
  context: SemanticReleaseContext,
): Promise<void> {
  if (!isConfigurationProvided(pluginConfig)) {
    context.logger.log("No configuration detected, plugin disabled");
    return;
  }
  return plugin.verifyConditions(pluginConfig, context);
}
