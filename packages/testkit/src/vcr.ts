import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

export type VcrMode = 'replay' | 'record';

const cassetteSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1),
    provider: z.string().min(1),
    modelId: z.string().min(1),
    request: z
      .object({
        prompt: z.string().optional(),
        system: z.string().optional(),
      })
      .passthrough(),
    response: z.object({ text: z.string() }).passthrough(),
    recordedAt: z.iso.datetime(),
  })
  .strict();

export type Cassette = z.infer<typeof cassetteSchema>;

export type CassetteRequest = {
  readonly provider?: string;
  readonly modelId?: string;
  readonly prompt?: string;
  readonly system?: string;
  readonly [key: string]: unknown;
};

export type VcrOptions = {
  readonly cassetteDir: string;
  readonly mode: VcrMode;
  readonly now?: () => Date;
};

export type TextRecorder = () => Promise<string>;

export type Vcr = {
  readonly mode: VcrMode;
  runText(
    id: string,
    request: CassetteRequest,
    recorder: TextRecorder,
  ): Promise<string>;
};

function cassettePath(cassetteDir: string, id: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9._-]+/gu, '-');
  return join(cassetteDir, `${safeId}.json`);
}

function assertNoSecrets(value: unknown): void {
  const text = JSON.stringify(value);
  if (
    /(sk-[a-zA-Z0-9_-]{8,}|MAESTRO_[A-Z_]*KEY|BEGIN (?:OPENSSH|RSA|DSA|EC) PRIVATE KEY)/u.test(
      text,
    )
  ) {
    throw new Error('Refusing to write cassette containing an obvious secret.');
  }
}

export async function readCassette(
  cassetteDir: string,
  id: string,
): Promise<Cassette> {
  const raw = await readFile(cassettePath(cassetteDir, id), 'utf8');
  const parsed = cassetteSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Invalid cassette "${id}": ${parsed.error.message}`);
  }
  return parsed.data;
}

export async function writeCassette(
  cassetteDir: string,
  cassette: Cassette,
): Promise<void> {
  assertNoSecrets(cassette);
  const parsed = cassetteSchema.parse(cassette);
  await mkdir(cassetteDir, { recursive: true });
  await writeFile(
    cassettePath(cassetteDir, parsed.id),
    `${JSON.stringify(parsed, null, 2)}\n`,
    'utf8',
  );
}

export function createVcr({
  cassetteDir,
  mode,
  now = () => new Date(),
}: VcrOptions): Vcr {
  return {
    mode,
    async runText(id, request, recorder) {
      if (mode === 'replay') {
        const cassette = await readCassette(cassetteDir, id);
        return cassette.response.text;
      }

      assertNoSecrets(request);
      const text = await recorder();
      const cassette: Cassette = {
        version: 1,
        id,
        provider: request.provider ?? 'unknown',
        modelId: request.modelId ?? 'unknown',
        request: { ...request },
        response: { text },
        recordedAt: now().toISOString(),
      };
      await writeCassette(cassetteDir, cassette);
      return text;
    },
  };
}
