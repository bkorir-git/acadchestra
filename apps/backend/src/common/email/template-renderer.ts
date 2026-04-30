/**
 * @file template-renderer.ts
 * @module common/email
 * @description Tiny mustache-style template renderer. We deliberately don't pull
 *   in handlebars to keep the dependency footprint small and avoid eval-style
 *   surprises. Supports:
 *     - {{ variable }}                 → simple substitution
 *     - {{ nested.path }}              → dotted access
 *     - {{ variable | upper }}         → built-in filter (upper, lower, title)
 *
 *   Unknown variables render as empty string (not "undefined") to avoid leaking
 *   placeholders into customer emails.
 */

const FILTERS: Record<string, (v: string) => string> = {
  upper: (v) => v.toUpperCase(),
  lower: (v) => v.toLowerCase(),
  title: (v) =>
    v.replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1).toLowerCase()),
  trim: (v) => v.trim(),
};

function resolvePath(obj: any, path: string): unknown {
  return path
    .split('.')
    .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export function renderTemplate(
  template: string,
  variables: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr) => {
    // expr = "user.firstName | upper"
    const [pathRaw, ...filters] = expr.split('|').map((s: string) => s.trim());
    let value = resolvePath(variables, pathRaw);
    if (value == null) return '';
    let str = String(value);
    for (const f of filters) {
      const fn = FILTERS[f];
      if (fn) str = fn(str);
    }
    return str;
  });
}
