import type { LanguageId } from "../languages/types";

export type ComparisonMode = "exact" | "whitespace" | "regex";

export type TestCase = {
  id: string;
  name: string;
  stdin: string;
  expectedOutput: string;
  points: number;
  visibility: "public" | "hidden";
  comparison: ComparisonMode;
  timeMs: number;
};

export type Manifest = {
  language: LanguageId;
  tests: TestCase[];
  /** Permitted #includes (C) or top-level imports (Python), enforced
   * before compilation. Undefined/omitted means unrestricted — a package
   * only gets this restriction if the instructor set one. */
  allowedConstructs?: string[];
};

export type GradingPackage = {
  manifest: Manifest;
  /** Package-supplied files (headers, test drivers, etc.) — a separate
   * namespace from student files, so a submission can't clobber the harness. */
  files: Record<string, string>;
};

export type TestOutcome = {
  id: string;
  name: string;
  visibility: "public" | "hidden";
  points: number;
  pointsEarned: number;
  status: "pass" | "fail" | "timeout" | "error";
  stdout: string;
  stderr: string;
  timeMs: number;
};

export type GradeResult = {
  status: "graded" | "compile_error" | "timeout" | "error";
  compileOutput: string;
  outcomes: TestOutcome[];
  pointsEarned: number;
  pointsPossible: number;
};
