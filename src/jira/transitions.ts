/**
 * Jira issue transition logic
 */

import type { AxiosInstance } from "axios";

import type { JiraTransition, Result } from "~/types/index.js";

import { getIssueTransitions, transitionIssue } from "~/jira/client.js";
import { getErrorMessage } from "~/utils/error.js";

/**
 * Fuzzy matches a transition name against common "done" patterns
 */
export function findDoneTransition(
  transitions: JiraTransition[],
  targetStatus?: string,
): JiraTransition | undefined {
  // If target status specified, try exact match first
  if (targetStatus) {
    const exactMatch = transitions.find(
      (t) => t.name.toLowerCase() === targetStatus.toLowerCase(),
    );
    if (exactMatch) {
      return exactMatch;
    }
  }

  // Fuzzy match against common done statuses
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
 * Transitions an issue to done status
 */
export async function transitionIssueToDone(
  client: AxiosInstance,
  issueKey: string,
  targetStatus?: string,
): Promise<Result<void>> {
  try {
    const transitions = await getIssueTransitions(client, issueKey);
    const doneTransition = findDoneTransition(transitions, targetStatus);

    if (!doneTransition) {
      return {
        error: `No matching "done" transition found for issue ${issueKey}`,
        success: false,
      };
    }

    await transitionIssue(client, issueKey, doneTransition.id);

    return { data: undefined, success: true };
  } catch (error) {
    return {
      error: `Failed to transition issue ${issueKey}: ${getErrorMessage(error)}`,
      success: false,
    };
  }
}
