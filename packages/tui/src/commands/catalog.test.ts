import { describe, expect, it } from 'vitest';

import {
  commandEntryNeedsTrailingArgs,
  entriesForSlashRoot,
  findCommandEntry,
  normalizeCommandInput,
  prepareTuiCommandInput,
  subcommandPickMenuForPrepared,
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

  it('maps /run list style input to runs list, not run with prompt "list"', () => {
    expect(prepareTuiCommandInput('run list')).toBe('runs list');
    expect(prepareTuiCommandInput('run ls')).toBe('runs list');
    expect(findCommandEntry('run list')?.command).toBe('runs list');
    expect(findCommandEntry('run show abc')?.command).toBe('runs show');
    expect(findCommandEntry('run clean --force')?.command).toBe('runs clean');
  });

  it('still treats run with a real prompt as run', () => {
    expect(prepareTuiCommandInput('run ship auth')).toBe('run ship auth');
    expect(findCommandEntry('run ship auth')?.command).toBe('run');
    expect(prepareTuiCommandInput('run list my feature')).toBe('run list my feature');
    expect(findCommandEntry('run list my feature')?.command).toBe('run');
  });

  it('groups catalog entries by slash root for subcommand menus', () => {
    expect(entriesForSlashRoot('runs').map((e) => e.command)).toEqual([
      'runs list',
      'runs show',
      'runs clean',
    ]);
    expect(entriesForSlashRoot('run').map((e) => e.command)).toEqual(['run']);
    expect(subcommandPickMenuForPrepared('runs')?.entries.length).toBe(3);
    expect(subcommandPickMenuForPrepared('run')).toBeNull();
    expect(subcommandPickMenuForPrepared('runs list')).toBeNull();
  });

  it('detects when a catalog entry still needs arguments on the command line', () => {
    expect(
      commandEntryNeedsTrailingArgs({
        command: 'runs show',
        description: '',
        usage: 'runs show <runId>',
        handlerId: 'runs',
      }),
    ).toBe(true);
    expect(
      commandEntryNeedsTrailingArgs({
        command: 'runs list',
        description: '',
        usage: 'runs list',
        handlerId: 'runs',
      }),
    ).toBe(false);
  });
});
