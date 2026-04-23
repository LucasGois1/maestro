import type { AgentDefinition } from '../definition.js';
import { SENSOR_SETUP_SYSTEM_PROMPT } from './sensor-setup-system-prompt.js';
import {
  sensorSetupAgentInputSchema,
  sensorSetupAgentOutputSchema,
  type SensorSetupAgentInput,
  type SensorSetupAgentOutput,
} from './sensor-setup-schemas.js';

export const sensorSetupAgent: AgentDefinition<
  SensorSetupAgentInput,
  SensorSetupAgentOutput
> = {
  id: 'sensor-setup',
  role: 'background',
  systemPrompt: SENSOR_SETUP_SYSTEM_PROMPT,
  inputSchema: sensorSetupAgentInputSchema,
  outputSchema: sensorSetupAgentOutputSchema,
};
