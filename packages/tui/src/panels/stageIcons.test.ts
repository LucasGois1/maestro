import { describe, expect, it } from 'vitest';

import { SPRINT_ICONS, STAGE_ICONS, stageLabel } from './stageIcons.js';

describe('stageIcons', () => {
  it('provides an icon for every stage status', () => {
    expect(STAGE_ICONS.pending.icon).toBe('○');
    expect(STAGE_ICONS.running.icon).toBe('⟳');
    expect(STAGE_ICONS.passed.icon).toBe('✓');
    expect(STAGE_ICONS.failed.icon).toBe('✗');
    expect(STAGE_ICONS.paused.icon).toBe('⏸');
    expect(STAGE_ICONS.escalated.icon).toBe('!');
  });

  it('provides an icon for every sprint status', () => {
    expect(SPRINT_ICONS.pending.icon).toBe('○');
    expect(SPRINT_ICONS.running.icon).toBe('⟳');
    expect(SPRINT_ICONS.done.icon).toBe('✓');
    expect(SPRINT_ICONS.failed.icon).toBe('✗');
    expect(SPRINT_ICONS.escalated.icon).toBe('!');
  });

  it('capitalizes stage labels', () => {
    expect(stageLabel('planning')).toBe('Planning');
    expect(stageLabel('discovering')).toBe('Discovering');
    expect(stageLabel('')).toBe('');
  });
});
