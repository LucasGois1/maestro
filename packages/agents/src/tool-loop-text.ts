/**
 * AI SDK `generateText`: `result.text` is only the **last** step's assistant text.
 * When the loop ends on tool calls, that field can be empty even if an earlier
 * step already emitted the JSON plan — we scan steps backwards for non-empty text.
 */
export type ToolLoopTextSource = {
  readonly text: string;
  readonly steps: ReadonlyArray<{ readonly text: string }>;
};

export function collectAssistantTextFromToolLoopResult(
  gen: ToolLoopTextSource,
): string {
  const lastStep = gen.text;
  if (typeof lastStep === 'string' && lastStep.trim().length > 0) {
    return lastStep;
  }
  for (let i = gen.steps.length - 1; i >= 0; i -= 1) {
    const stepText = gen.steps[i]?.text;
    if (typeof stepText === 'string' && stepText.trim().length > 0) {
      return stepText;
    }
  }
  return '';
}
