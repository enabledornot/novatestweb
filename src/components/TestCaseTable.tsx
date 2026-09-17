import { useEffect, useRef, useState } from "react";
import type { ComparisonMode, TestCase } from "../grading/types";

type Props = {
  tests: TestCase[];
  onChange: (tests: TestCase[]) => void;
  /** Runs the reference implementation with a given stdin — wired up so a
   * test's expected output can be filled from its actual output instead of
   * typed by hand. */
  onRunReference?: (stdin: string) => Promise<{ stdout: string; stderr: string }>;
};

function blankTest(): TestCase {
  return {
    id: crypto.randomUUID(),
    name: "",
    stdin: "",
    expectedOutput: "",
    comparison: "exact",
    visibility: "public",
    points: 1,
    timeMs: 3000,
  };
}

const COLUMN_COUNT = 9;

export function TestCaseTable({ tests, onChange, onRunReference }: Props) {
  const [fillingId, setFillingId] = useState<string | null>(null);
  const [fillingAll, setFillingAll] = useState(false);
  const [fillError, setFillError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragOverIdRef = useRef<string | null>(null);
  dragOverIdRef.current = dragOverId;

  function updateField(id: string, patch: Partial<TestCase>) {
    onChange(tests.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeTest(id: string) {
    onChange(tests.filter((t) => t.id !== id));
  }

  function addTest() {
    onChange([...tests, blankTest()]);
  }

  function reorder(fromId: string, toId: string) {
    const fromIndex = tests.findIndex((t) => t.id === fromId);
    const toIndex = tests.findIndex((t) => t.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...tests];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  }

  // Plain mouse events, not the native HTML5 Drag and Drop API: this table
  // shares a page with FileEditor's file trees, which pull in react-dnd's
  // HTML5 backend for their own drag-and-drop. That backend installs global
  // native drag listeners, so a `draggable` row here fires alongside it and
  // throws ("Cannot call hover while not dragging") instead of reordering.
  useEffect(() => {
    if (!draggedId) return;
    const sourceId = draggedId;

    function onMouseMove(e: MouseEvent) {
      const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("tr[data-test-id]");
      setDragOverId(row?.dataset.testId ?? null);
    }

    function onMouseUp() {
      const targetId = dragOverIdRef.current;
      if (targetId && targetId !== sourceId) reorder(sourceId, targetId);
      setDraggedId(null);
      setDragOverId(null);
    }

    document.body.style.cursor = "grabbing";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [draggedId]);

  async function fillOne(id: string) {
    if (!onRunReference) return;
    const test = tests.find((t) => t.id === id);
    if (!test) return;
    setFillingId(id);
    setFillError(null);
    try {
      const { stdout, stderr } = await onRunReference(test.stdin);
      updateField(id, { expectedOutput: stdout });
      if (stderr) setFillError(`${test.name || "(untitled)"}: ${stderr}`);
    } catch (err) {
      setFillError(err instanceof Error ? err.message : String(err));
    } finally {
      setFillingId(null);
    }
  }

  async function fillAll() {
    if (!onRunReference || tests.length === 0) return;
    setFillingAll(true);
    setFillError(null);
    const errors: string[] = [];
    // Sequential, not parallel: each fill compiles and runs the reference
    // implementation from scratch in its own worker, so running every test
    // at once would spin up that many workers simultaneously. `next` builds
    // up locally rather than reading the `tests` prop each iteration, since
    // the prop won't reflect an onChange call's effect until the next render.
    let next = tests;
    for (const test of next) {
      try {
        const { stdout, stderr } = await onRunReference(test.stdin);
        next = next.map((t) => (t.id === test.id ? { ...t, expectedOutput: stdout } : t));
        onChange(next);
        if (stderr) errors.push(`${test.name || "(untitled)"}: ${stderr}`);
      } catch (err) {
        errors.push(`${test.name || "(untitled)"}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (errors.length > 0) setFillError(errors.join("\n"));
    setFillingAll(false);
  }

  return (
    <div>
      {onRunReference && (
        <div className="controls">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fillAll}
            disabled={fillingAll || tests.length === 0}
          >
            {fillingAll ? "Filling…" : "Fill all from reference ▶"}
          </button>
        </div>
      )}
      {fillError && <div className="status-error">{fillError}</div>}

      <table className="test-table">
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Stdin</th>
            <th>Expected</th>
            <th>Comparison</th>
            <th>Visibility</th>
            <th>Points</th>
            <th>Time (ms)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tests.map((t) => (
            <tr
              key={t.id}
              data-test-id={t.id}
              className={[
                draggedId === t.id ? "test-row-dragging" : "",
                dragOverId === t.id && draggedId !== t.id ? "test-row-drag-over" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <td
                className="test-drag-handle"
                title="Drag to reorder"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDraggedId(t.id);
                }}
              >
                ⠿
              </td>
              <td>
                <input
                  value={t.name}
                  placeholder="test name"
                  onChange={(e) => updateField(t.id, { name: e.target.value })}
                />
              </td>
              <td>
                <textarea
                  rows={2}
                  value={t.stdin}
                  onChange={(e) => updateField(t.id, { stdin: e.target.value })}
                />
              </td>
              <td>
                <div className="expected-output-field">
                  <textarea
                    rows={2}
                    value={t.expectedOutput}
                    onChange={(e) => updateField(t.id, { expectedOutput: e.target.value })}
                  />
                  {onRunReference && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => fillOne(t.id)}
                      disabled={fillingId === t.id || fillingAll}
                    >
                      {fillingId === t.id ? "…" : "Fill ▶"}
                    </button>
                  )}
                </div>
              </td>
              <td>
                <select
                  value={t.comparison}
                  onChange={(e) => updateField(t.id, { comparison: e.target.value as ComparisonMode })}
                >
                  <option value="exact">exact</option>
                  <option value="whitespace">whitespace</option>
                  <option value="regex">regex</option>
                </select>
              </td>
              <td>
                <select
                  value={t.visibility}
                  onChange={(e) =>
                    updateField(t.id, { visibility: e.target.value as "public" | "hidden" })
                  }
                >
                  <option value="public">public</option>
                  <option value="hidden">hidden</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  className="test-number-input"
                  value={t.points}
                  onChange={(e) => updateField(t.id, { points: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={100}
                  step={100}
                  className="test-number-input"
                  value={t.timeMs}
                  onChange={(e) => updateField(t.id, { timeMs: Number(e.target.value) })}
                />
              </td>
              <td>
                <button className="btn btn-danger btn-small" onClick={() => removeTest(t.id)}>
                  remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={COLUMN_COUNT}>
              <button type="button" className="btn btn-secondary create-file-btn" onClick={addTest}>
                <span aria-hidden="true">+</span> Add test
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
