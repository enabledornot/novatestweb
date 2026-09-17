import type { ComparisonMode } from "./types";

/** Trims trailing whitespace per line and drops trailing blank lines. */
function normalizeWhitespace(text: string): string {
  const lines = text.split("\n").map((line) => line.replace(/[ \t\r]+$/, ""));
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

export function compareOutput(mode: ComparisonMode, actual: string, expected: string): boolean {
  switch (mode) {
    case "exact":
      return actual === expected;
    case "whitespace":
      return normalizeWhitespace(actual) === normalizeWhitespace(expected);
    case "regex":
      return new RegExp(expected).test(actual);
  }
}
