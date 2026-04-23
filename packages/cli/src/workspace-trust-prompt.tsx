import { Box, Text, useInput } from 'ink';

export interface WorkspaceTrustPromptProps {
  readonly resolvedPath: string;
  readonly onTrust: () => void;
  readonly onReject: () => void;
}

/**
 * First-run gate: Maestro may run agents and shell tools against this tree.
 */
export function WorkspaceTrustPrompt({
  resolvedPath,
  onTrust,
  onReject,
}: WorkspaceTrustPromptProps) {
  useInput((input, key) => {
    if (
      key.escape ||
      (key.ctrl && (input === 'c' || input === '\u0003'))
    ) {
      onReject();
      return;
    }
    if (input === 'y' || input === 'Y') {
      onTrust();
      return;
    }
    if (input === 'n' || input === 'N') {
      onReject();
    }
  });

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold>Trust this folder?</Text>
      <Box marginTop={1}>
        <Text dimColor wrap="wrap">
          {resolvedPath}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text wrap="wrap">
          Maestro runs agents and commands with access to files in this workspace.
          This choice is saved so you are not asked again for this path.
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text>
        <Text color="cyan">[Y]</Text>
        <Text> Trust and continue · </Text>
        <Text color="cyan">[N]</Text>
        <Text> Exit Maestro · </Text>
        <Text dimColor>Esc / Ctrl+C = exit</Text>
        </Text>
      </Box>
    </Box>
  );
}
