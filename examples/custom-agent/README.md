# Custom agent example

Drop the file `secret-auditor.mjs` into a repo's `.maestro/agents/` directory. On the next `maestro` run, the registry will pick it up automatically.

This example defines a sensor agent that scans a diff for suspicious string literals (API keys, tokens) and reports findings in a structured JSON payload.

Since `.maestro/agents/*` is loaded dynamically, the file may be ESM JavaScript, TypeScript compiled ahead of time to JS, or native TS if your runtime supports it. This example ships plain `.mjs` so it works without a build step.

To replace the built-in `code-reviewer` agent, keep the same `id`; the last registration wins.
