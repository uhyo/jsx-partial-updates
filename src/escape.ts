/**
 * HTML escaping helpers.
 *
 * We escape text content and attribute values separately because the set of
 * characters that need escaping differs slightly, but a shared conservative
 * routine is fine and avoids surprises.
 */

const ESCAPE_RE = /["'&<>]/g;

const ESCAPE_LOOKUP: Record<string, string> = {
  '"': "&quot;",
  "'": "&#39;",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

export function escapeHtml(value: string): string {
  // Fast path: most strings contain nothing that needs escaping.
  ESCAPE_RE.lastIndex = 0;
  if (!ESCAPE_RE.test(value)) return value;
  return value.replace(ESCAPE_RE, (char) => ESCAPE_LOOKUP[char]!);
}
