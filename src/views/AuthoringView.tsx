import { useState } from "react";
import { FileEditor } from "../components/FileEditor";
import { TestCaseForm } from "../components/TestCaseForm";
import { FilesDropUpload } from "../components/FilesDropUpload";
import { gradeSubmission } from "../grading/run-grading";
import { exportStudentPackage } from "../grading/export-student-package";
import { packageToZip } from "../grading/package-zip";
import { LANGUAGE_RUNNERS, getLanguageRunner } from "../languages/registry";
import { downloadBytes } from "../upload";
import type { GradeResult, GradingPackage, TestCase } from "../grading/types";
import type { LanguageId } from "../languages/types";

const STARTER_SOURCE: Record<LanguageId, Record<string, string>> = {
  c: { "main.c": "#include <stdio.h>\n\nint main() {\n  return 0;\n}\n" },
  python: { "main.py": "if __name__ == '__main__':\n    pass\n" },
};

export function AuthoringView() {
  const [language, setLanguage] = useState<LanguageId>("c");
  const [referenceFiles, setReferenceFiles] = useState<Record<string, string>>(STARTER_SOURCE.c);
  const [packageFiles, setPackageFiles] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<TestCase[]>([]);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [allowlistText, setAllowlistText] = useState("");

  const runner = getLanguageRunner(language);
  const allowedConstructs = allowlistText.trim()
    ? allowlistText.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const pkg: GradingPackage = { manifest: { language, tests, allowedConstructs }, files: packageFiles };
  const pointsPossible = tests.reduce((sum, t) => sum + t.points, 0);

  function changeLanguage(next: LanguageId) {
    setLanguage(next);
    setReferenceFiles(STARTER_SOURCE[next]);
    setPackageFiles({});
    setTests([]);
    setAllowlistText("");
    setResult(null);
  }

  function addTest(test: TestCase) {
    setTests((prev) => [...prev, test]);
    setResult(null);
  }

  function removeTest(id: string) {
    setTests((prev) => prev.filter((t) => t.id !== id));
    setResult(null);
  }

  /** Runs the reference implementation against a given stdin, so a new
   * test's expected output can be filled from its actual output instead
   * of typed by hand. */
  async function runReferenceForStdin(stdin: string): Promise<{ stdout: string; stderr: string }> {
    const probePkg: GradingPackage = {
      manifest: {
        language,
        tests: [
          {
            id: "__probe__",
            name: "probe",
            stdin,
            expectedOutput: "",
            points: 0,
            visibility: "public",
            comparison: "exact",
            timeMs: 5000,
          },
        ],
      },
      files: packageFiles,
    };
    const probeResult = await gradeSubmission(probePkg, referenceFiles);
    const outcome = probeResult.outcomes[0];
    return { stdout: outcome?.stdout ?? "", stderr: probeResult.compileOutput || outcome?.stderr || "" };
  }

  async function checkReference() {
    setChecking(true);
    setResult(null);
    const gradeResult = await gradeSubmission(pkg, referenceFiles);
    setResult(gradeResult);
    setChecking(false);
  }

  function downloadFull() {
    downloadBytes(packageToZip(pkg), "assignment-package-full.zip");
  }

  function downloadStudent() {
    downloadBytes(packageToZip(exportStudentPackage(pkg)), "assignment-package-student.zip");
  }

  return (
    <div>
      <p className="desc">
        Write a reference implementation first — its actual output can then fill in each test's expected
        output automatically, instead of typing it by hand. Export both the full package (every test) and
        the student package (hidden tests stripped) once the tests check out.
      </p>

      <section>
        <div className="controls">
          <label>
            Language:{" "}
            <select value={language} onChange={(e) => changeLanguage(e.target.value as LanguageId)}>
              {Object.values(LANGUAGE_RUNNERS).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Allowed {language === "c" ? "includes" : "imports"} (optional, comma-separated — blank = unrestricted):{" "}
            <input
              type="text"
              size={40}
              placeholder={language === "c" ? "stdio.h, stdlib.h" : "math, random"}
              value={allowlistText}
              onChange={(e) => setAllowlistText(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section>
        <h2>Reference implementation</h2>
        <FilesDropUpload label="Load reference implementation" onLoad={setReferenceFiles} />
        <FileEditor
          files={referenceFiles}
          onChange={setReferenceFiles}
          languageId={runner.monacoLanguageId}
          editable
          newFileTemplate={`untitled${runner.fileExtensions[0]}`}
        />
        <div className="controls">
          <button className="btn btn-secondary" onClick={checkReference} disabled={checking || tests.length === 0}>
            {checking ? "Checking…" : "Check reference against all tests"}
          </button>
        </div>

        {result && (
          <>
            <p className="score">
              Reference scored {result.pointsEarned} / {result.pointsPossible}
              {result.status !== "graded" && (
                <>
                  {" "}
                  — <span className="status-error">{result.status}</span>
                </>
              )}
              {result.status === "graded" && result.pointsEarned < result.pointsPossible && (
                <>
                  {" "}
                  —{" "}
                  <span className="status-error">
                    a passing reference solution should score full marks; check the tests below
                  </span>
                </>
              )}
            </p>
            {result.compileOutput && <pre>{result.compileOutput}</pre>}
            <table>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Expected</th>
                  <th>Actual stdout</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {result.outcomes.map((o) => {
                  const test = tests.find((t) => t.id === o.id);
                  return (
                    <tr key={o.id}>
                      <td>{o.name}</td>
                      <td>
                        <pre>{test?.expectedOutput}</pre>
                      </td>
                      <td>
                        <pre>{o.stdout}</pre>
                      </td>
                      <td>
                        <span className={`status-${o.status}`}>{o.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section>
        <h2>Package files (optional)</h2>
        <p className="desc">
          Files compiled and linked alongside every submission (shared headers, a fixed test driver, etc).
          Leave empty for assignments where the student's own file is the whole program.
        </p>
        <FileEditor
          files={packageFiles}
          onChange={setPackageFiles}
          languageId={runner.monacoLanguageId}
          editable
          newFileTemplate={`untitled${runner.fileExtensions[0]}`}
        />
      </section>

      <section>
        <h2>
          Tests ({tests.length}, {pointsPossible} point{pointsPossible === 1 ? "" : "s"} total)
        </h2>
        <TestCaseForm onAdd={addTest} onRunReference={runReferenceForStdin} />
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Stdin</th>
              <th>Expected</th>
              <th>Comparison</th>
              <th>Visibility</th>
              <th>Points</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  <pre>{t.stdin}</pre>
                </td>
                <td>
                  <pre>{t.expectedOutput}</pre>
                </td>
                <td>{t.comparison}</td>
                <td>
                  <span className={`badge ${t.visibility}`}>{t.visibility}</span>
                </td>
                <td>{t.points}</td>
                <td>
                  <button className="btn btn-danger btn-small" onClick={() => removeTest(t.id)}>
                    remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Export</h2>
        <p className="desc">
          Exporting produces two zips: the full package keeps every test for instructor grading, while the
          student package has hidden tests stripped out entirely — letting students run the public subset
          without ever holding the hidden tests to inspect.
        </p>
        <div className="controls">
          <button className="btn btn-primary" onClick={downloadFull} disabled={tests.length === 0}>
            Download full package (instructor)
          </button>
          <button className="btn btn-secondary" onClick={downloadStudent} disabled={tests.length === 0}>
            Download student package ({tests.filter((t) => t.visibility === "public").length} public test
            {tests.filter((t) => t.visibility === "public").length === 1 ? "" : "s"})
          </button>
        </div>
      </section>
    </div>
  );
}
