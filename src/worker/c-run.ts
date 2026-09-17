import { WASI, File, OpenFile, ConsoleStdout } from "@bjorn3/browser_wasi_shim";

export type RunOutcome = { stdout: string; stderr: string; exitCode: number };

export function runModule(module: WebAssembly.Module, stdin: string): RunOutcome {
  let stdout = "";
  let stderr = "";
  const fds = [
    new OpenFile(new File(new TextEncoder().encode(stdin))),
    new ConsoleStdout((data: Uint8Array) => (stdout += new TextDecoder().decode(data))),
    new ConsoleStdout((data: Uint8Array) => (stderr += new TextDecoder().decode(data))),
  ];
  const wasi = new WASI([], [], fds);
  const instance = new WebAssembly.Instance(module, { wasi_snapshot_preview1: wasi.wasiImport });
  const exitCode = wasi.start(instance as unknown as Parameters<typeof wasi.start>[0]);
  return { stdout, stderr, exitCode };
}
