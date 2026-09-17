import type { GradingPackage } from "./types";

/**
 * Strips hidden tests from a package, producing the zip that ships to
 * students, while the instructor keeps working from one master copy with
 * every test flagged public or hidden. Hidden tests stay confidential
 * only because they're absent from this output, not through any runtime
 * protection — a client-side tool can't hide bytes from the browser
 * running it.
 */
export function exportStudentPackage(pkg: GradingPackage): GradingPackage {
  return {
    manifest: {
      ...pkg.manifest,
      tests: pkg.manifest.tests.filter((t) => t.visibility === "public"),
    },
    files: pkg.files,
  };
}
