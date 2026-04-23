import { describe, expect, it } from 'vitest';

import {
  isRateLimitLikeError,
  parseTryAgainSecondsFromMessage,
} from './generate-text-with-backoff.js';

describe('parseTryAgainSecondsFromMessage', () => {
  it('parses OpenAI-style hints', () => {
    expect(
      parseTryAgainSecondsFromMessage(
        'Please try again in 3.021s. Visit https://example.com',
      ),
    ).toBeCloseTo(3.021, 3);
  });

  it('returns null when absent', () => {
    expect(parseTryAgainSecondsFromMessage('Something else')).toBeNull();
  });
});

describe('isRateLimitLikeError', () => {
  it('detects HTTP 429', () => {
    expect(isRateLimitLikeError({ statusCode: 429, message: 'nope' })).toBe(
      true,
    );
  });

  it('detects HTTP 503', () => {
    expect(isRateLimitLikeError({ statusCode: 503, message: 'unavailable' })).toBe(
      true,
    );
  });

  it('detects TPM wording', () => {
    expect(
      isRateLimitLikeError(
        new Error('Rate limit reached on tokens per min (TPM): Limit 500000'),
      ),
    ).toBe(true);
  });

  it('does not treat 401 as rate limit', () => {
    expect(isRateLimitLikeError({ statusCode: 401, message: 'Unauthorized' })).toBe(
      false,
    );
  });
});
