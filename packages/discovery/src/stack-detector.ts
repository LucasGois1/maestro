import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StackDetectionResult, StackKind } from './types.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'ENOENT'
    ) {
      return false;
    }
    throw error;
  }
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'ENOENT'
    ) {
      return null;
    }
    throw error;
  }
}

function detectPythonFramework(text: string): string | undefined {
  if (/\bfastapi\b/ui.test(text)) return 'fastapi';
  if (/\bdjango\b/ui.test(text)) return 'django';
  if (/\bflask\b/ui.test(text)) return 'flask';
  return undefined;
}

function detectNodeFramework(pkg: Record<string, unknown>): string | undefined {
  const deps = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };
  if ('next' in deps) return 'nextjs';
  if ('@nestjs/core' in deps) return 'nestjs';
  if ('express' in deps) return 'express';
  if ('fastify' in deps) return 'fastify';
  return undefined;
}

function hasTypeScript(pkg: Record<string, unknown>): boolean {
  const deps = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };
  return 'typescript' in deps || '@types/node' in deps;
}

export async function detectStack(repoRoot: string): Promise<StackDetectionResult> {
  const markers: string[] = [];

  const paths = {
    goMod: join(repoRoot, 'go.mod'),
    cargo: join(repoRoot, 'Cargo.toml'),
    pom: join(repoRoot, 'pom.xml'),
    gradle: join(repoRoot, 'build.gradle'),
    gradleKts: join(repoRoot, 'build.gradle.kts'),
    gemfile: join(repoRoot, 'Gemfile'),
    pyproject: join(repoRoot, 'pyproject.toml'),
    setupPy: join(repoRoot, 'setup.py'),
    packageJson: join(repoRoot, 'package.json'),
  };

  if (await exists(paths.goMod)) {
    markers.push('go.mod');
    return {
      kind: 'go',
      markers,
      hints: {},
    };
  }

  if (await exists(paths.cargo)) {
    markers.push('Cargo.toml');
    return {
      kind: 'rust',
      markers,
      hints: {},
    };
  }

  if (await exists(paths.pom)) {
    markers.push('pom.xml');
    return {
      kind: 'java',
      markers,
      hints: { framework: 'maven' },
    };
  }

  if (await exists(paths.gradleKts)) {
    markers.push('build.gradle.kts');
    return {
      kind: 'java',
      markers,
      hints: { framework: 'gradle' },
    };
  }
  if (await exists(paths.gradle)) {
    markers.push('build.gradle');
    return {
      kind: 'java',
      markers,
      hints: { framework: 'gradle' },
    };
  }

  if (await exists(paths.gemfile)) {
    markers.push('Gemfile');
    return {
      kind: 'ruby',
      markers,
      hints: {},
    };
  }

  const pyprojectContent = await readText(paths.pyproject);
  if (pyprojectContent !== null) {
    markers.push('pyproject.toml');
    const framework = detectPythonFramework(pyprojectContent);
    return {
      kind: 'python',
      markers,
      hints: {
        ...(framework !== undefined ? { framework } : {}),
        packageManager: /\buv\b|\[tool\.uv\]/u.test(pyprojectContent)
          ? 'uv'
          : 'pip',
        inferredTestCommand: 'pytest',
        inferredLintCommand: 'ruff check',
      },
    };
  }

  if (await exists(paths.setupPy)) {
    markers.push('setup.py');
    return {
      kind: 'python',
      markers,
      hints: {
        inferredTestCommand: 'pytest',
      },
    };
  }

  const pkgRaw = await readText(paths.packageJson);
  if (pkgRaw !== null) {
    markers.push('package.json');
    let pkg: Record<string, unknown> = {};
    try {
      pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
    } catch {
      return {
        kind: 'node',
        markers,
        hints: {},
      };
    }

    const scripts = (pkg.scripts as Record<string, string>) ?? {};
    const testCmd = scripts.test ?? scripts['test:unit'];
    const lintCmd = scripts.lint ?? scripts['lint:fix'];

    const kind: StackKind = hasTypeScript(pkg) ? 'node-ts' : 'node';

    const framework = detectNodeFramework(pkg);
    return {
      kind,
      markers,
      hints: {
        ...(framework !== undefined ? { framework } : {}),
        packageManager: (await exists(join(repoRoot, 'pnpm-lock.yaml')))
          ? 'pnpm'
          : (await exists(join(repoRoot, 'yarn.lock')))
            ? 'yarn'
            : 'npm',
        ...(testCmd !== undefined ? { inferredTestCommand: testCmd } : {}),
        ...(lintCmd !== undefined ? { inferredLintCommand: lintCmd } : {}),
      },
    };
  }

  return {
    kind: 'unknown',
    markers: [],
    hints: {},
  };
}
