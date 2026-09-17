import { cRunner } from "./c";
import { pythonRunner } from "./python";
import type { LanguageId, LanguageRunner } from "./types";

export const LANGUAGE_RUNNERS: Record<LanguageId, LanguageRunner> = {
  c: cRunner,
  python: pythonRunner,
  // java: javaRunner,
  // Java isn't implemented. CheerpJ is the only practical option for
  // compiling and running arbitrary Java in-browser: its free Community
  // License loads the runtime from a CDN, and self-hosting it needs a
  // paid Commercial License. Both conflict with this app's self-hosted,
  // no-external-requests design.
};

export function getLanguageRunner(id: LanguageId): LanguageRunner {
  return LANGUAGE_RUNNERS[id];
}
