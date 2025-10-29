import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentMeta } from '../types/component.js';
import { writeFile, writeJsonFile } from '../utils/file-system.js';

export interface ScaffoldOptions {
  wrappersRoot: string;
  wrappersSrcRoot: string;
  angularPackageName: string;
  componentLibraryImport: string;
  componentLibraryVersion: string;
  loaderImportPath: string;
  angularPeerDependency: string;
  tslibVersion: string;
}

/**
 * Generates the package.json file for the Angular wrappers library.
 */
export const generatePackageJson = (options: ScaffoldOptions): void => {
  const packageJsonPath = join(options.wrappersRoot, 'package.json');

  // Only create if it doesn't exist to avoid overwriting user customizations
  if (existsSync(packageJsonPath)) {
    return;
  }

  const pkg = {
    name: options.angularPackageName,
    version: '0.0.1',
    private: true,
    sideEffects: false,
    description: 'Auto-generated Angular bindings for the Stencil + Lit web components.',
    peerDependencies: {
      '@angular/core': options.angularPeerDependency,
      [options.componentLibraryImport]: options.componentLibraryVersion,
    },
    dependencies: {
      tslib: options.tslibVersion,
    },
  };

  writeJsonFile(packageJsonPath, pkg);
};

/**
 * Generates the tsconfig.json file for the Angular wrappers library.
 */
export const generateTsConfig = (wrappersRoot: string): void => {
  const tsconfigPath = join(wrappersRoot, 'tsconfig.json');

  // Only create if it doesn't exist to avoid overwriting user customizations
  if (existsSync(tsconfigPath)) {
    return;
  }

  const tsconfig = {
    compilerOptions: {
      declaration: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      strict: true,
      target: 'ES2022',
      module: 'ES2022',
      moduleResolution: 'nodenext',
      outDir: 'dist',
      importHelpers: true,
      types: [],
    },
    include: ['src/**/*.ts'],
  };

  writeJsonFile(tsconfigPath, tsconfig);
};

/**
 * Generates the register-stencil-components.ts helper file.
 */
export const generateRegisterFile = (
  wrappersSrcRoot: string,
  loaderImportPath: string,
): void => {
  const registerFile = join(wrappersSrcRoot, 'register-stencil-components.ts');

  const content = `import { defineCustomElements } from '${loaderImportPath}';

let componentsDefined = false;

export const registerStencilComponents = (): void => {
  if (componentsDefined || typeof window === 'undefined') {
    return;
  }

  defineCustomElements(window);
  componentsDefined = true;
};
`;

  writeFile(registerFile, content);
};

/**
 * Generates the public-api.ts file that exports all wrapper components.
 */
export const generatePublicApi = (
  wrappersSrcRoot: string,
  components: ComponentMeta[],
): void => {
  const importLines = components
    .map(
      (component) =>
        `import { ${component.className} } from './lib/${component.fileName.replace('.ts', '')}';`,
    )
    .join('\n');

  const exportLines = components
    .map(
      (component) =>
        `export { ${component.className} } from './lib/${component.fileName.replace('.ts', '')}';`,
    )
    .join('\n');

  const exportList = components.map((component) => `  ${component.className},`).join('\n');

  const content = `${importLines}
${exportLines}
export { registerStencilComponents } from './register-stencil-components';

export const STENCIL_WRAPPER_COMPONENTS = [
${exportList}
] as const;
`;

  writeFile(join(wrappersSrcRoot, 'public-api.ts'), content);
};
