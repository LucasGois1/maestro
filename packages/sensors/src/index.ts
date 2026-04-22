export const SENSORS_PACKAGE_NAME = '@maestro/sensors';

export {
  sensorDefinitionSchema,
  sensorsFileSchema,
  type ComputationalSensorDefinition,
  type InferentialSensorDefinition,
  type SensorDefinition,
  type SensorDefinitionInput,
  type SensorsFile,
} from './schema.js';

export { dispatchSensors, type DispatchSensorsOptions } from './dispatcher.js';

export { parseSensorOutput, type ParseSensorOutputOptions } from './parsers.js';

export { loadSensorsFile, type LoadSensorsFileOptions } from './registry.js';

export { sensorAppliesToFiles } from './selection.js';

export {
  runSensor,
  type AgentRunner,
  type SensorRunContext,
  type ShellRunner,
} from './runner.js';

export {
  SENSOR_KINDS,
  SENSOR_ON_FAIL,
  SENSOR_PARSERS,
  SENSOR_STATUSES,
  VIOLATION_SEVERITIES,
  type SensorKind,
  type SensorOnFail,
  type SensorParser,
  type SensorResult,
  type SensorStatus,
  type Violation,
  type ViolationSeverity,
} from './types.js';

export {
  codeReviewOutputSchema,
  codeReviewViolationCategorySchema,
  codeReviewViolationSchema,
  codeReviewViolationSeveritySchema,
  type CodeReviewOutput,
  type CodeReviewViolation,
} from './code-review-output.schema.js';
