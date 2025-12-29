/**
 * Jira API client
 */

import type { AxiosInstance } from "axios";

import type { JiraTransition, JiraVersion } from "~/types/index.js";

import { createResilientHttpClient } from "~/http/client.js";
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
 * Associates a Jira issue with a version
 */
export async function addVersionToIssue(
  client: AxiosInstance,
  issueKey: string,
  versionId: string,
): Promise<void> {
  await client.put(`/rest/api/2/issue/${issueKey}`, {
    fields: {
      fixVersions: [{ id: versionId }],
    },
  });
}

/**
 * Creates a Jira API client with timeouts, retries, and connection pooling
 */
export function createJiraClient(config: JiraClientConfig): AxiosInstance {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.username && config.apiToken) {
    const credentials = `${config.username}:${config.apiToken}`;
    const encodedCredentials = Buffer.from(credentials).toString("base64");
    headers["Authorization"] = `Basic ${encodedCredentials}`;
  }

  return createResilientHttpClient({
    baseURL: config.serverUrl,
    concurrency: config.concurrency,
    headers,
    retries: config.retries,
    retryDelay: config.retryDelay,
    timeout: config.timeout,
  });
}

/**
 * Creates a version in a Jira project
 */
export async function createVersion(
  client: AxiosInstance,
  projectKey: string,
  versionName: string,
): Promise<JiraVersion> {
  try {
    const { data: project } = await client.get<JiraProject>(
      `/rest/api/2/project/${projectKey}`,
    );

    const { data: existingVersions } = await client.get<JiraVersion[]>(
      `/rest/api/2/project/${projectKey}/versions`,
    );

    const existingVersion = existingVersions.find(
      (v) => v.name === versionName,
    );
    if (existingVersion) {
      return existingVersion;
    }

    const { data: newVersion } = await client.post<JiraVersion>(
      `/rest/api/2/version`,
      {
        name: versionName,
        projectId: project.id,
      },
    );

    return newVersion;
  } catch (error) {
    throw new Error(
      `Failed to create version ${versionName} in project ${projectKey}: ${getErrorMessage(error)}`,
    );
  }
}

/**
 * Fetches issue details (summary) from Jira
 * Returns undefined on error for graceful degradation
 */
export async function getIssueDetails(
  client: AxiosInstance,
  issueKey: string,
): Promise<{ key: string; summary: string } | undefined> {
  try {
    const { data } = await client.get<{
      fields: { summary: string };
      key: string;
    }>(`/rest/api/2/issue/${issueKey}`, {
      params: {
        fields: "summary",
      },
    });
    return {
      key: data.key,
      summary: data.fields.summary,
    };
  } catch {
    // Gracefully degrade - return undefined if fetch fails
    return undefined;
  }
}

/**
 * Fetches available transitions for a Jira issue
 */
export async function getIssueTransitions(
  client: AxiosInstance,
  issueKey: string,
): Promise<JiraTransition[]> {
  const { data } = await client.get<{ transitions: JiraTransition[] }>(
    `/rest/api/2/issue/${issueKey}/transitions`,
  );
  return data.transitions;
}

/**
 * Transitions a Jira issue to a new status
 */
export async function transitionIssue(
  client: AxiosInstance,
  issueKey: string,
  transitionId: string,
): Promise<void> {
  await client.post(`/rest/api/2/issue/${issueKey}/transitions`, {
    transition: {
      id: transitionId,
    },
  });
}

/**
 * Verifies that a Jira issue exists and is accessible
 */
export async function verifyIssueExists(
  client: AxiosInstance,
  issueKey: string,
): Promise<boolean> {
  try {
    await client.get(`/rest/api/2/issue/${issueKey}`, {
      params: {
        fields: "key",
      },
    });
    return true;
  } catch {
    return false;
  }
}
