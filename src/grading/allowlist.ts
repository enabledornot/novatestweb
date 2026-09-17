export type AllowlistViolation = { file: string; construct: string };

// A source-text regex, not a real parser: a false positive here (e.g. a
// header name mentioned in a comment) only makes the check overly strict,
// never silently permissive.
const C_INCLUDE_PATTERN = /#include\s*[<"]([^>"]+)[>"]/g;

export function checkCIncludes(files: Record<string, string>, allowed: string[] | undefined): AllowlistViolation[] {
  if (!allowed) return [];
  const allowedSet = new Set(allowed);
  const violations: AllowlistViolation[] = [];
  for (const [name, content] of Object.entries(files)) {
    if (!name.endsWith(".c") && !name.endsWith(".h")) continue;
    for (const match of content.matchAll(C_INCLUDE_PATTERN)) {
      const header = match[1];
      if (!allowedSet.has(header)) violations.push({ file: name, construct: `#include <${header}>` });
    }
  }
  return violations;
}

const PY_IMPORT_PATTERN = /^\s*(?:import\s+([\w.]+)|from\s+([\w.]+)\s+import)/gm;

export function checkPythonImports(files: Record<string, string>, allowed: string[] | undefined): AllowlistViolation[] {
  if (!allowed) return [];
  const allowedSet = new Set(allowed);
  const violations: AllowlistViolation[] = [];
  for (const [name, content] of Object.entries(files)) {
    if (!name.endsWith(".py")) continue;
    for (const match of content.matchAll(PY_IMPORT_PATTERN)) {
      const module = (match[1] ?? match[2]).split(".")[0];
      if (!allowedSet.has(module)) violations.push({ file: name, construct: `import ${module}` });
    }
  }
  return violations;
}
