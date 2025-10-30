declare module 'node:child_process' {
  export interface SpawnSyncOptions {
    cwd?: string;
    stdio?: 'inherit' | 'pipe' | 'ignore' | Array<any>;
    env?: Record<string, string | undefined>;
  }

  export interface SpawnSyncReturns<T> {
    pid: number;
    output: T[];
    stdout: T;
    stderr: T;
    status: number | null;
    signal: string | null;
    error?: Error;
  }

  export function spawnSync(
    command: string,
    args?: readonly string[],
    options?: SpawnSyncOptions,
  ): SpawnSyncReturns<string>;
}

declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: any): void;
  export function readFileSync(path: string, options?: any): string;
  export function writeFileSync(path: string, data: string, options?: any): void;
  export function readdirSync(path: string): string[];
  export function unlinkSync(path: string): void;
  export function lstatSync(path: string): { isSymbolicLink(): boolean };
  export function readlinkSync(path: string): string;
  export function symlinkSync(target: string, path: string, type?: string): void;
}

declare module 'node:path' {
  export function join(...segments: string[]): string;
  export function resolve(...segments: string[]): string;
  export function dirname(path: string): string;
}

declare const process: {
  platform: string;
  env: Record<string, string | undefined>;
  cwd(): string;
};

declare namespace NodeJS {
  interface ErrnoException extends Error {
    code?: string;
  }
}
