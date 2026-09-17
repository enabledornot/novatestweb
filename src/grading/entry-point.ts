export type EntryPointResult =
  | { status: "ok"; file: string }
  | { status: "not_found" }
  | { status: "multiple"; files: string[] };

// A regex, not a parser: matches `main(` anywhere in the source text,
// including inside a comment or string. A false match only produces an
// overly-cautious "multiple entry points" error, never a silent wrong
// answer.
const C_MAIN_PATTERN = /\b(?:int|void)\s+main\s*\(/;

/**
 * Confirms exactly one file across the combined (package + submission)
 * file set defines `main`. Doubles as validation: a submission with no
 * main, or one whose main collides with a package-supplied file, gets a
 * clear rejection here instead of a confusing linker error later.
 */
export function detectCEntryPoint(files: Record<string, string>): EntryPointResult {
  const matches = Object.entries(files)
    .filter(([name]) => name.endsWith(".c"))
    .filter(([, content]) => C_MAIN_PATTERN.test(content))
    .map(([name]) => name);

  if (matches.length === 0) return { status: "not_found" };
  if (matches.length > 1) return { status: "multiple", files: matches };
  return { status: "ok", file: matches[0] };
}

// Prefers the file with a conventional `if __name__ == "__main__":`
// guard as the entry point; with no guard anywhere and exactly one .py
// file, that file is the entry by elimination; anything else is
// ambiguous.
const PY_MAIN_GUARD = /if\s+__name__\s*==\s*['"]__main__['"]\s*:/;

export function detectPythonEntryPoint(files: Record<string, string>): EntryPointResult {
  const pyFiles = Object.entries(files).filter(([name]) => name.endsWith(".py"));
  if (pyFiles.length === 0) return { status: "not_found" };

  const withGuard = pyFiles.filter(([, content]) => PY_MAIN_GUARD.test(content)).map(([name]) => name);
  if (withGuard.length === 1) return { status: "ok", file: withGuard[0] };
  if (withGuard.length > 1) return { status: "multiple", files: withGuard };

  if (pyFiles.length === 1) return { status: "ok", file: pyFiles[0][0] };
  return { status: "multiple", files: pyFiles.map(([name]) => name) };
}
