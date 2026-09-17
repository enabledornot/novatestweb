import { useRef, useState } from "react";
import { readDataTransferZipBytes } from "../upload";

type Props = { label: string; onLoad: (bytes: Uint8Array) => void };

/** Drag-and-drop (or click-to-browse) upload of a single zip, as raw bytes —
 * for uploads that parse their own zip format (a GradingPackage, a bulk
 * submissions export), not a generic file map. */
export function ZipDropUpload({ label, onLoad }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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
          onLoad(await readDataTransferZipBytes(e.dataTransfer));
          setError(null);
        } catch (err) {
          fail(err);
        }
      }}
    >
      <div className="dropzone-label">{label}</div>
      <div className="dropzone-hint">Drag &amp; drop a .zip, or</div>
      <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()}>
        Choose file
      </button>
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
            onLoad(new Uint8Array(await file.arrayBuffer()));
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
