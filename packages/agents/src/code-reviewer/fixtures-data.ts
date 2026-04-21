import type { CodeReviewInput } from './code-review-input.schema.js';
import type { CodeReviewOutput } from '@maestro/sensors';

const baseInput: CodeReviewInput = {
  diff: '',
  sprintContract: '',
  goldenPrinciples: [],
  agentsMd: '',
};

/** SQL injection no diff — error de segurança. */
export const FIXTURE_SQL_INJECTION: {
  readonly input: CodeReviewInput;
  readonly output: CodeReviewOutput;
} = {
  input: {
    ...baseInput,
    diff: `diff --git a/api.py b/api.py
--- a/api.py
+++ b/api.py
@@ -1,3 +1,3 @@
 def get_user(uid):
-    return db.query("SELECT * FROM users WHERE id = ?", uid)
+    return db.execute("SELECT * FROM users WHERE id = " + str(uid))`,
    sprintContract: 'Queries must use parameterization.',
  },
  output: {
    violations: [
      {
        severity: 'error',
        category: 'security',
        file: 'api.py',
        line: 2,
        message: 'SQL built via string concatenation enables injection.',
        suggestion: 'Use parameterized query: db.execute("SELECT ... WHERE id = ?", (uid,)).',
      },
    ],
    summary: 'Critical: SQL concatenation introduced.',
    pass: false,
  },
};

/** Função muito longa — smell. */
export const FIXTURE_LONG_FUNCTION: {
  readonly input: CodeReviewInput;
  readonly output: CodeReviewOutput;
} = {
  input: {
    ...baseInput,
    diff: 'diff --git a/huge.ts b/huge.ts\n+export function x() { /* 200 lines */ }\n',
  },
  output: {
    violations: [
      {
        severity: 'warning',
        category: 'smell',
        file: 'huge.ts',
        line: 1,
        message: 'Function body is ~200 lines; hard to test and review.',
        suggestion: 'Split into smaller helpers (e.g. parseInput, validate, persist).',
      },
    ],
    summary: 'One maintainability warning on structure.',
    pass: true,
  },
};

/** Naming inconsistente — style/convention. */
export const FIXTURE_NAMING: {
  readonly input: CodeReviewInput;
  readonly output: CodeReviewOutput;
} = {
  input: {
    ...baseInput,
    diff: 'diff --git a/UserSvc.ts b/UserSvc.ts\n+const getUsrData = () => {}\n',
    agentsMd: 'Use PascalCase for services, camelCase for functions.',
  },
  output: {
    violations: [
      {
        severity: 'warning',
        category: 'convention',
        file: 'UserSvc.ts',
        line: 1,
        message: 'Abbreviation getUsrData is inconsistent with repo camelCase clarity (getUserData).',
        suggestion: 'Rename to getUserData for consistency with AGENTS.md naming guidance.',
      },
    ],
    summary: 'Naming inconsistency flagged.',
    pass: true,
  },
};

/** Testes fracos — testing. */
export const FIXTURE_WEAK_TESTS: {
  readonly input: CodeReviewInput;
  readonly output: CodeReviewOutput;
} = {
  input: {
    ...baseInput,
    diff: 'diff --git a/pay.test.ts b/pay.test.ts\n+it("works", () => { expect(true).toBe(true); });\n',
    sprintContract: 'Payment path must be covered by assertions.',
  },
  output: {
    violations: [
      {
        severity: 'warning',
        category: 'testing',
        file: 'pay.test.ts',
        line: 1,
        message: 'Assertion is tautological; does not validate payment behavior.',
        suggestion: 'Add cases for success, failure, and edge amounts with concrete expectations.',
      },
    ],
    summary: 'Test file needs substantive assertions.',
    pass: true,
  },
};

/** Diff impecável. */
export const FIXTURE_CLEAN: {
  readonly input: CodeReviewInput;
  readonly output: CodeReviewOutput;
} = {
  input: {
    ...baseInput,
    diff: 'diff --git a/small.ts b/small.ts\n+export const add = (a: number, b: number) => a + b;\n',
  },
  output: {
    violations: [],
    summary: 'Small, clear change; nothing substantive to report.',
    pass: true,
  },
};

/** Bug sutil que o gerador disse estar “impecável”. */
export const FIXTURE_SUBTLE_BUG: {
  readonly input: CodeReviewInput;
  readonly output: CodeReviewOutput;
} = {
  input: {
    ...baseInput,
    diff: `diff --git a/calc.ts b/calc.ts
--- a/calc.ts
+++ b/calc.ts
@@ -1 +1 @@
-export const avg = (a: number[]) => a.reduce((x,y)=>x+y,0)/a.length`,
  },
  output: {
    violations: [
      {
        severity: 'error',
        category: 'smell',
        file: 'calc.ts',
        line: 1,
        message: 'Empty array yields NaN (0/0); no guard.',
        suggestion: 'Return undefined or throw if a.length === 0.',
      },
    ],
    summary: 'Edge case on empty input not handled.',
    pass: false,
  },
};

/** try/except ou try/catch engole erros. */
export const FIXTURE_SWALLOWED_ERRORS: {
  readonly input: CodeReviewInput;
  readonly output: CodeReviewOutput;
} = {
  input: {
    ...baseInput,
    diff: [
      'diff --git a/job.py b/job.py',
      '--- a/job.py',
      '+++ b/job.py',
      '@@ -1,5 +1,8 @@',
      ' def run():',
      '     try:',
      '         do_work()',
      '-    except Exception:',
      '-        pass',
      '+    except Exception:',
      '+        logger.info("ok")',
    ].join('\n'),
  },
  output: {
    violations: [
      {
        severity: 'warning',
        category: 'smell',
        file: 'job.py',
        line: 4,
        message: 'Broad except still hides failures; logging "ok" masks errors.',
        suggestion: 'Log exception with exc_info=True, re-raise or narrow except clause.',
      },
    ],
    summary: 'Error handling obscures real failures.',
    pass: true,
  },
};
