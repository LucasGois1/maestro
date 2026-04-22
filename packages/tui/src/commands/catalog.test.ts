import { describe, expect, it } from 'vitest';

import {
  findCommandEntry,
  normalizeCommandInput,
  suggestCommands,
} from './catalog.js';

describe('TUI command catalog', () => {
  it('normalizes an optional maestro prefix', () => {
    expect(normalizeCommandInput('maestro run ship auth')).toBe(
      'run ship auth',
    );
    expect(normalizeCommandInput('run ship auth')).toBe('run ship auth');
  });

  it('suggests commands by prefix and simple fuzzy word matches', () => {
    expect(suggestCommands('ru')[0]?.entry.command).toBe('run');
    expect(suggestCommands('status')[0]?.entry.command).toBe('git status');
    expect(suggestCommands('g st')[0]?.entry.command).toBe('git status');
  });

  it('finds full commands and aliases with trailing arguments', () => {
    expect(findCommandEntry('runs ls')?.command).toBe('runs list');
    expect(findCommandEntry('maestro run ship auth')?.command).toBe('run');
  });
});
