import { describe, expect, it } from 'vitest';

import { configSchema, DEFAULT_CONFIG } from './schema.js';

describe('configSchema', () => {
  it('applies defaults when given an empty object', () => {
    const result = configSchema.parse({});
    expect(result).toEqual(DEFAULT_CONFIG);
    expect(result.version).toBe(1);
    expect(result.providers.ollama.baseUrl).toBe('http://localhost:11434');
    expect(result.permissions.mode).toBe('allowlist');
    expect(result.branching.strategy).toBe('conventional');
    expect(result.branching.prefix).toBe('maestro/');
    expect(result.discovery.enabled).toBe(true);
    expect(result.defaults.planner.model).toBe('anthropic/claude-sonnet-4-6');
    expect(result.defaults.generator.model).toBe('anthropic/claude-opus-4-7');
    expect(result.defaults['code-reviewer'].model).toBe(
      'anthropic/claude-sonnet-4-6',
    );
    expect(result.defaults['sensor-setup'].model).toBe(
      'anthropic/claude-sonnet-4-6',
    );
  });

  it('accepts a fully populated config', () => {
    const result = configSchema.parse({
      version: 1,
      providers: { anthropic: { apiKey: 'sk-test' } },
      permissions: {
        mode: 'strict',
        allowlist: ['pytest'],
        denylist: ['rm -rf /'],
      },
    });
    expect(result.providers.anthropic.apiKey).toBe('sk-test');
    expect(result.permissions.mode).toBe('strict');
    expect(result.permissions.allowlist).toEqual(['pytest']);
  });

  it('rejects unknown top-level keys', () => {
    expect(() =>
      configSchema.parse({ unknown: true } as unknown as Record<
        string,
        unknown
      >),
    ).toThrowError();
  });

  it('rejects unknown permission mode', () => {
    const result = configSchema.safeParse({ permissions: { mode: 'wild' } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.includes('mode')),
      ).toBe(true);
    }
  });

  it('rejects empty allowlist entries', () => {
    const result = configSchema.safeParse({
      permissions: { allowlist: [''] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-http ollama url', () => {
    const result = configSchema.safeParse({
      providers: { ollama: { baseUrl: 'not-a-url' } },
    });
    expect(result.success).toBe(false);
  });

  it('rejects version other than 1', () => {
    const result = configSchema.safeParse({ version: 2 });
    expect(result.success).toBe(false);
  });
});
