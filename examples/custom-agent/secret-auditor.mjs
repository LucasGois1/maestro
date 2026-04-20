import { z } from 'zod';

const inputSchema = z.object({
  diff: z.string(),
});

const outputSchema = z.object({
  verdict: z.enum(['approve', 'request-changes', 'comment']),
  findings: z.array(
    z.object({
      path: z.string(),
      line: z.number().int().nonnegative().optional(),
      message: z.string(),
      severity: z.enum(['info', 'warn', 'error']),
    }),
  ),
});

export default {
  id: 'secret-auditor',
  role: 'sensor',
  systemPrompt: [
    'You are a sensor that inspects a git diff for secret-like literals (API keys, JWTs, tokens).',
    'Reply with JSON {verdict, findings[]}.',
    'Verdict "request-changes" if any finding has severity "error".',
  ].join('\n'),
  inputSchema,
  outputSchema,
};
