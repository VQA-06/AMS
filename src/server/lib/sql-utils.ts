/**
 * SQL Security & Helper Utilities
 * - Escapes wildcard characters for SQLite LIKE queries to prevent wildcard injection (CWE-89)
 */

export function escapeLikePattern(input: string): string {
  if (!input) return '';
  // In SQLite LIKE with ESCAPE '\', escape backslash first, then % and _
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
