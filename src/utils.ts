/**
 * Utility functions for the plugin
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { SemanticReleaseContext } from "~/types/index.js";

interface PackageJson {
  version: string;
}

let cachedPackageJson: PackageJson | undefined;

/**
 * Gets the package.json information (cached)
 */
export function getPackageInfo(): PackageJson {
  if (!cachedPackageJson) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const rawPackageJson = readFileSync(
      path.join(__dirname, "../package.json"),
      "utf8",
    );
    cachedPackageJson = parsePackageJson(rawPackageJson);
  }
  return cachedPackageJson;
}

/**
 * Extracts repository name from environment or git config
 */
export function getRepositoryName(
  environment: Record<string, string | undefined>,
): string {
  // Try GitHub environment first
  if (environment.GITHUB_REPOSITORY) {
    const [, repo] = environment.GITHUB_REPOSITORY.split("/");
    return repo;
  }

  // Fallback to generic name
  return "unknown-repo";
}

/**
 * Determines if Jira write operations should be executed
 */
export function shouldUpdateJira(context: SemanticReleaseContext): boolean {
  const isDefaultBranch =
    context.branch.name === context.branch.main ||
    context.branch.name === "main" ||
    context.branch.name === "master";

  const isPrerelease = context.nextRelease?.type.includes("pre") ?? false;

  return isDefaultBranch && !isPrerelease;
}

/**
 * Validates and extracts package info from parsed JSON
 */
function parsePackageJson(raw: string): PackageJson {
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "version" in parsed &&
    typeof parsed.version === "string"
  ) {
    return { version: parsed.version };
  }
  throw new Error("Invalid package.json: missing version field");
}
