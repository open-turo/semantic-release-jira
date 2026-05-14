/**
 * Semantic Release Jira Plugin
 *
 * Entry point that exports the named hook functions expected by semantic-release.
 * The plugin class lives in plugin.ts; this file wires a singleton instance to
 * the hook contract and handles the noop-by-default guard.
 */

import type { PluginConfig, SemanticReleaseContext } from "~/types/index.js";

import { isConfigurationProvided } from "~/config/validate.js";
import { SemanticReleaseJiraPlugin } from "~/plugin.js";

export { SemanticReleaseJiraPlugin } from "~/plugin.js";

const plugin = new SemanticReleaseJiraPlugin();

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
