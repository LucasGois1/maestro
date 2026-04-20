import { z } from 'zod';

import { SENSOR_KINDS, SENSOR_ON_FAIL, SENSOR_PARSERS } from './types.js';

const sensorBaseSchema = z
  .object({
    id: z.string().min(1),
    onFail: z.enum(SENSOR_ON_FAIL).default('block'),
    appliesTo: z.array(z.string().min(1)).default([]),
  })
  .strict();

const computationalSensorSchema = sensorBaseSchema
  .extend({
    kind: z.literal(SENSOR_KINDS[0]),
    command: z.string().min(1),
    args: z.array(z.string()).default([]),
    cwd: z.string().min(1).optional(),
    timeoutSec: z.int().positive().default(60),
    expectExitCode: z.int().default(0),
    parseOutput: z.enum(SENSOR_PARSERS).default('generic'),
  })
  .strict();

const inferentialSensorSchema = sensorBaseSchema
  .extend({
    kind: z.literal(SENSOR_KINDS[1]),
    agent: z.string().min(1),
    criteria: z.array(z.string().min(1)).default([]),
    timeoutSec: z.int().positive().default(60),
  })
  .strict();

export const sensorDefinitionSchema = z.discriminatedUnion('kind', [
  computationalSensorSchema,
  inferentialSensorSchema,
]);

export const sensorsFileSchema = z
  .object({
    concurrency: z.int().positive().default(4),
    sensors: z.array(sensorDefinitionSchema).default([]),
  })
  .strict();

export type SensorDefinition = z.output<typeof sensorDefinitionSchema>;
export type SensorDefinitionInput = z.input<typeof sensorDefinitionSchema>;
export type ComputationalSensorDefinition = z.output<
  typeof computationalSensorSchema
>;
export type InferentialSensorDefinition = z.output<
  typeof inferentialSensorSchema
>;
export type SensorsFile = z.output<typeof sensorsFileSchema>;
