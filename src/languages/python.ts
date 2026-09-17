import { detectPythonEntryPoint } from "../grading/entry-point";
import { checkPythonImports } from "../grading/allowlist";
import type { LanguageRunner } from "./types";

export const pythonRunner: LanguageRunner = {
  id: "python",
  displayName: "Python",
  monacoLanguageId: "python",
  fileExtensions: [".py"],
  detectEntryPoint: detectPythonEntryPoint,
  checkAllowlist: checkPythonImports,
  workerUrl: () => new Worker(new URL("../worker/python-runner.worker.ts", import.meta.url), { type: "module" }),
};
