import { useMemo, useState } from "react";
import { SAMPLE_PACKAGES, SAMPLE_SOLUTIONS } from "../grading/sample-package";
import { exportStudentPackage } from "../grading/export-student-package";
import { gradeSubmission } from "../grading/run-grading";
import { packageToZip, zipToPackage } from "../grading/package-zip";
import { getLanguageRunner, LANGUAGE_RUNNERS } from "../languages/registry";
import type { GradeResult } from "../grading/types";
import { FileEditor } from "../components/FileEditor";
import { ZipDropUpload } from "../components/ZipDropUpload";
import { FilesDropUpload } from "../components/FilesDropUpload";
import { downloadBytes } from "../upload";
import type { GradingPackage } from "../grading/types";
import type { LanguageId } from "../languages/types";

const DEFAULT_LANGUAGE: LanguageId = "c";
const DEFAULT_PACKAGE: GradingPackage = exportStudentPackage(SAMPLE_PACKAGES[DEFAULT_LANGUAGE]);
const DEFAULT_SUBMISSION: Record<string, string> = {
  [SAMPLE_SOLUTIONS[DEFAULT_LANGUAGE].fileName]: SAMPLE_SOLUTIONS[DEFAULT_LANGUAGE].correct,
};

export function SingleTestView() {
  const [pkg, setPkg] = useState<GradingPackage>(DEFAULT_PACKAGE);
  const [submissionFiles, setSubmissionFiles] = useState<Record<string, string>>(DEFAULT_SUBMISSION);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [sampleLanguage, setSampleLanguage] = useState<LanguageId>(DEFAULT_LANGUAGE);

  const runner = getLanguageRunner(pkg.manifest.language);
  const allFiles = { ...pkg.files, ...submissionFiles };

  const collision = Object.keys(submissionFiles).find((name) => name in pkg.files);
  const entryPoint = useMemo(() => runner.detectEntryPoint(allFiles), [runner, allFiles]);

  function loadSample(preset: "correct" | "buggy", visibility: "student" | "instructor") {
    const samplePackage = SAMPLE_PACKAGES[sampleLanguage];
    const solution = SAMPLE_SOLUTIONS[sampleLanguage];
    setPkg(visibility === "student" ? exportStudentPackage(samplePackage) : samplePackage);
    setSubmissionFiles({ [solution.fileName]: preset === "buggy" ? solution.buggy : solution.correct });
    setResult(null);
  }

  function onPackageUpload(bytes: Uint8Array) {
    setPkg(zipToPackage(bytes));
    setResult(null);
  }

  function onSubmissionUpload(files: Record<string, string>) {
    setSubmissionFiles(files);
    setResult(null);
  }

  async function run() {
    setRunning(true);
    setResult(null);
    const gradeResult = await gradeSubmission(pkg, submissionFiles);
    setResult(gradeResult);
    setRunning(false);
  }

  function downloadPackage() {
    downloadBytes(packageToZip(pkg), "assignment-package.zip");
  }

  const canRun = !collision && entryPoint.status === "ok";

  return (
    <div>
      <p className="desc">
        Runs arbitrary {runner.displayName} code entirely client-side (Web Worker, no server involved) and
        grades it purely by I/O: the manifest feeds each test's stdin to the program and compares its
        stdout against expected text.
      </p>

      <section>
        <h2>Assignment package &amp; submission</h2>
        <div className="upload-row">
          <ZipDropUpload label="Assignment package" onLoad={onPackageUpload} />
          <FilesDropUpload label="Submission" onLoad={onSubmissionUpload} />
        </div>
        <div className="controls">
          <button className="btn btn-secondary" onClick={downloadPackage}>
            Download current package as .zip
          </button>
        </div>
        <div className="controls">
          <span className="desc">Or try the bundled sample assignment in:</span>
          <select value={sampleLanguage} onChange={(e) => setSampleLanguage(e.target.value as LanguageId)}>
            {Object.values(LANGUAGE_RUNNERS).map((r) => (
              <option key={r.id} value={r.id}>
                {r.displayName}
              </option>
            ))}
          </select>
          <button className="btn btn-secondary btn-small" onClick={() => loadSample("correct", "student")}>
            Correct (student view)
          </button>
          <button className="btn btn-secondary btn-small" onClick={() => loadSample("buggy", "student")}>
            Buggy (student view)
          </button>
          <button className="btn btn-secondary btn-small" onClick={() => loadSample("correct", "instructor")}>
            Correct (instructor view)
          </button>
          <button className="btn btn-secondary btn-small" onClick={() => loadSample("buggy", "instructor")}>
            Buggy (instructor view)
          </button>
        </div>

        {collision && (
          <p className="status-error">Submission file "{collision}" collides with a package-supplied file.</p>
        )}
        {!collision && entryPoint.status === "not_found" && (
          <p className="status-error">
            No {runner.displayName} entry point found in the submission or package files.
          </p>
        )}
        {!collision && entryPoint.status === "multiple" && (
          <p className="status-error">
            Multiple files could serve as the entry point: {entryPoint.files.join(", ")} — a submission can
            only have one.
          </p>
        )}

        {Object.keys(pkg.files).length > 0 && (
          <>
            <h3>Package files (read-only)</h3>
            <FileEditor
              files={pkg.files}
              languageId={runner.monacoLanguageId}
              editable={false}
              height={240}
              zipFileName="package-files.zip"
            />
          </>
        )}

        <h3>Submission</h3>
        <FileEditor
          files={submissionFiles}
          onChange={setSubmissionFiles}
          languageId={runner.monacoLanguageId}
          editable
          newFileTemplate={`untitled${runner.fileExtensions[0]}`}
          zipFileName="submission.zip"
        />

        <p>
          <button className="btn btn-primary" onClick={run} disabled={running || !canRun}>
            {running ? "Running…" : "Run against manifest"}
          </button>
        </p>
      </section>

      <section>
        <h2>Results</h2>
        {result && (
          <>
            <p className="score">
              Score: {result.pointsEarned} / {result.pointsPossible}
              {result.status !== "graded" && (
                <>
                  {" "}
                  — <span className="status-error">{result.status}</span>
                </>
              )}
            </p>
            {result.compileOutput && <pre>{result.compileOutput}</pre>}
          </>
        )}
        <table>
          <thead>
            <tr>
              <th>Test</th>
              <th>Visibility</th>
              <th>Points</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {pkg.manifest.tests.map((t) => {
              const outcome = result?.outcomes.find((o) => o.id === t.id);
              return (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>
                    <span className={`badge ${t.visibility}`}>{t.visibility}</span>
                  </td>
                  <td>{t.points}</td>
                  <td>
                    {outcome ? (
                      <>
                        <span className={`status-${outcome.status}`}>{outcome.status}</span>
                        <pre>
                          stdout: {outcome.stdout}
                          {"\n"}stderr: {outcome.stderr}
                        </pre>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
