import { gradeSubmission } from "./run-grading";
import type { GradingPackage, GradeResult } from "./types";
import type { ExtractedSubmission } from "./bulk-extract";

export type BulkResult = { label: string; files: Record<string, string>; result: GradeResult };

/**
 * Runs every extracted submission against the package, one at a time.
 * Sequential rather than parallel: each C/Python submission already loads
 * a substantial WASM/Pyodide runtime per worker, so running a class-sized
 * batch concurrently risks heavy memory pressure. Revisit with a bounded
 * worker pool if this proves too slow in practice.
 */
export async function runBulk(
  pkg: GradingPackage,
  submissions: ExtractedSubmission[],
  onProgress: (done: number, total: number) => void,
): Promise<BulkResult[]> {
  const results: BulkResult[] = [];
  for (const sub of submissions) {
    const result: GradeResult = await gradeSubmission(pkg, sub.files);
    results.push({ label: sub.label, files: sub.files, result });
    onProgress(results.length, submissions.length);
  }
  return results;
}
