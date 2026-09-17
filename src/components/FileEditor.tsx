import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type { editor as MonacoEditorNs } from "monaco-editor";
import { FileTree } from "./FileTree";
import { findScrollableAncestor } from "../scroll-chain";
import { filesToZip } from "../zip";
import { downloadBytes } from "../upload";

type Props = {
  files: Record<string, string>;
  onChange?: (files: Record<string, string>) => void;
  languageId: string;
  editable: boolean;
  /** Template for a newly created file's name, e.g. "untitled.c" — a number
   * gets inserted before the extension if that name's already taken.
   * Only meaningful (and required) when editable. */
  newFileTemplate?: string;
  height?: number;
  /** Filename for the "Download as .zip" button. */
  zipFileName?: string;
};

function uniqueName(base: string, files: Record<string, string>): string {
  if (!(base in files)) return base;
  const dot = base.lastIndexOf(".");
  const stem = dot === -1 ? base : base.slice(0, dot);
  const ext = dot === -1 ? "" : base.slice(dot);
  let i = 2;
  while (`${stem}${i}${ext}` in files) i++;
  return `${stem}${i}${ext}`;
}

/**
 * The one file-tree + code editor/viewer used everywhere in the app —
 * authoring's package files and reference implementation, the single-test
 * view's package files and submission, and the bulk-evaluator per-student
 * detail. `editable` is the single switch between "viewer" (read-only,
 * no file-management controls) and "editor" (new/rename/delete file, and
 * an editable Monaco instance).
 */
export function FileEditor({
  files,
  onChange,
  languageId,
  editable,
  newFileTemplate,
  height = 480,
  zipFileName = "files.zip",
}: Props) {
  const [selected, setSelected] = useState(Object.keys(files)[0] ?? "");
  const [renameRequestId, setRenameRequestId] = useState<string | undefined>();
  const editorRef = useRef<MonacoEditorNs.IStandaloneCodeEditor | null>(null);
  const sourcePaneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!(selected in files)) setSelected(Object.keys(files)[0] ?? "");
  }, [files, selected]);

  // Monaco calls stopPropagation() on its own wheel handler, so a normal
  // bubble-phase React onWheel on an ancestor never receives the event. A
  // capture-phase native listener runs on the way down to the target,
  // before Monaco's handler gets a chance to stop it, so it's the point
  // that can actually intercept scrolling. When Monaco's own scroll hits
  // its top or bottom edge (matching the wheel direction), the remaining
  // delta is forwarded to the page — otherwise scrolling would feel stuck
  // the moment the cursor is over the editor.
  useEffect(() => {
    const container = sourcePaneRef.current;
    if (!container) return;

    function onWheelCapture(e: WheelEvent) {
      const ed = editorRef.current;
      if (!ed) return;
      const scrollTop = ed.getScrollTop();
      const scrollHeight = ed.getScrollHeight();
      const viewHeight = ed.getLayoutInfo().height;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + viewHeight >= scrollHeight - 1;
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
        const scrollParent = findScrollableAncestor(container);
        if (scrollParent) {
          e.preventDefault();
          scrollParent.scrollBy({ top: e.deltaY });
        }
      }
    }

    container.addEventListener("wheel", onWheelCapture, { capture: true, passive: false });
    return () => container.removeEventListener("wheel", onWheelCapture, true);
  }, []);

  function addFile() {
    if (!onChange) return;
    const name = uniqueName(newFileTemplate || "untitled", files);
    onChange({ ...files, [name]: "" });
    setSelected(name);
    setRenameRequestId(name); // editable immediately — no dialog box
  }

  function renameFile(oldName: string, newName: string) {
    if (!onChange || newName in files) return;
    const next: Record<string, string> = {};
    for (const [name, content] of Object.entries(files)) {
      next[name === oldName ? newName : name] = content;
    }
    onChange(next);
    setSelected(newName);
  }

  function deleteFile(name: string) {
    if (!onChange) return;
    const next = { ...files };
    delete next[name];
    onChange(next);
  }

  function downloadZip() {
    downloadBytes(filesToZip(files), zipFileName);
  }

  return (
    <div className="editor-layout">
      <div className="file-pane">
        <FileTree
          files={files}
          selected={selected}
          onSelect={setSelected}
          onRename={editable ? renameFile : undefined}
          onDelete={editable ? deleteFile : undefined}
          renameRequestId={renameRequestId}
          onRenameRequestHandled={() => setRenameRequestId(undefined)}
          height={editable ? height - 44 : height}
        />
        {editable && (
          <button type="button" className="btn btn-secondary create-file-btn" onClick={addFile}>
            <span aria-hidden="true">+</span> Create file
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary download-zip-btn"
          onClick={downloadZip}
          disabled={Object.keys(files).length === 0}
        >
          <span aria-hidden="true">⭳</span> Download as .zip
        </button>
      </div>
      <div className="source-pane" ref={sourcePaneRef}>
        <Editor
          height={`${height}px`}
          language={languageId}
          path={selected}
          value={files[selected] ?? ""}
          theme="vs-dark"
          options={{
            readOnly: !editable,
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
          }}
          onMount={(instance) => {
            editorRef.current = instance;
          }}
          onChange={(value) => editable && onChange && selected && onChange({ ...files, [selected]: value ?? "" })}
        />
      </div>
    </div>
  );
}
