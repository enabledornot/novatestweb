import { zipToFiles } from "./zip";

export async function readZipFile(file: File): Promise<Record<string, string>> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return zipToFiles(bytes);
}

/** For `<input webkitdirectory>` folder uploads — each File carries a relative path. */
export async function readFileList(fileList: FileList): Promise<Record<string, string>> {
  const entries = await Promise.all(
    Array.from(fileList).map(async (file) => {
      const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      return [relPath, await file.text()] as const;
    }),
  );
  return Object.fromEntries(entries);
}

function readEntryFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readDirEntriesBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function collectEntry(entry: FileSystemEntry, prefix: string, out: Record<string, string>): Promise<void> {
  if (entry.isFile) {
    const file = await readEntryFile(entry as FileSystemFileEntry);
    out[prefix + entry.name] = await file.text();
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries() may not return everything in one call — keep reading
    // until it reports empty, per the File and Directory Entries API.
    let batch: FileSystemEntry[];
    do {
      batch = await readDirEntriesBatch(reader);
      for (const child of batch) await collectEntry(child, `${prefix}${entry.name}/`, out);
    } while (batch.length > 0);
  }
}

/**
 * Reads a drag-and-drop payload into a file map — handles a single dropped
 * zip (unzipped), a dropped folder (recursively, via the File System Entries
 * API), or a flat set of dropped files.
 */
export async function readDataTransfer(dataTransfer: DataTransfer): Promise<Record<string, string>> {
  const items = Array.from(dataTransfer.items ?? []);
  const entries = items
    .map((item) => item.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => e != null);

  if (entries.length > 0) {
    if (entries.length === 1 && entries[0].isFile && entries[0].name.toLowerCase().endsWith(".zip")) {
      const file = await readEntryFile(entries[0] as FileSystemFileEntry);
      return readZipFile(file);
    }
    const out: Record<string, string> = {};
    for (const entry of entries) await collectEntry(entry, "", out);
    return out;
  }

  // Fallback for browsers without the entries API: a flat FileList.
  const files = Array.from(dataTransfer.files);
  if (files.length === 1 && files[0].name.toLowerCase().endsWith(".zip")) {
    return readZipFile(files[0]);
  }
  return readFileList(dataTransfer.files);
}

/** Same idea, but for uploads that want raw zip bytes (e.g. a GradingPackage
 * zip, parsed by its own format) rather than a decoded file map. */
export async function readDataTransferZipBytes(dataTransfer: DataTransfer): Promise<Uint8Array> {
  const items = Array.from(dataTransfer.items ?? []);
  const entry = items.map((item) => item.webkitGetAsEntry?.()).find((e): e is FileSystemEntry => e?.isFile ?? false);
  const file = entry ? await readEntryFile(entry as FileSystemFileEntry) : dataTransfer.files[0];
  if (!file) throw new Error("no file was dropped");
  return new Uint8Array(await file.arrayBuffer());
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
