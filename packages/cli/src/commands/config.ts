import {
  coerceScalar,
  configSchema,
  ConfigValidationError,
  getByPath,
  isSecretPath,
  loadConfig,
  maskSecrets,
  readConfigFile,
  resolveConfigPaths,
  setByPath,
  writeConfigFile,
  type LoadedConfig,
  type MaestroConfigInput,
} from '@maestro/config';
import { Command } from 'commander';

type Scope = 'global' | 'project';

type Io = {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

const defaultIo: Io = {
  /* v8 ignore next */
  stdout: (line) => process.stdout.write(`${line}\n`),
  /* v8 ignore next */
  stderr: (line) => process.stderr.write(`${line}\n`),
};

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function formatIssues(error: ConfigValidationError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

async function loadOrPrintError(io: Io): Promise<LoadedConfig | null> {
  try {
    return await loadConfig();
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      io.stderr('Configuration is invalid:');
      io.stderr(formatIssues(error));
      return null;
    }
    io.stderr((error as Error).message);
    return null;
  }
}

function scopePath(scope: Scope): string {
  const paths = resolveConfigPaths();
  return scope === 'global' ? paths.global : paths.project;
}

export function createConfigCommand(io: Io = defaultIo): Command {
  const config = new Command('config').description(
    'Manage Maestro configuration',
  );

  config
    .command('get <path>')
    .description('Print a config value by dot-path (secrets are masked)')
    .action(async (path: string) => {
      const loaded = await loadOrPrintError(io);
      if (!loaded) {
        process.exitCode = 1;
        return;
      }
      const masked = maskSecrets(loaded.resolved);
      const value = getByPath(masked, path);
      if (value === undefined) {
        io.stderr(`Path not found: ${path}`);
        process.exitCode = 1;
        return;
      }
      io.stdout(formatValue(value));
    });

  config
    .command('set <path> <value>')
    .description('Set a config value (defaults to project scope)')
    .option('--global', 'Write to the global config instead of project')
    .action(
      async (path: string, rawValue: string, options: { global?: boolean }) => {
        const scope: Scope = options.global ? 'global' : 'project';
        const target = scopePath(scope);
        const existing = (await readConfigFile(target)) ?? {};
        const coerced = coerceScalar(rawValue);
        const next = setByPath(
          existing as Record<string, unknown>,
          path,
          coerced,
        ) as MaestroConfigInput;

        const validation = configSchema.safeParse(next);
        if (!validation.success) {
          io.stderr('Resulting config would be invalid:');
          io.stderr(
            validation.error.issues
              .map(
                (issue) =>
                  `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
              )
              .join('\n'),
          );
          process.exitCode = 1;
          return;
        }

        await writeConfigFile(target, next);
        const displayValue = isSecretPath(path)
          ? '***masked***'
          : formatValue(coerced);
        io.stdout(`Set ${path} = ${displayValue} in ${scope} (${target})`);
      },
    );

  config
    .command('list')
    .description('Print the effective config with secrets masked')
    .action(async () => {
      const loaded = await loadOrPrintError(io);
      if (!loaded) {
        process.exitCode = 1;
        return;
      }
      io.stdout(JSON.stringify(maskSecrets(loaded.resolved), null, 2));
    });

  config
    .command('path')
    .description('Print which files contribute to the effective config')
    .action(async () => {
      const paths = resolveConfigPaths();
      const [global, project] = await Promise.all([
        readConfigFile(paths.global),
        readConfigFile(paths.project),
      ]);
      io.stdout(
        `global  ${global !== null ? '[exists]' : '[absent] '}  ${paths.global}`,
      );
      io.stdout(
        `project ${project !== null ? '[exists]' : '[absent] '}  ${paths.project}`,
      );
    });

  config
    .command('validate')
    .description('Validate the effective config against the schema')
    .action(async () => {
      try {
        await loadConfig();
        io.stdout('Configuration is valid.');
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          io.stderr('Configuration is invalid:');
          io.stderr(formatIssues(error));
          process.exitCode = 1;
          return;
        }
        io.stderr((error as Error).message);
        process.exitCode = 1;
      }
    });

  return config;
}
