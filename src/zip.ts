import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";

export function filesToZip(files: Record<string, string>): Uint8Array {
  const data: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(files)) {
    data[path] = strToU8(content);
  }
  return zipSync(data);
}

export function zipToFiles(bytes: Uint8Array): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(zipToRawFiles(bytes))) {
    files[path] = strFromU8(content);
  }
  return files;
}

/** Like zipToFiles, but keeps raw bytes — needed when an entry might itself
 * be a zip (a student's own multi-file submission nested inside a bulk
 * download), since decoding it as UTF-8 text first would corrupt it. */
export function zipToRawFiles(bytes: Uint8Array): Record<string, Uint8Array> {
  const unzipped = unzipSync(bytes);
  const files: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(unzipped)) {
    if (path.endsWith("/")) continue; // directory entry, no content of its own
    files[path] = content;
  }
  return files;
}
