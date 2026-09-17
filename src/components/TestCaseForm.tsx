import { useState } from "react";
import { useForm } from "react-hook-form";
import type { ComparisonMode, TestCase } from "../grading/types";

type FormValues = {
  name: string;
  stdin: string;
  expectedOutput: string;
  comparison: ComparisonMode;
  visibility: "public" | "hidden";
  points: number;
  timeMs: number;
};

const DEFAULTS: FormValues = {
  name: "",
  stdin: "",
  expectedOutput: "",
  comparison: "exact",
  visibility: "public",
  points: 1,
  timeMs: 3000,
};

type Props = {
  onAdd: (test: TestCase) => void;
  /** Runs the reference implementation with the given stdin — wired up so
   * "expected output" can be filled from its actual output instead of
   * typed by hand (that's the whole point of having a reference impl). */
  onRunReference?: (stdin: string) => Promise<{ stdout: string; stderr: string }>;
};

export function TestCaseForm({ onAdd, onRunReference }: Props) {
  const { register, handleSubmit, reset, setValue, getValues } = useForm<FormValues>({ defaultValues: DEFAULTS });
  const [filling, setFilling] = useState(false);
  const [fillError, setFillError] = useState<string | null>(null);

  async function fillFromReference() {
    if (!onRunReference) return;
    setFilling(true);
    setFillError(null);
    try {
      const { stdout, stderr } = await onRunReference(getValues("stdin"));
      setValue("expectedOutput", stdout);
      if (stderr) setFillError(stderr);
    } catch (err) {
      setFillError(err instanceof Error ? err.message : String(err));
    } finally {
      setFilling(false);
    }
  }

  function submit(values: FormValues) {
    onAdd({
      id: crypto.randomUUID(),
      name: values.name,
      stdin: values.stdin,
      expectedOutput: values.expectedOutput,
      comparison: values.comparison,
      visibility: values.visibility,
      points: Number(values.points),
      timeMs: Number(values.timeMs),
    });
    reset(DEFAULTS);
    setFillError(null);
  }

  return (
    <form className="test-form" onSubmit={handleSubmit(submit)}>
      <input placeholder="test name" {...register("name", { required: true })} />
      <textarea placeholder="stdin" rows={2} {...register("stdin")} />
      <div className="expected-output-field">
        <textarea placeholder="expected output" rows={2} {...register("expectedOutput", { required: true })} />
        {onRunReference && (
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={fillFromReference}
            disabled={filling}
          >
            {filling ? "Running…" : "Fill from reference ▶"}
          </button>
        )}
      </div>
      <label>
        comparison:{" "}
        <select {...register("comparison")}>
          <option value="exact">exact</option>
          <option value="whitespace">whitespace</option>
          <option value="regex">regex</option>
        </select>
      </label>
      <label>
        visibility:{" "}
        <select {...register("visibility")}>
          <option value="public">public</option>
          <option value="hidden">hidden</option>
        </select>
      </label>
      <label>
        points: <input type="number" min={0} {...register("points", { valueAsNumber: true })} />
      </label>
      <label>
        time limit (ms): <input type="number" min={100} step={100} {...register("timeMs", { valueAsNumber: true })} />
      </label>
      <button type="submit" className="btn btn-primary">
        Add test
      </button>
      {fillError && <div className="status-error">{fillError}</div>}
    </form>
  );
}
