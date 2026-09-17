export type FileTreeNode = { id: string; name: string; children?: FileTreeNode[] };

/**
 * Turns a flat {path: content} map into the nested folder/file structure
 * react-arborist expects, splitting each path on "/" into a chain of
 * folder nodes ending in a file node.
 */
export function buildFileTree(files: Record<string, string>): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const dirs = new Map<string, FileTreeNode[]>([["", root]]);

  const ensureDir = (path: string): FileTreeNode[] => {
    const existing = dirs.get(path);
    if (existing) return existing;
    const parentPath = path.split("/").slice(0, -1).join("/");
    const name = path.split("/").pop()!;
    const parentChildren = ensureDir(parentPath);
    const node: FileTreeNode = { id: path, name, children: [] };
    parentChildren.push(node);
    dirs.set(path, node.children!);
    return node.children!;
  };

  for (const filePath of Object.keys(files).sort()) {
    const parts = filePath.split("/");
    const dirPath = parts.slice(0, -1).join("/");
    const fileName = parts[parts.length - 1];
    ensureDir(dirPath).push({ id: filePath, name: fileName });
  }

  return root;
}
