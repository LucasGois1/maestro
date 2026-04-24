---
'@maestro/agents': patch
---

Fix merger structured output schema: avoid Zod `.url()` so OpenAI `response_format` no longer rejects `format: "uri"` on `prUrl`; validate URLs with `URL.canParse` after parse.
