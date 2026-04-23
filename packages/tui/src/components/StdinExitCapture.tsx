import { useInput } from 'ink';

import type { DoubleCtrlCExitHandlers } from '../hooks/useDoubleCtrlCExit.js';
import { useDoubleCtrlCExit } from '../hooks/useDoubleCtrlCExit.js';

export type StdinExitCaptureProps = {
  readonly active: boolean;
  readonly doubleCtrlCExit: DoubleCtrlCExitHandlers;
};

/**
 * When the command bar is not listening (e.g. escalation screen owns stdin),
 * still capture double Control+C for graceful exit.
 */
export function StdinExitCapture({
  active,
  doubleCtrlCExit,
}: StdinExitCaptureProps): null {
  const { tryHandleCtrlC } = useDoubleCtrlCExit(
    active ? doubleCtrlCExit : undefined,
  );

  useInput(
    (ch, key) => {
      if (!active) {
        return;
      }
      void tryHandleCtrlC(ch, key);
    },
    { isActive: active },
  );

  return null;
}
