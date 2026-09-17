import type { EntryPointResult } from "../grading/entry-point";
import type { AllowlistViolation } from "../grading/allowlist";

export type LanguageId = "c" | "python";

export type LanguageRunner = {
  id: LanguageId;
  displayName: string;
  monacoLanguageId: string;
  fileExtensions: string[];
  detectEntryPoint(files: Record<string, string>): EntryPointResult;
  /** Checks includes/imports against an optional allowlist set by whoever
   * authored the assignment. `allowed` undefined means unrestricted —
   * returns no violations. */
  checkAllowlist(files: Record<string, string>, allowed: string[] | undefined): AllowlistViolation[];
  /** Module URL for this language's grading Web Worker (compile + run). */
  workerUrl: () => Worker;
};
