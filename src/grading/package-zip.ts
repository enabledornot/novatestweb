import { filesToZip, zipToFiles } from "../zip";
import type { GradingPackage, Manifest } from "./types";

const PACKAGE_FILES_PREFIX = "files/";
const MANIFEST_ENTRY = "manifest.json";

/**
 * On-disk shape of an assignment package zip:
 *   manifest.json      — the Manifest, as JSON
 *   files/<name>        — package-supplied files, everything else in the zip
 * This is what instructors export (full or student-stripped, per
 * exportStudentPackage) and what both views upload/parse.
 */
export function packageToZip(pkg: GradingPackage): Uint8Array {
  const files: Record<string, string> = { [MANIFEST_ENTRY]: JSON.stringify(pkg.manifest, null, 2) };
  for (const [name, content] of Object.entries(pkg.files)) {
    files[PACKAGE_FILES_PREFIX + name] = content;
  }
  return filesToZip(files);
}

export function zipToPackage(bytes: Uint8Array): GradingPackage {
  const files = zipToFiles(bytes);
  const manifestRaw = files[MANIFEST_ENTRY];
  if (!manifestRaw) {
    throw new Error(`assignment zip is missing ${MANIFEST_ENTRY}`);
  }

  let manifest: Manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (err) {
    throw new Error(`${MANIFEST_ENTRY} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  const packageFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith(PACKAGE_FILES_PREFIX)) {
      packageFiles[path.slice(PACKAGE_FILES_PREFIX.length)] = content;
    }
  }
  return { manifest, files: packageFiles };
}
