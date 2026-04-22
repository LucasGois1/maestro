import { describe, expect, it } from 'vitest';

import { initPickerChoicesFor } from './init-picker-models.js';

describe('init-picker-models', () => {
  it('returns three choices per provider', () => {
    expect(initPickerChoicesFor('openai')).toHaveLength(3);
    expect(initPickerChoicesFor('openai')[1]?.ref).toBe('openai/gpt-5');
  });
});
