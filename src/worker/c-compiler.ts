import { Clang, LLD, setUpSysroot, type FileList } from "browsercc";

/** Creates a file's parent directory before writing it. Emscripten's
 * FS.writeFile requires the directory to already exist, and any
 * folder-uploaded submission has at least one level of nesting — the
 * browser prefixes every path with the picked folder's own name. */
function writeFileWithDirs(fs: { mkdirTree: (path: string) => void; writeFile: (path: string, data: string) => void }, path: string, content: string) {
  const dir = path.split("/").slice(0, -1).join("/");
  if (dir) fs.mkdirTree(dir);
  fs.writeFile(path, content);
}

// Precompiled toolchain assets are large (~95MB uncompressed); fetch once and
// share across every compile in this worker's lifetime.
let sysrootPromise: Promise<ArrayBuffer> | null = null;
function loadSysroot(): Promise<ArrayBuffer> {
  if (!sysrootPromise) {
    sysrootPromise = fetch(new URL("browsercc/dist/sysroot.tar", import.meta.url)).then((r) =>
      r.arrayBuffer(),
    );
  }
  return sysrootPromise;
}

type Invocation = { compilerArgs: string[]; compilerArtifact: string };

/**
 * Runs `clang -### <flags> <file> -o <artifact>` on a throwaway instance to
 * recover the exact -cc1 sub-invocation, without actually compiling.
 * thisProgram is "clang" (not browsercc's default "clang++") so `.c` files
 * are treated as C, not C++ — clang++ ignores the extension and always
 * compiles as C++ otherwise.
 */
async function getInvocation(fileName: string, source: string, flags: string[]): Promise<Invocation> {
  let stderr = "";
  const clang = await Clang({ thisProgram: "clang", printErr: (d: string) => (stderr += d + "\n") });
  writeFileWithDirs(clang.FS, fileName, source);
  clang.FS.mkdirTree("/lib/wasm32-wasi");
  clang.FS.writeFile("/lib/wasm32-wasi/crt1-command.o", new Uint8Array(0));
  const ret = clang.callMain([fileName, ...flags, "-###"]);
  if (ret !== 0) throw new Error(`clang driver failed to plan compilation:\n${stderr}`);

  const lines = stderr.split("\n");
  const getArgs = (key: string) => {
    const line = lines.find((l) => l.includes(key)) ?? "";
    const args = (line.match(/"([^"]*)"/g) ?? []).map((s) => s.slice(1, -1)).slice(1);
    const oIndex = args.findIndex((a) => a === "-o");
    return { args, outputFileName: args[oIndex + 1] };
  };
  const cc1 = getArgs("-cc1");
  return { compilerArgs: cc1.args, compilerArtifact: cc1.outputFileName };
}

export type CompileResult = { compileOutput: string; module: WebAssembly.Module | null };

/**
 * Compiles one or more C translation units and links them into a single
 * WASI command-model module. Each `.c` file in `sourceFiles` is compiled as
 * its own translation unit; everything else in `files` (headers, etc.) is
 * made available to every compilation step but not compiled itself.
 */
export async function compileC(files: Record<string, string>, flags: string[] = []): Promise<CompileResult> {
  const sourceNames = Object.keys(files).filter((name) => name.endsWith(".c"));
  if (sourceNames.length === 0) {
    return { compileOutput: "no .c source files provided", module: null };
  }
  const extraFiles: FileList = Object.fromEntries(
    Object.entries(files).filter(([name]) => !name.endsWith(".c")),
  );

  const sysroot = await loadSysroot();
  let stderr = "";
  const objects: Uint8Array[] = [];

  for (const name of sourceNames) {
    const source = files[name];
    const inv = await getInvocation(name, source, flags);
    // Each translation unit compiles in its own fresh Clang instance:
    // reusing one instance across multiple callMain() calls corrupts
    // Clang's internal static/global state and crashes with a wasm
    // memory-access trap on the second compile.
    const clang = await Clang({ thisProgram: "clang", printErr: (d: string) => (stderr += d + "\n") });
    writeFileWithDirs(clang.FS, name, source);
    setUpSysroot(clang, sysroot, extraFiles);
    const exitCode = clang.callMain(inv.compilerArgs);
    if (exitCode !== 0) return { compileOutput: stderr, module: null };
    objects.push(clang.FS.readFile(inv.compilerArtifact, { encoding: "binary" }) as Uint8Array);
  }

  const lld = await LLD({ thisProgram: "wasm-ld", printErr: (d: string) => (stderr += d + "\n") });
  setUpSysroot(lld, sysroot, extraFiles);
  const objectPaths = objects.map((_, i) => `/tmp/obj${i}.o`);
  objects.forEach((buf, i) => lld.FS.writeFile(objectPaths[i], buf));

  const linkArgs = [
    "-m",
    "wasm32",
    "-L/lib/wasm32-wasi",
    "/lib/wasm32-wasi/crt1-command.o",
    ...objectPaths,
    "-lc",
    // Path is tied to the Clang version bundled by the pinned browsercc
    // release (20.x) — verify this if browsercc is ever upgraded.
    "lib/clang/20/lib/wasm32-unknown-wasi/libclang_rt.builtins.a",
    "-o",
    "a.out",
  ];
  const exitCode = lld.callMain(linkArgs);
  if (exitCode !== 0) return { compileOutput: stderr, module: null };

  const output = lld.FS.readFile("a.out", { encoding: "binary" }) as Uint8Array;
  return { compileOutput: stderr, module: await WebAssembly.compile(output) };
}
