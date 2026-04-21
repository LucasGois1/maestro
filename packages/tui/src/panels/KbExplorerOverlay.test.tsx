import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { KeybindingProvider } from '../keybindings/index.js';

import { KbExplorerOverlay } from './KbExplorerOverlay.js';

describe('KbExplorerOverlay', () => {
  it('marks paths that appear in kbPathsRead', () => {
    const app = render(
      <KeybindingProvider focusedPanelId="pipeline" overlayOpen>
        <KbExplorerOverlay
          repoLabel="/repo"
          files={[
            { path: '.maestro/a.md', previewText: 'x' },
            { path: '.maestro/b.md', previewText: 'y' },
          ]}
          kbPathsRead={['.maestro/a.md']}
        />
      </KeybindingProvider>,
    );
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('.maestro/a.md');
    expect(frame).toContain('lido');
    expect(frame).toContain('preview');
    app.unmount();
  });

  it('shows empty state when there are no files', () => {
    const app = render(
      <KeybindingProvider focusedPanelId="pipeline" overlayOpen>
        <KbExplorerOverlay repoLabel="/x" files={[]} kbPathsRead={[]} />
      </KeybindingProvider>,
    );
    expect(app.lastFrame()).toContain('nenhum ficheiro');
    app.unmount();
  });
});
