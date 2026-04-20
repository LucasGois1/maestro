import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export type AtomicWriteOptions = {
  readonly encoding?: BufferEncoding;
};

export async function writeAtomic(
  filePath: string,
  data: string,
  options: AtomicWriteOptions = {},
): Promise<void> {
  const absolute = resolve(filePath);
  await mkdir(dirname(absolute), { recursive: true });
  const tmp = `${absolute}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, data, { encoding: options.encoding ?? 'utf8' });
  await rename(tmp, absolute);
}

export async function writeAtomicJson(
  filePath: string,
  data: unknown,
): Promise<void> {
  await writeAtomic(filePath, `${JSON.stringify(data, null, 2)}\n`);
}
