import { useRef, useState } from "react";
import { readZipFile, readFileList, readDataTransfer } from "../upload";

type Props = { label: string; onLoad: (files: Record<string, string>) => void };

// Non-standard attribute, not in React's input typings — cast to bypass.
const folderInputProps = { webkitdirectory: "true", directory: "true" } as unknown as Record<string, string>;

/** Drag-and-drop (a zip, a folder, or loose files) or a split file/folder
 * button, decoding into a flat file map. */
export function FilesDropUpload({ label, onLoad }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  function fail(err: unknown) {
    setError(err instanceof Error ? err.message : String(err));
  }

  return (
    <div
      className={`dropzone ${dragOver ? "drag-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragOver(false);
        try {
          onLoad(await readDataTransfer(e.dataTransfer));
          setError(null);
        } catch (err) {
          fail(err);
        }
      }}
    >
      <div className="dropzone-label">{label}</div>
      <div className="dropzone-hint">Drag &amp; drop a .zip or a folder, or</div>
      <div className="split-button">
        <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()}>
          Choose file
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => folderInput.current?.click()}>
          Choose folder
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".zip"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            onLoad(await readZipFile(file));
            setError(null);
          } catch (err) {
            fail(err);
          }
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        {...folderInputProps}
        onChange={async (e) => {
          const fileList = e.target.files;
          e.target.value = "";
          if (!fileList || fileList.length === 0) return;
          try {
            onLoad(await readFileList(fileList));
            setError(null);
          } catch (err) {
            fail(err);
          }
        }}
      />
      {error && <div className="status-error">{error}</div>}
    </div>
  );
}
