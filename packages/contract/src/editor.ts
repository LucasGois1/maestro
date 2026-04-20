import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

import { parseSprintContract, writeSprintContract } from './parser.js';
import type { SprintContract } from './schema.js';

export class EditorLaunchError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'EditorLaunchError';
  }
}

export function resolveEditorCommand(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = env.MAESTRO_EDITOR ?? env.VISUAL ?? env.EDITOR;
  if (explicit && explicit.trim().length > 0) return explicit.trim();
  return process.platform === 'win32' ? 'notepad' : 'vi';
}

export type EditContractOptions = {
  readonly filePath: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly stdio?: 'inherit' | 'ignore';
  readonly spawnImpl?: typeof spawn;
};

function runEditor(
  command: string,
  filePath: string,
  options: EditContractOptions,
): Promise<void> {
  const impl = options.spawnImpl ?? spawn;
  return new Promise((resolve, reject) => {
    const [program, ...args] = command.split(/\s+/u);
    if (!program) {
      reject(new EditorLaunchError(`Empty editor command: "${command}"`));
      return;
    }
    const child = impl(program, [...args, filePath], {
      stdio: options.stdio ?? 'inherit',
    });
    child.on('error', (error) => {
      reject(
        new EditorLaunchError(`Failed to launch editor "${program}"`, error),
      );
    });
    child.on('exit', (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new EditorLaunchError(`Editor exited with code ${code}`));
    });
  });
}

export async function editSprintContract(
  options: EditContractOptions,
): Promise<SprintContract> {
  const command = resolveEditorCommand(options.env);
  await runEditor(command, options.filePath, options);

  const edited = await readFile(options.filePath, 'utf8');
  const parsed = parseSprintContract(edited);

  const negotiatedBy = parsed.frontmatter.negotiated_by.includes('human')
    ? parsed.frontmatter.negotiated_by
    : [...parsed.frontmatter.negotiated_by, 'human' as const];

  const nextFrontmatter = {
    ...parsed.frontmatter,
    negotiated_by: negotiatedBy,
  };

  const serialized = writeSprintContract({
    frontmatter: nextFrontmatter,
    body: parsed.body,
  });
  await writeFile(options.filePath, serialized, 'utf8');

  return { frontmatter: nextFrontmatter, body: parsed.body };
}
