/**
 * HTML entity encoding utilities to prevent DOM XSS in dynamically generated markup
 * (e.g. print popups, badge rendering, and template strings).
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const HTML_ESCAPE_REGEX = /[&<>"']/g;

/**
 * Escapes characters with special meaning in HTML (&, <, >, ", ').
 * Returns an empty string for null or undefined.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] || char);
}
