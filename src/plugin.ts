/**
 * Semantic Release Jira Plugin Class
 *
 * Orchestrates Jira issue tracking across the semantic-release lifecycle.
 * Jira operations are delegated to JiraClient; GitHub operations to github/client.
 */

import pLimit from "p-limit";

import type { BatchContext } from "~/jira/batch-context.js";
import type {
  JiraIssue,
  PluginConfig,
  SemanticReleaseContext,
  ValidatedPluginConfig,
} from "~/types/index.js";

import { getIssuePattern, validateConfig } from "~/config/validate.js";
import { fetchGitHubPullRequests } from "~/github/client.js";
import { generateVersionName, JiraClient } from "~/jira/client.js";
import {
  collectIssues,
  groupIssuesByProject,
  parseIssueKeys,
} from "~/parsers/issue-collector.js";
import { generateJiraNotesSection } from "~/release-notes/formatter.js";
import { getRepositoryName, shouldUpdateJira } from "~/utils.js";
import { getErrorMessage } from "~/utils/error.js";
import { StructuredLogger } from "~/utils/logger.js";

export class SemanticReleaseJiraPlugin {
  private _config: undefined | ValidatedPluginConfig;
  private _issuesCollected = false;
  private _jira: JiraClient | undefined;
  private _logger: StructuredLogger | undefined;
  private _rateLimiter: ReturnType<typeof pLimit> | undefined;
  private collectedIssues: JiraIssue[] = [];

  private get config(): ValidatedPluginConfig {
    if (!this._config) {
      throw new Error(
        "Plugin not initialized. verifyConditions must be called first.",
      );
    }
    return this._config;
  }

  private get jira(): JiraClient {
    if (!this._jira) {
      throw new Error(
        "Plugin not initialized. verifyConditions must be called first.",
      );
    }
    return this._jira;
  }

  private get logger(): StructuredLogger {
    if (!this._logger) {
      throw new Error(
        "Plugin not initialized. verifyConditions must be called first.",
      );
    }
    return this._logger;
  }

  private get rateLimiter(): ReturnType<typeof pLimit> {
    if (!this._rateLimiter) {
      throw new Error(
        "Plugin not initialized. verifyConditions must be called first.",
      );
    }
    return this._rateLimiter;
  }

  async analyzeCommits(
    _pluginConfig: Partial<PluginConfig>,
    context: SemanticReleaseContext,
  ): Promise<void> {
    if (this._issuesCollected) {
      return;
    }

    const { branch, commits, env } = context;
    const timer = this.logger.startTimer();

    this.logger.log(
      "Collecting Jira issues from commits, branches, and PRs...",
      { operation: "analyzeCommits" },
    );

    const issuePattern = getIssuePattern(this.config);

    this.logger.log(`Branch name: ${branch.name}`, {
      operation: "analyzeCommits",
    });

    const pullRequests = await fetchGitHubPullRequests(commits, env, {
      branchName: branch.name,
      concurrency: this.config.concurrency,
      logger: this.logger,
    });

    for (const pr of pullRequests) {
      this.logger.log(
        `PR #${String(pr.number)} (state: ${pr.state}, merged: ${String(pr.merged)})`,
        { body: pr.body ?? "(empty)", operation: "analyzeCommits" },
      );
    }

    const collected = collectIssues(
      commits,
      branch.name,
      pullRequests,
      issuePattern,
    );

    this.logger.log(`Found ${collected.issues.size} unique Jira issues`, {
      issueCount: collected.issues.size,
      operation: "collectIssues",
      sources: collected.sources,
    });

    const allIssues = parseIssueKeys(collected.issues, issuePattern);
    this.collectedIssues = this.hasJiraCredentials()
      ? await this.jira.verifyIssues(allIssues, this.batchContext())
      : allIssues;
    this._issuesCollected = true;

    if (this.collectedIssues.length > 0) {
      this.logger.success(
        `Collected issues: ${this.collectedIssues.map((index) => index.key).join(", ")}`,
        {
          duration: timer(),
          issueCount: this.collectedIssues.length,
          operation: "analyzeCommits",
        },
      );
    }
  }

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
      { issueCount: this.collectedIssues.length, operation: "generateNotes" },
    );

    let enrichedIssues = this.collectedIssues;
    if (this.hasJiraCredentials()) {
      enrichedIssues = await this.jira.fetchIssueSummaries(
        this.collectedIssues,
        this.batchContext(),
      );
    } else {
      this.logger.log(
        "No Jira credentials provided - skipping issue summary fetching",
        { operation: "generateNotes" },
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
        { operation: "success" },
      );
      return;
    }
    if (this.config.dryRun) {
      this.logDryRunActions(env, nextRelease);
      return;
    }

    const context_ = this.batchContext();

    if (this.config.transitionIssues) {
      await this.jira.transitionIssues(this.collectedIssues, {
        ...context_,
        transitionToStatus: this.config.transitionToStatus,
      });
    }

    if (this.config.createVersions) {
      const versionName = generateVersionName(
        getRepositoryName(env),
        nextRelease.version,
        this.config.versionPrefix,
      );
      await this.jira.createVersions(
        this.collectedIssues,
        versionName,
        context_,
      );
    }

    this.logger.success("Jira update completed", {
      duration: timer(),
      operation: "success",
    });
  }

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
      this._jira = new JiraClient({
        apiToken: this._config.jiraApiToken,
        concurrency: this._config.concurrency,
        rejectUnauthorized: this._config.rejectUnauthorized,
        retries: this._config.retries,
        retryDelay: this._config.retryDelay,
        serverUrl: this._config.jiraServerUrl,
        timeout: this._config.timeout,
        username: this._config.jiraUsername,
      });

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
        await this._jira.verifyAuthentication(this._logger);
      } else {
        this._logger.log(
          "No Jira credentials provided - running in read-only mode",
          { operation: "verifyConditions" },
        );
      }
    } catch (error) {
      const errorLogger = this._logger ?? new StructuredLogger(context.logger);
      errorLogger.error(
        `Jira plugin configuration error: ${getErrorMessage(error)}`,
        { error, operation: "verifyConditions", success: false },
      );
      throw error;
    }
  }

  private batchContext(): BatchContext {
    return {
      failOnJiraError: this.config.failOnJiraError,
      logger: this.logger,
      rateLimiter: this.rateLimiter,
    };
  }

  private hasJiraCredentials(): boolean {
    return Boolean(this.config.jiraUsername && this.config.jiraApiToken);
  }

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
      const versionName = generateVersionName(
        getRepositoryName(environment),
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
}
