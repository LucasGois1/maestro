import { describe, expect, it } from 'vitest';

import { discoveryOutputSchema } from './built-in.js';

describe('discoveryOutputSchema', () => {
  it('accepts plain markdown strings', () => {
    const out = discoveryOutputSchema.parse({
      agentsMd: '# AGENTS\n\nHello',
      architectureMd: '# ARCH\n\nWorld',
    });
    expect(out.agentsMd).toContain('AGENTS');
    expect(out.architectureMd).toContain('ARCH');
  });

  it('merges section-keyed objects into markdown strings', () => {
    const out = discoveryOutputSchema.parse({
      agentsMd: {
        Header: '# AGENTS.md\n\n## Repo Map\n- Root',
        'Repo Map': 'unexpected extra',
        Docs: '',
        'Essential Commands': '',
        'Critical Conventions': '',
        'Escalation Path': '',
      },
      architectureMd: {
        "Bird's Eye View": 'One paragraph.',
        'Code Map': 'Packages listed here.',
        'Cross-Cutting Concerns': '',
        'Module Boundaries': '',
        'Data Flow': '',
      },
    });
    expect(out.agentsMd).toContain('# AGENTS.md');
    expect(out.agentsMd).toContain('unexpected extra');
    expect(out.architectureMd).toContain('One paragraph.');
    expect(out.architectureMd).toContain('Packages listed here.');
    expect(out.architectureMd.indexOf('One paragraph.')).toBeLessThan(
      out.architectureMd.indexOf('Packages listed here.'),
    );
  });
});
