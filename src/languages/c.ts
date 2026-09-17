import { detectCEntryPoint } from "../grading/entry-point";
import { checkCIncludes } from "../grading/allowlist";
import type { LanguageRunner } from "./types";

export const cRunner: LanguageRunner = {
  id: "c",
  displayName: "C",
  monacoLanguageId: "c",
  fileExtensions: [".c", ".h"],
  detectEntryPoint: detectCEntryPoint,
  checkAllowlist: checkCIncludes,
  workerUrl: () => new Worker(new URL("../worker/c-runner.worker.ts", import.meta.url), { type: "module" }),
};
