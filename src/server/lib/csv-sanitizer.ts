/**
 * CSV Formula Injection Sanitizer (CWE-1236 Defense)
 * Prevents formula injection (DDE attacks) when CSV files are opened in
 * Microsoft Excel, Google Sheets, or LibreOffice Calc.
 */

const DANGEROUS_START_CHARS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitizes a single CSV cell value.
 * If the string begins with a formula trigger character, it is safely escaped with a leading single quote (').
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const rawStr = String(value);
  if (rawStr.length === 0) {
    return '';
  }

  // Check dangerous trigger char on raw string (including leading tabs/CR)
  if (DANGEROUS_START_CHARS.includes(rawStr[0])) {
    return `'${rawStr}`;
  }

  const str = rawStr.trim();
  if (str.length > 0 && DANGEROUS_START_CHARS.includes(str[0])) {
    return `'${str}`;
  }

  return str;
}

/**
 * Sanitizes all values in a record for CSV generation.
 */
export function sanitizeCsvRow<T extends Record<string, unknown>>(row: T): Record<keyof T, string> {
  const cleanRow = {} as Record<keyof T, string>;
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      cleanRow[key] = sanitizeCsvCell(row[key]);
    }
  }
  return cleanRow;
}
