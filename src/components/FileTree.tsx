import { useEffect, useState } from "react";
import { Tree, type NodeRendererProps } from "react-arborist";
import { buildFileTree, type FileTreeNode } from "../file-tree";

type Props = {
  files: Record<string, string>;
  selected: string;
  onSelect: (path: string) => void;
  onRename?: (oldPath: string, newPath: string) => void;
  onDelete?: (path: string) => void;
  /** Set (to a path) to immediately enter rename mode for that path — used
   * for "create + rename inline" instead of a window.prompt() dialog. */
  renameRequestId?: string;
  onRenameRequestHandled?: () => void;
  height?: number;
};

export function FileTree({
  files,
  selected,
  onSelect,
  onRename,
  onDelete,
  renameRequestId,
  onRenameRequestHandled,
  height = 420,
}: Props) {
  const data = buildFileTree(files);
  const [renaming, setRenaming] = useState<string | null>(null);

  useEffect(() => {
    if (renameRequestId) {
      setRenaming(renameRequestId);
      onRenameRequestHandled?.();
    }
  }, [renameRequestId, onRenameRequestHandled]);

  function commitRename(node: FileTreeNode, rawName: string) {
    setRenaming(null);
    if (!onRename) return;
    const name = rawName.trim();
    if (!name || name === node.name) return;
    const parentPath = node.id.split("/").slice(0, -1).join("/");
    const newPath = parentPath ? `${parentPath}/${name}` : name;
    if (newPath === node.id || newPath in files) return;
    onRename(node.id, newPath);
  }

  const renderNode = ({ node, style }: NodeRendererProps<FileTreeNode>) => {
    const isRenaming = renaming === node.id;
    return (
      <div style={style} className={`tree-row ${node.isSelected ? "selected" : ""}`}>
        {isRenaming ? (
          <input
            className="tree-rename-input"
            autoFocus
            defaultValue={node.data.name}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => commitRename(node.data, e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenaming(null);
            }}
          />
        ) : (
          <>
            <span
              className="tree-row-label"
              onClick={() => (node.isLeaf ? onSelect(node.id) : node.toggle())}
            >
              {node.isLeaf ? "📄" : node.isOpen ? "📂" : "📁"} {node.data.name}
            </span>
            {node.isLeaf && onRename && (
              <button
                type="button"
                className="tree-row-icon-btn"
                title="Rename"
                aria-label={`Rename ${node.data.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setRenaming(node.id);
                }}
              >
                ✎
              </button>
            )}
            {node.isLeaf && onDelete && (
              <button
                type="button"
                className="tree-row-icon-btn tree-row-icon-btn-danger"
                title="Delete"
                aria-label={`Delete ${node.data.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(node.id);
                }}
              >
                🗑
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <Tree data={data} openByDefault selection={selected} width="100%" height={height} rowHeight={26}>
      {renderNode}
    </Tree>
  );
}
