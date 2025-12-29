/**
 * URL generation and encoding utilities
 */

/**
 * Generates a safe Jira issue URL with proper encoding
 * Prevents XSS in markdown by encoding special characters
 *
 * @param jiraServerUrl - Base Jira server URL
 * @param issueKey - Jira issue key (e.g., "PROJECT-123")
 * @returns Properly encoded URL
 *
 * @example
 * generateIssueUrl("https://jira.example.com", "PROJECT-123")
 * // => "https://jira.example.com/browse/PROJECT-123"
 *
 * @example
 * generateIssueUrl("https://jira.example.com", "PROJ-<script>")
 * // => "https://jira.example.com/browse/PROJ-%3Cscript%3E"
 */
export function generateIssueUrl(
  jiraServerUrl: string,
  issueKey: string,
): string {
  try {
    // Use URL constructor for proper validation and encoding
    const url = new URL(jiraServerUrl);

    // Build path with encoded issue key using our secure encoding
    url.pathname = `/browse/${encodeUrlComponent(issueKey)}`;

    return url.toString();
  } catch {
    // Fallback to string concatenation if URL parsing fails
    // This maintains backward compatibility with malformed URLs
    // Note: This is less safe but prevents breaking changes
    const cleanUrl = jiraServerUrl.endsWith("/")
      ? jiraServerUrl.slice(0, -1)
      : jiraServerUrl;

    return `${cleanUrl}/browse/${encodeUrlComponent(issueKey)}`;
  }
}

/**
 * Validates that a Jira server URL is using HTTPS
 * @param jiraServerUrl - URL to validate
 * @returns true if HTTPS, false otherwise
 */
export function isSecureUrl(jiraServerUrl: string): boolean {
  try {
    const url = new URL(jiraServerUrl);
    return url.protocol === "https:";
  } catch {
    // If URL parsing fails, check string prefix
    return jiraServerUrl.startsWith("https://");
  }
}

/**
 * Encodes a string for use in URLs with additional security encoding
 * Beyond standard encodeURIComponent, also encodes characters that could
 * be used for XSS attacks in markdown contexts: ', (, )
 *
 * @param value - String to encode
 * @returns Securely encoded string
 */
function encodeUrlComponent(value: string): string {
  return encodeURIComponent(value)
    .replaceAll("'", "%27") // Prevent CSS injection and JS event handlers
    .replaceAll("(", "%28") // Prevent markdown link injection
    .replaceAll(")", "%29"); // Prevent markdown link injection
}
