import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Re-export public types
export type {
  RunCemAnalyzeOptions,
  GenerateAngularWrappersOptions,
  GenerateAngularWrappersResult,
  GenerateAngularWrappersFromCemOptions,
  ComponentMeta,
  ComponentMember,
  ComponentEvent,
} from "./types";

// Import utility modules
import { parseManifest } from "./manifest-parser";
import { setupProjectFiles, setupNodeModulesSymlinks } from "./file-system";
import {
  generateComponentFileContent,
  generateLitIndexContent,
  generatePublicApiContent,
} from "./code-generation";

import type {
  RunCemAnalyzeOptions,
  GenerateAngularWrappersOptions,
  GenerateAngularWrappersResult,
  GenerateAngularWrappersFromCemOptions,
  ComponentMeta,
} from "./types";

/**
 * Runs the Custom Elements Manifest (CEM) analyzer to generate a manifest file.
 * Attempts to use npx first, falls back to pnpm exec if npx is not available.
 *
 * @param options - Configuration options for the analyzer
 * @returns Path to the generated manifest, or undefined if skipped
 */
export const runCemAnalyze = (
  options: RunCemAnalyzeOptions = {}
): string | undefined => {
  const {
    cwd = process.cwd(),
    outDir = "dist",
    configPath = "custom-elements-manifest.config.mjs",
    analyzerExecutable = "cem",
    skip = process.env.STENCIL_SKIP_CEM === "true",
    spawnOptions,
  } = options;

  if (skip) {
    return undefined;
  }

  const manifestPath = resolve(cwd, outDir, "custom-elements.json");
  const args = [
    analyzerExecutable,
    "analyze",
    "--outdir",
    outDir,
    "--config",
    configPath,
  ];
  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

  const result = spawnSync(npxCommand, args, {
    cwd,
    stdio: "inherit",
    ...spawnOptions,
  });

  /**
   * Fallback to pnpm exec if npx fails.
   */
  const attemptFallback = () => {
    const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const fallback = spawnSync(pnpmCommand, ["exec", ...args], {
      cwd,
      stdio: "inherit",
      ...spawnOptions,
    });

    if (fallback.error) {
      throw fallback.error;
    }

    if (fallback.status !== 0) {
      throw new Error(
        "Failed to generate custom-elements.json via `pnpm exec cem analyze`."
      );
    }
  };

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      attemptFallback();
    } else {
      throw result.error;
    }
  } else if (result.status !== 0) {
    attemptFallback();
  }

  if (!existsSync(manifestPath)) {
    throw new Error(
      `Expected Custom Elements Manifest at ${manifestPath}, but it does not exist.`
    );
  }

  return manifestPath;
};

/**
 * Generates Angular wrapper components from a Custom Elements Manifest.
 * Creates component files, configuration files, and exports.
 *
 * @param options - Configuration options for wrapper generation
 * @returns Result containing component metadata and paths
 */
export const generateAngularWrappers = (
  options: GenerateAngularWrappersOptions
): GenerateAngularWrappersResult => {
  const {
    manifestPath,
    angularPackageName = "@experiment/angular-wrappers",
    componentLibraryImport = "web-components",
    componentLibraryVersion = "workspace:*",
    loaderImportPath = "web-components/loader",
    wrapperSelectorPrefix = "wc-",
    linkNodeModulesFrom,
    angularPeerDependency = "^20.0.0",
    tslibVersion = "^2.3.0",
    augmentAngularOutput = false,
    standalone = true,
  } = options;

  if (!manifestPath) {
    throw new Error("generateAngularWrappers requires a manifestPath.");
  }

  // Determine output directories
  const componentsRoot =
    options.componentsRoot ?? resolve(dirname(manifestPath), "..");
  const wrappersRoot =
    options.wrappersRoot ?? resolve(componentsRoot, "../angular-wrappers");

  const wrappersSrcRoot = join(wrappersRoot, "src");
  const wrappersLibDir = join(wrappersSrcRoot, "lib");
  mkdirSync(wrappersLibDir, { recursive: true });

  // Parse the manifest to extract component metadata
  const components = parseManifest(manifestPath, wrapperSelectorPrefix);

  // Handle augmented output (separate structure for Lit components)
  if (augmentAngularOutput) {
    return generateAngularOutputAugmentation(
      components,
      componentsRoot,
      wrappersRoot,
      manifestPath,
      componentLibraryImport,
      componentLibraryVersion,
      loaderImportPath,
      linkNodeModulesFrom,
      angularPackageName,
      angularPeerDependency,
      tslibVersion,
      standalone
    );
  }

  // Setup project configuration files
  setupProjectFiles(
    wrappersRoot,
    angularPackageName,
    angularPeerDependency,
    componentLibraryImport,
    componentLibraryVersion,
    tslibVersion,
    "Auto-generated Angular bindings for the Stencil + Lit web components.",
    false // not augmented
  );

  // Setup node_modules symlinks for dependencies
  setupNodeModulesSymlinks(
    linkNodeModulesFrom,
    wrappersRoot,
    componentsRoot,
    componentLibraryImport
  );

  // Generate component wrapper files
  const generatedFiles = new Set<string>();
  for (const component of components) {
    const filePath = join(wrappersLibDir, component.fileName);
    generatedFiles.add(component.fileName);

    const content = generateComponentFileContent(
      component,
      componentLibraryImport,
      standalone
    );
    writeFileSync(filePath, content);
  }

  // Clean up old component files that are no longer in the manifest
  const existing = readdirSync(wrappersLibDir).filter(
    (name) =>
      name.endsWith(".component.ts") && name.startsWith(wrapperSelectorPrefix)
  );
  for (const file of existing) {
    if (!generatedFiles.has(file)) {
      unlinkSync(join(wrappersLibDir, file));
    }
  }

  // Generate registration file for web components
  const registerFile = join(wrappersSrcRoot, "register-stencil-components.ts");
  const registerContent = `import { defineCustomElements } from '${loaderImportPath}';

let componentsDefined = false;

export const registerStencilComponents = (): void => {
  if (componentsDefined || typeof window === 'undefined') {
    return;
  }

  defineCustomElements(window);
  componentsDefined = true;
};
`;
  writeFileSync(registerFile, registerContent);

  // Generate public API barrel file
  const importLines = components
    .map(
      (component) =>
        `import { ${
          component.className
        } } from './lib/${component.fileName.replace(".ts", "")}';`
    )
    .join("\n");
  const exportLines = components
    .map(
      (component) =>
        `export { ${
          component.className
        } } from './lib/${component.fileName.replace(".ts", "")}';`
    )
    .join("\n");
  const exportList = components
    .map((component) => `  ${component.className},`)
    .join("\n");

  const publicApiContent = `${importLines}
${exportLines}
export { registerStencilComponents } from './register-stencil-components';

export const STENCIL_WRAPPER_COMPONENTS = [
${exportList}
] as const;
`;
  writeFileSync(join(wrappersSrcRoot, "public-api.ts"), publicApiContent);

  return {
    components,
    wrappersRoot,
    manifestPath,
  };
};

