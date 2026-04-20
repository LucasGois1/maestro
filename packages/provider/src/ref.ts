import { PROVIDER_NAMES, type ProviderName } from '@maestro/config';

export type ModelRef = {
  readonly provider: ProviderName;
  readonly modelId: string;
};

export class InvalidModelRefError extends Error {
  constructor(
    message: string,
    public readonly ref: string,
  ) {
    super(message);
    this.name = 'InvalidModelRefError';
  }
}

const REF_PATTERN = /^([a-z0-9-]+)\/(.+)$/;

export function parseModelRef(ref: string): ModelRef {
  const match = REF_PATTERN.exec(ref);
  if (!match) {
    throw new InvalidModelRefError(
      `Model ref must be "provider/modelId", got: "${ref}"`,
      ref,
    );
  }
  const [, providerRaw, modelId] = match;
  if (providerRaw === undefined || modelId === undefined) {
    throw new InvalidModelRefError(`Unparsable ref: "${ref}"`, ref);
  }
  if (!isKnownProvider(providerRaw)) {
    throw new InvalidModelRefError(
      `Unknown provider "${providerRaw}". Supported: ${PROVIDER_NAMES.join(', ')}`,
      ref,
    );
  }
  if (modelId.trim().length === 0) {
    throw new InvalidModelRefError(`Empty modelId in ref: "${ref}"`, ref);
  }
  return { provider: providerRaw, modelId };
}

function isKnownProvider(value: string): value is ProviderName {
  return (PROVIDER_NAMES as readonly string[]).includes(value);
}
