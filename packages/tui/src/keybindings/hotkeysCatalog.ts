/** Static help text for Help overlay and Footer alignment (DSFT-89). */

export interface HotkeySection {
  readonly title: string;
  readonly lines: readonly {
    readonly keys: string;
    readonly description: string;
  }[];
}

export const GLOBAL_HOTKEYS: HotkeySection = {
  title: 'Global',
  lines: [
    { keys: '[tab] / [shift+tab]', description: 'Next / previous panel' },
    { keys: '?', description: 'Help (in command line) or Shift+? here' },
    { keys: '[k]', description: 'KB explorer (.maestro files)' },
    { keys: '[e]', description: 'Edit sprint contract (when CLI wired)' },
    {
      keys: '[1-9]',
      description: 'Select sprint (when Sprints panel focused)',
    },
  ],
};

export const PANEL_HOTKEYS: HotkeySection = {
  title: 'When panel focused',
  lines: [
    { keys: '[l]', description: 'Full agent log (Active agent)' },
    { keys: '[s]', description: 'Sensor detail (Sensors)' },
    {
      keys: '[↑↓] / [j][k]',
      description: 'Move sensor row selection (Sensors)',
    },
    { keys: '[d]', description: 'Cycle diff file (Diff)' },
    { keys: '[p]', description: 'Diff preview mode (Diff)' },
    { keys: '[r]', description: 'Feedback history (Diff)' },
  ],
};

export const OVERLAY_HOTKEYS: HotkeySection = {
  title: 'When overlay open',
  lines: [
    { keys: '[esc] / [q]', description: 'Close overlay' },
    { keys: '[↑↓]', description: 'Scroll (where supported)' },
  ],
};

export const PIPELINE_FOOTER_HINTS: Readonly<
  Record<
    'idle' | 'running' | 'paused',
    readonly { key: string; label: string }[]
  >
> = {
  idle: [],
  running: [],
  paused: [],
};