/**
 * Generates Angular output with augmented structure (for Lit components).
 * Creates a more complex directory structure with separate lit/ directory.
 */
const generateAngularOutputAugmentation = (
  components: ComponentMeta[],
  componentsRoot: string,
  wrappersRoot: string,
  manifestPath: string,
  componentLibraryImport: string,
  componentLibraryVersion: string,
  loaderImportPath: string,
  linkNodeModulesFrom: string | undefined,
  angularPackageName: string,
  angularPeerDependency: string,
  tslibVersion: string,
  standalone: boolean
): GenerateAngularWrappersResult => {
  const wrappersSrcRoot = join(wrappersRoot, "src");
  const wrappersLibRoot = join(wrappersSrcRoot, "lib");
  mkdirSync(wrappersLibRoot, { recursive: true });
  const litDir = join(wrappersLibRoot, "lit");
  mkdirSync(litDir, { recursive: true });

  // Setup project configuration files
  setupProjectFiles(
    wrappersRoot,
    angularPackageName,
    angularPeerDependency,
    componentLibraryImport,
    componentLibraryVersion,
    tslibVersion,
    "Angular bindings for Stencil and Lit web components.",
    true // augmented
  );

  // Setup node_modules symlinks
  setupNodeModulesSymlinks(
    linkNodeModulesFrom,
    wrappersRoot,
    componentsRoot,
    componentLibraryImport
  );

  // Generate component wrappers in lit/ directory
  const generatedFiles = new Set<string>();
  for (const component of components) {
    const filePath = join(litDir, component.fileName);
    generatedFiles.add(component.fileName);

    const content = generateComponentFileContent(
      component,
      componentLibraryImport,
      standalone
    );
    writeFileSync(filePath, content);
  }

  // Clean up old component files
  const existing = readdirSync(litDir).filter((name) =>
    name.endsWith(".component.ts")
  );
  for (const file of existing) {
    if (!generatedFiles.has(file)) {
      unlinkSync(join(litDir, file));
    }
  }

  // Generate lit/index.ts
  const litIndexPath = join(litDir, "index.ts");
  writeFileSync(litIndexPath, generateLitIndexContent(components));

  // Generate public-api.ts
  const publicApiPath = join(wrappersSrcRoot, "public-api.ts");
  writeFileSync(publicApiPath, generatePublicApiContent());

  return {
    components,
    wrappersRoot,
    manifestPath,
  };
};

/**
 * Convenience function that runs CEM analysis and generates Angular wrappers.
 * Combines runCemAnalyze and generateAngularWrappers into a single call.
 *
 * @param options - Combined options for both analysis and generation
 * @returns Result containing component metadata and paths, or undefined if skipped
 */
export const generateAngularWrappersFromCem = (
  options: GenerateAngularWrappersFromCemOptions = {}
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
    augmentAngularOutput: options.augmentAngularOutput,
    standalone: options.standalone,
  });
};
