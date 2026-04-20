import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import type { z } from 'zod';

import {
  sprintContractFrontmatterSchema,
  type SprintContract,
  type SprintContractFrontmatterInput,
} from './schema.js';

export class ContractParseError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ContractParseError';
  }
}

export class ContractValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: readonly z.core.$ZodIssue[],
  ) {
    super(message);
    this.name = 'ContractValidationError';
  }
}

const FRONTMATTER_DELIMITER = '---';

type SplitResult = {
  readonly rawFrontmatter: string;
  readonly body: string;
};

function splitFrontmatter(source: string): SplitResult {
  const normalized = source.replace(/^\uFEFF/u, '');
  const lines = normalized.split(/\r?\n/u);

  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    throw new ContractParseError(
      'Missing opening --- delimiter for YAML frontmatter.',
    );
  }

  let closingIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i]?.trim() === FRONTMATTER_DELIMITER) {
      closingIndex = i;
      break;
    }
  }
  if (closingIndex === -1) {
    throw new ContractParseError(
      'Missing closing --- delimiter for frontmatter.',
    );
  }

  const rawFrontmatter = lines.slice(1, closingIndex).join('\n');
  const body = lines
    .slice(closingIndex + 1)
    .join('\n')
    .replace(/^\n/u, '');
  return { rawFrontmatter, body };
}

export function parseSprintContract(source: string): SprintContract {
  const { rawFrontmatter, body } = splitFrontmatter(source);

  let rawData: unknown;
  try {
    rawData = yamlParse(rawFrontmatter);
  } catch (cause) {
    throw new ContractParseError('Invalid YAML frontmatter.', cause);
  }
  if (rawData === null || typeof rawData !== 'object') {
    throw new ContractParseError('Frontmatter must be a YAML mapping.');
  }

  const parsed = sprintContractFrontmatterSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new ContractValidationError(
      'Frontmatter failed validation.',
      parsed.error.issues,
    );
  }

  return { frontmatter: parsed.data, body };
}

export type WriteContractOptions = {
  readonly frontmatter: SprintContractFrontmatterInput;
  readonly body: string;
};

export function writeSprintContract(options: WriteContractOptions): string {
  const parsed = sprintContractFrontmatterSchema.safeParse(options.frontmatter);
  if (!parsed.success) {
    throw new ContractValidationError(
      'Cannot write an invalid contract frontmatter.',
      parsed.error.issues,
    );
  }
  const yaml = yamlStringify(parsed.data, { lineWidth: 0 }).trimEnd();
  const body = options.body.replace(/^\n+/u, '').replace(/\s+$/u, '');
  const parts = [FRONTMATTER_DELIMITER, yaml, FRONTMATTER_DELIMITER];
  if (body.length > 0) parts.push('', body);
  return `${parts.join('\n')}\n`;
}
