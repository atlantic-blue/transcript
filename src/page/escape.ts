const REPLACEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// Everything on the page comes from outside, so it is escaped before it reaches the document.
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => REPLACEMENTS[c] ?? c);
}
