import { dirname, join, resolve } from 'node:path';
import { runCemAnalyze } from '../analyzers/cem-analyzer.js';
import {
  GenerateAngularWrappersFromCemOptions,
  GenerateAngularWrappersOptions,
} from '../types/options.js';
import { GenerateAngularWrappersResult } from '../types/component.js';
import { cleanupOldFiles, ensureDirectory, writeFile } from '../utils/file-system.js';
import { setupNodeModulesLinks } from '../utils/symlink.js';
import { parseManifest } from './manifest-parser.js';
import { generateComponentTemplate } from './template-generator.js';
import {
  generatePackageJson,
  generatePublicApi,
  generateRegisterFile,
  generateTsConfig,
} from './scaffold-generator.js';

/**
 * Generates Angular wrapper components from a Custom Elements Manifest.
 *
 * This function:
 * 1. Parses the CEM to extract component metadata
 * 2. Generates scaffold files (package.json, tsconfig.json)
 * 3. Creates Angular wrapper components for each web component
 * 4. Generates a public API export file
 * 5. Sets up node_modules symlinks if requested
 * 6. Cleans up old component files
 *
 * @param options - Configuration options for wrapper generation
 * @returns Metadata about the generated wrappers
 * @throws Error if manifestPath is not provided
 */
export const generateAngularWrappers = (
  options: GenerateAngularWrappersOptions,
): GenerateAngularWrappersResult => {
  const {
    manifestPath,
    angularPackageName = '@experiment/angular-wrappers',
    componentLibraryImport = 'web-components',
    componentLibraryVersion = 'workspace:*',
    loaderImportPath = 'web-components/loader',
    wrapperSelectorPrefix = '',
    linkNodeModulesFrom,
    angularPeerDependency = '^20.0.0',
    tslibVersion = '^2.3.0',
  } = options;

  if (!manifestPath) {
    throw new Error('generateAngularWrappers requires a manifestPath.');
  }

  // Resolve directory paths
  const componentsRoot = options.componentsRoot ?? resolve(dirname(manifestPath), '..');
  const wrappersRoot = options.wrappersRoot ?? resolve(componentsRoot, '../angular-wrappers');
  const wrappersSrcRoot = join(wrappersRoot, 'src');
  const wrappersLibDir = join(wrappersSrcRoot, 'lib');

  // Create directory structure
  ensureDirectory(wrappersLibDir);

  // Generate scaffold files
  generatePackageJson({
    wrappersRoot,
    wrappersSrcRoot,
    angularPackageName,
    componentLibraryImport,
    componentLibraryVersion,
    loaderImportPath,
    angularPeerDependency,
    tslibVersion,
  });

  generateTsConfig(wrappersRoot);

  // Set up node_modules symlinks if requested
  if (linkNodeModulesFrom) {
    setupNodeModulesLinks(
      linkNodeModulesFrom,
      wrappersRoot,
      componentsRoot,
      componentLibraryImport,
    );
  }

  // Parse the manifest and generate components
  const components = parseManifest(manifestPath, wrapperSelectorPrefix);
  const generatedFiles = new Set<string>();

  for (const component of components) {
    const filePath = join(wrappersLibDir, component.fileName);
    generatedFiles.add(component.fileName);

    const content = generateComponentTemplate(component, componentLibraryImport);
    writeFile(filePath, content);
  }

  // Clean up old component files that are no longer in the manifest
  cleanupOldFiles(wrappersLibDir, generatedFiles, wrapperSelectorPrefix, '.component.ts');

  // Generate helper files
  generateRegisterFile(wrappersSrcRoot, loaderImportPath);
  generatePublicApi(wrappersSrcRoot, components);

  return {
    components,
    wrappersRoot,
    manifestPath,
  };
};

/**
 * Convenience function that runs CEM analysis and then generates Angular wrappers.
 *
 * This function combines `runCemAnalyze` and `generateAngularWrappers` into a single call.
 *
 * @param options - Combined options for both analysis and wrapper generation
 * @returns Metadata about the generated wrappers, or undefined if analysis was skipped
 */
export const generateAngularWrappersFromCem = (
  options: GenerateAngularWrappersFromCemOptions = {},
): GenerateAngularWrappersResult | undefined => {
  const manifestPath = runCemAnalyze(options);

  if (!manifestPath) {
    return undefined;
  }

  return generateAngularWrappers({
    manifestPath,
    wrappersRoot: options.wrappersRoot,
    componentsRoot: options.componentsRoot,
    angularPackageName: options.angularPackageName,
    componentLibraryImport: options.componentLibraryImport,
    componentLibraryVersion: options.componentLibraryVersion,
    loaderImportPath: options.loaderImportPath,
    wrapperSelectorPrefix: options.wrapperSelectorPrefix,
    linkNodeModulesFrom: options.linkNodeModulesFrom,
    angularPeerDependency: options.angularPeerDependency,
    tslibVersion: options.tslibVersion,
  });
};
