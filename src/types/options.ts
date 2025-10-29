import { SpawnSyncOptions } from 'node:child_process';

export interface RunCemAnalyzeOptions {
  cwd?: string;
  outDir?: string;
  configPath?: string;
  analyzerExecutable?: string;
  skip?: boolean;
  spawnOptions?: SpawnSyncOptions;
}

export interface GenerateAngularWrappersOptions {
  manifestPath: string;
  wrappersRoot?: string;
  componentsRoot?: string;
  angularPackageName?: string;
  componentLibraryImport?: string;
  componentLibraryVersion?: string;
  loaderImportPath?: string;
  wrapperSelectorPrefix?: string;
  linkNodeModulesFrom?: string;
  angularPeerDependency?: string;
  tslibVersion?: string;
}

export interface GenerateAngularWrappersFromCemOptions
  extends RunCemAnalyzeOptions,
    Omit<GenerateAngularWrappersOptions, 'manifestPath'> {}
