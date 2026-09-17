import type { GradingPackage, TestCase } from "./types";
import type { LanguageId } from "../languages/types";

/**
 * Sample assignment: "given an integer on stdin, print yes/no for whether
 * it's prime." The student submits the whole program — reads stdin, writes
 * stdout — and the package supplies no code at all, just the manifest.
 * Grading is purely: feed stdin, capture stdout, compare text. No unit
 * tests, no inspecting function return values or program internals.
 */
const PRIME_TESTS: TestCase[] = [
  { id: "two", name: "2 is prime", stdin: "2\n", expectedOutput: "yes\n", points: 1, visibility: "public", comparison: "exact", timeMs: 3000 },
  { id: "one", name: "1 is not prime", stdin: "1\n", expectedOutput: "no\n", points: 1, visibility: "public", comparison: "exact", timeMs: 3000 },
  { id: "zero", name: "0 is not prime", stdin: "0\n", expectedOutput: "no", points: 1, visibility: "public", comparison: "whitespace", timeMs: 3000 },
  { id: "negative", name: "negative numbers are not prime", stdin: "-7\n", expectedOutput: "no\n", points: 1, visibility: "hidden", comparison: "exact", timeMs: 3000 },
  { id: "large-prime", name: "97 is prime", stdin: "97\n", expectedOutput: "yes\n", points: 2, visibility: "hidden", comparison: "exact", timeMs: 3000 },
  { id: "large-composite", name: "100 is not prime", stdin: "100\n", expectedOutput: "^no\\s*$", points: 1, visibility: "hidden", comparison: "regex", timeMs: 3000 },
];

const C_CORRECT = `#include <stdio.h>

int is_prime(int n) {
  if (n < 2) return 0;
  for (int i = 2; i * i <= n; i++) {
    if (n % i == 0) return 0;
  }
  return 1;
}

int main() {
  int n;
  if (scanf("%d", &n) != 1) return 1;
  printf(is_prime(n) ? "yes\\n" : "no\\n");
  return 0;
}
`;

// Classic beginner bug: forgets that 0, 1, and negative numbers aren't
// prime, so it only guards against non-positive divisors incorrectly.
const C_BUGGY = `#include <stdio.h>

int is_prime(int n) {
  if (n < 2) return 1; // BUG: should be "return 0"
  for (int i = 2; i * i <= n; i++) {
    if (n % i == 0) return 0;
  }
  return 1;
}

int main() {
  int n;
  if (scanf("%d", &n) != 1) return 1;
  printf(is_prime(n) ? "yes\\n" : "no\\n");
  return 0;
}
`;

const PYTHON_CORRECT = `import sys


def is_prime(n):
    if n < 2:
        return False
    i = 2
    while i * i <= n:
        if n % i == 0:
            return False
        i += 1
    return True


if __name__ == "__main__":
    n = int(sys.stdin.readline())
    print("yes" if is_prime(n) else "no")
`;

// Classic beginner bug: forgets that 0, 1, and negative numbers aren't
// prime, so it only guards against non-positive divisors incorrectly.
const PYTHON_BUGGY = `import sys


def is_prime(n):
    if n < 2:
        return True  # BUG: should be "return False"
    i = 2
    while i * i <= n:
        if n % i == 0:
            return False
        i += 1
    return True


if __name__ == "__main__":
    n = int(sys.stdin.readline())
    print("yes" if is_prime(n) else "no")
`;

// No package-supplied code for either language: the student's submission
// is the whole program. (The engine still supports package files for
// assignments that need shared library code — see run-grading.ts — this
// sample just doesn't use any.)
export const SAMPLE_PACKAGES: Record<LanguageId, GradingPackage> = {
  c: { manifest: { language: "c", tests: PRIME_TESTS }, files: {} },
  python: { manifest: { language: "python", tests: PRIME_TESTS }, files: {} },
};

export const SAMPLE_SOLUTIONS: Record<LanguageId, { correct: string; buggy: string; fileName: string }> = {
  c: { correct: C_CORRECT, buggy: C_BUGGY, fileName: "main.c" },
  python: { correct: PYTHON_CORRECT, buggy: PYTHON_BUGGY, fileName: "main.py" },
};
