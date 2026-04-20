---
'@maestro/provider': minor
---

Add AI SDK v6 wrapper: `getModel(ref)` parses `provider/modelId` and returns a `LanguageModelV3` client for Anthropic, OpenAI, Google, or Ollama. Includes `createObservabilityMiddleware` for per-request events (start/finish/error, usage, latency) and re-exports `streamText`, `generateText`, `streamObject`, `generateObject`, `tool`, `ToolLoopAgent`, `wrapLanguageModel` from `ai`. OpenAI integration test gated behind `RUN_INTEGRATION=1` and CI `integration` label / workflow dispatch.
