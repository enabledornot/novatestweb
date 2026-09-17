import type { GradingPackage } from "./types";

/**
 * Sample assignment: "given an integer on stdin, print yes/no for whether
 * it's prime." The student submits the whole program — reads stdin, writes
 * stdout — and the package supplies no code at all, just the manifest.
 * Grading is purely: feed stdin, capture stdout, compare text. No unit
 * tests, no inspecting function return values or program internals.
 */
export const primePackage: GradingPackage = {
  manifest: {
    language: "c",
    tests: [
      {
        id: "two",
        name: "2 is prime",
        stdin: "2\n",
        expectedOutput: "yes\n",
        points: 1,
        visibility: "public",
        comparison: "exact",
        timeMs: 3000,
      },
      {
        id: "one",
        name: "1 is not prime",
        stdin: "1\n",
        expectedOutput: "no\n",
        points: 1,
        visibility: "public",
        comparison: "exact",
        timeMs: 3000,
      },
      {
        id: "zero",
        name: "0 is not prime",
        stdin: "0\n",
        expectedOutput: "no",
        points: 1,
        visibility: "public",
        comparison: "whitespace",
        timeMs: 3000,
      },
      {
        id: "negative",
        name: "negative numbers are not prime",
        stdin: "-7\n",
        expectedOutput: "no\n",
        points: 1,
        visibility: "hidden",
        comparison: "exact",
        timeMs: 3000,
      },
      {
        id: "large-prime",
        name: "97 is prime",
        stdin: "97\n",
        expectedOutput: "yes\n",
        points: 2,
        visibility: "hidden",
        comparison: "exact",
        timeMs: 3000,
      },
      {
        id: "large-composite",
        name: "100 is not prime",
        stdin: "100\n",
        expectedOutput: "^no\\s*$",
        points: 1,
        visibility: "hidden",
        comparison: "regex",
        timeMs: 3000,
      },
    ],
  },
  // No package-supplied code: the student's submission is the whole
  // program. (The engine still supports package files for assignments
  // that need shared library code — see run-grading.ts — this sample
  // just doesn't use any.)
  files: {},
};

export const correctSolution = `#include <stdio.h>

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
export const buggySolution = `#include <stdio.h>

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
