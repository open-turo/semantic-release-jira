/**
 * Shared utility for extracting Jira issues from text
 */

/**
 * Extracts all Jira issue keys matching the pattern from a text string
 */
export function extractIssuesFromText(
  text: string,
  issuePattern: RegExp,
): Set<string> {
  const issues = new Set<string>();
  const matches = text.matchAll(issuePattern);

  for (const match of matches) {
    issues.add(match[0]);
  }

  return issues;
}

/**
 * Extracts all Jira issue keys from multiple text strings
 */
export function extractIssuesFromTexts(
  texts: string[],
  issuePattern: RegExp,
): Set<string> {
  const issues = new Set<string>();

  for (const text of texts) {
    for (const issue of extractIssuesFromText(text, issuePattern)) {
      issues.add(issue);
    }
  }

  return issues;
}
