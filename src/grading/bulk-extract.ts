import { zipToRawFiles, zipToFiles } from "../zip";

export type ExtractedSubmission = { label: string; files: Record<string, string> };

/**
 * Extracts one submission per student from a bulk-download zip (e.g. a
 * Brightspace/D2L "download all submissions" export):
 *   - a top-level subfolder becomes one student's multi-file submission
 *   - a top-level file becomes one single-file submission, unless it's
 *     itself a .zip, in which case unzipping it produces that student's
 *     multi-file submission (a student who uploaded their own zip)
 * Each submission's label is the original filename or folder name,
 * verbatim — it already carries whatever identifying information the
 * institution's export format puts there, enough for an instructor to
 * recognize whose submission is whose.
 *
 * ⚠️ Student names or IDs are never parsed out of the filename itself:
 * Brightspace's exact naming convention is admin-configurable per
 * institution and hasn't been checked against a real export here, and a
 * wrong guess would risk silently misattributing one student's work to
 * another.
 */
export function extractBulkSubmissions(bulkZipBytes: Uint8Array): ExtractedSubmission[] {
  const rawEntries = zipToRawFiles(bulkZipBytes);
  const groups = new Map<string, Record<string, Uint8Array>>();

  for (const [path, bytes] of Object.entries(rawEntries)) {
    const slashIndex = path.indexOf("/");
    if (slashIndex === -1) {
      // Flat entry: its own submission (single file, or a nested zip).
      groups.set(path, { [path]: bytes });
    } else {
      // Nested entry: group by top-level folder name.
      const group = path.slice(0, slashIndex);
      const rel = path.slice(slashIndex + 1);
      if (!groups.has(group)) groups.set(group, {});
      groups.get(group)![rel] = bytes;
    }
  }

  return Array.from(groups.entries()).map(([label, rawFiles]) => {
    const files: Record<string, string> = {};
    const entries = Object.entries(rawFiles);
    if (entries.length === 1 && entries[0][0].toLowerCase().endsWith(".zip")) {
      Object.assign(files, zipToFiles(entries[0][1]));
    } else {
      for (const [relPath, bytes] of entries) {
        files[relPath] = new TextDecoder().decode(bytes);
      }
    }
    return { label, files };
  });
}
