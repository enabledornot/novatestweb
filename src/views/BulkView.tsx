import { useState } from "react";
import { ZipDropUpload } from "../components/ZipDropUpload";
import { FileEditor } from "../components/FileEditor";
import { extractBulkSubmissions, type ExtractedSubmission } from "../grading/bulk-extract";
import { runBulk, type BulkResult } from "../grading/bulk-run";
import { getLanguageRunner } from "../languages/registry";
import { zipToPackage } from "../grading/package-zip";
import type { GradingPackage } from "../grading/types";

export function BulkView() {
  const [pkg, setPkg] = useState<GradingPackage | null>(null);
  const [submissions, setSubmissions] = useState<ExtractedSubmission[] | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<BulkResult[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onPackageUpload(bytes: Uint8Array) {
    try {
      setPkg(zipToPackage(bytes));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function onBulkZipUpload(bytes: Uint8Array) {
    try {
      setSubmissions(extractBulkSubmissions(bytes));
      setResults(null);
      setSelected(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runAll() {
    if (!pkg || !submissions) return;
    setRunning(true);
    setResults(null);
    setProgress({ done: 0, total: submissions.length });
    const bulkResults = await runBulk(pkg, submissions, (done, total) => setProgress({ done, total }));
    setResults(bulkResults);
    setRunning(false);
  }

  const canRun = !!pkg && !!submissions && submissions.length > 0 && !running;
  const detail = selected !== null ? results?.[selected] : null;
  const runner = pkg ? getLanguageRunner(pkg.manifest.language) : null;

  return (
    <div>
      <p className="desc">
        Grade a whole class's submissions in one pass: upload the full instructor package, upload a bulk
        submissions zip, then run every submission against every test. This is the instructor-only, one-shot
        batch flow — not linked from the landing page since students never need it.
      </p>
      <p className="desc status-error">
        ⚠️ Brightspace's exact bulk-download layout is admin-configurable per institution and hasn't been
        checked against a real export here — this treats each top-level file or folder in the zip as one
        student's submission, without trying to parse names/IDs out of D2L's filename convention. Check the
        extracted list below actually looks like one entry per student before trusting the run.
      </p>

      <section>
        <h2>Package &amp; submissions</h2>
        <div className="upload-row">
          <ZipDropUpload label="Assignment package (full, instructor)" onLoad={onPackageUpload} />
          <ZipDropUpload label="Bulk submissions" onLoad={onBulkZipUpload} />
        </div>
        <div className="controls">
          <button className="btn btn-primary" onClick={runAll} disabled={!canRun}>
            {running ? `Running… (${progress.done}/${progress.total})` : "Run all"}
          </button>
        </div>
        {error && <p className="status-error">{error}</p>}
        {!pkg && (
          <p className="desc">Upload an assignment package first (the full instructor version, not the student-stripped one).</p>
        )}
        {submissions && (
          <p className="desc">
            Extracted {submissions.length} submission{submissions.length === 1 ? "" : "s"}:{" "}
            {submissions.map((s) => s.label).join(", ")}
          </p>
        )}
      </section>

      <section>
        <h2>Report</h2>
        {!results && <p className="desc">(no run yet)</p>}
        {results && (
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Score</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>
                    {r.result.pointsEarned} / {r.result.pointsPossible}
                  </td>
                  <td>
                    <span className={r.result.status === "graded" ? "status-pass" : "status-error"}>
                      {r.result.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-small" onClick={() => setSelected(i)}>
                      view
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {detail && runner && (
        <section>
          <h2>Detail: {detail.label}</h2>
          <FileEditor
            key={detail.label}
            files={detail.files}
            languageId={runner.monacoLanguageId}
            editable={false}
            height={420}
          />
          {detail.result.compileOutput && <pre>{detail.result.compileOutput}</pre>}
          <table>
            <thead>
              <tr>
                <th>Test</th>
                <th>Visibility</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {detail.result.outcomes.map((o) => (
                <tr key={o.id}>
                  <td>{o.name}</td>
                  <td>
                    <span className={`badge ${o.visibility}`}>{o.visibility}</span>
                  </td>
                  <td>
                    <span className={`status-${o.status}`}>{o.status}</span>
                    <pre>
                      stdout: {o.stdout}
                      {"\n"}stderr: {o.stderr}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
