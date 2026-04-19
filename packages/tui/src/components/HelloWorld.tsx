import { Box, Text } from 'ink';

import { MAESTRO_ASCII_BANNER } from '../maestro-banner.js';
import { formatHelloMessage } from '../message.js';

export function HelloWorld(props: Readonly<{ version: string }>) {
  const { version } = props;

  return (
    <Box
      borderColor="green"
      borderStyle="round"
      flexDirection="column"
      paddingX={2}
      paddingY={1}
    >
      <Text>{MAESTRO_ASCII_BANNER}</Text>
      <Text color="green">{formatHelloMessage(version)}</Text>
    </Box>
  );
}
