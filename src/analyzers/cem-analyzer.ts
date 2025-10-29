import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { RunCemAnalyzeOptions } from '../types/options.js';

/**
 * Executes the Custom Elements Manifest analyzer to generate a manifest file.
 * This function runs the CEM analyzer via npx or pnpm exec.
 *
 * @param options - Configuration options for the analyzer
 * @returns The absolute path to the generated manifest file, or undefined if skipped
 * @throws Error if the analyzer fails or the manifest is not generated
 */
export const runCemAnalyze = (options: RunCemAnalyzeOptions = {}): string | undefined => {
  const {
    cwd = process.cwd(),
    outDir = 'dist',
    configPath = 'custom-elements-manifest.config.mjs',
    analyzerExecutable = 'cem',
    skip = process.env.STENCIL_SKIP_CEM === 'true',
    spawnOptions,
  } = options;

  if (skip) {
    return undefined;
  }

  const manifestPath = resolve(cwd, outDir, 'custom-elements.json');
  const args = [analyzerExecutable, 'analyze', '--outdir', outDir, '--config', configPath];

  const result = executeNpx(args, cwd, spawnOptions);

  if (result.error || result.status !== 0) {
    executePnpmFallback(args, cwd, spawnOptions);
  }

  validateManifestExists(manifestPath);

  return manifestPath;
};

/**
 * Executes a command via npx.
 */
const executeNpx = (
  args: string[],
  cwd: string,
  spawnOptions?: RunCemAnalyzeOptions['spawnOptions'],
) => {
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  return spawnSync(npxCommand, args, {
    cwd,
    stdio: 'inherit',
    ...spawnOptions,
  });
};

/**
 * Attempts to execute a command via pnpm exec as a fallback.
 */
const executePnpmFallback = (
  args: string[],
  cwd: string,
  spawnOptions?: RunCemAnalyzeOptions['spawnOptions'],
) => {
  const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

  const fallback = spawnSync(pnpmCommand, ['exec', ...args], {
    cwd,
    stdio: 'inherit',
    ...spawnOptions,
  });

  if (fallback.error) {
    throw fallback.error;
  }

  if (fallback.status !== 0) {
    throw new Error('Failed to generate custom-elements.json via `pnpm exec cem analyze`.');
  }
};

/**
 * Validates that the manifest file was successfully generated.
 */
const validateManifestExists = (manifestPath: string): void => {
  if (!existsSync(manifestPath)) {
    throw new Error(`Expected Custom Elements Manifest at ${manifestPath}, but it does not exist.`);
  }
};
