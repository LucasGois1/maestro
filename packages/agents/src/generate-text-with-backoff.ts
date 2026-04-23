import { generateText } from 'ai';

/** Outer attempts after disabling AI SDK's default `maxRetries` (quick replays without delay). */
const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_BASE_MS = 1_500;
const DEFAULT_MAX_DELAY_MS = 120_000;

function collectErrorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  let depth = 0;
  while (current !== undefined && depth < 6) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    } else if (typeof current === 'object' && current !== null) {
      const o = current as Record<string, unknown>;
      if (typeof o.message === 'string') {
        parts.push(o.message);
      }
      current = o.cause;
    } else {
      parts.push(String(current));
      break;
    }
    depth += 1;
  }
  return parts.join(' ');
}

function statusCodeFromError(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const o = error as Record<string, unknown>;
  if (typeof o.statusCode === 'number') {
    return o.statusCode;
  }
  if (typeof o.status === 'number') {
    return o.status;
  }
  if (o.response && typeof o.response === 'object' && o.response !== null) {
    const r = o.response as Record<string, unknown>;
    if (typeof r.status === 'number') {
      return r.status;
    }
  }
  if (o.cause !== undefined && o.cause !== error) {
    return statusCodeFromError(o.cause);
  }
  return undefined;
}

/**
 * True when the error is likely transient throttling (safe to retry after delay).
 */
export function isRateLimitLikeError(error: unknown): boolean {
  const code = statusCodeFromError(error);
  if (code === 429 || code === 503) {
    return true;
  }
  const text = collectErrorText(error).toLowerCase();
  return (
    text.includes('rate limit') ||
    text.includes('tokens per min') ||
    text.includes('token per min') ||
    text.includes(' tpm ') ||
    text.includes('too many requests') ||
    text.includes('resource exhausted') ||
    text.includes('over capacity') ||
    (text.includes('capacity') && text.includes('try again'))
  );
}

/**
 * Parses delays like OpenAI's "Please try again in 3.021s".
 */
export function parseTryAgainSecondsFromMessage(message: string): number | null {
  const m = /\btry again in\s+([\d.]+)\s*s\b/i.exec(message);
  if (m?.[1] === undefined) {
    return null;
  }
  const s = Number.parseFloat(m[1]);
  if (!Number.isFinite(s) || s < 0) {
    return null;
  }
  return s;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelayMs(options: {
  readonly attempt: number;
  readonly baseMs: number;
  readonly maxDelayMs: number;
  readonly errorText: string;
}): number {
  const suggestedSec = parseTryAgainSecondsFromMessage(options.errorText);
  const suggestedMs =
    suggestedSec !== null ? Math.ceil(suggestedSec * 1000) + 250 : 0;
  const exponential = Math.min(
    options.maxDelayMs,
    options.baseMs * 2 ** (options.attempt - 1),
  );
  const raw = Math.max(suggestedMs, exponential);
  const jitter = Math.floor(Math.random() * 400);
  return Math.min(options.maxDelayMs, raw + jitter);
}

export type GenerateTextWithBackoffOptions = {
  readonly maxAttempts?: number;
  readonly baseMs?: number;
  readonly maxDelayMs?: number;
};

/**
 * Calls `generateText` with `maxRetries: 0` and retries only on rate-limit-like errors,
 * using exponential backoff and optional "try again in Xs" hints from the error message.
 */
export async function generateTextWithRateLimitBackoff(
  args: Parameters<typeof generateText>[0],
  backoff?: GenerateTextWithBackoffOptions,
): Promise<Awaited<ReturnType<typeof generateText>>> {
  const maxAttempts = backoff?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseMs = backoff?.baseMs ?? DEFAULT_BASE_MS;
  const maxDelayMs = backoff?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const merged = { ...args, maxRetries: 0 as const };

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await generateText(merged);
    } catch (error) {
      lastError = error;
      if (!isRateLimitLikeError(error) || attempt === maxAttempts) {
        throw error;
      }
      const delayMs = computeDelayMs({
        attempt,
        baseMs,
        maxDelayMs,
        errorText: collectErrorText(error),
      });
      await sleep(delayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
