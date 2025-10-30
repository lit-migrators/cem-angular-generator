import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Ensures a symbolic link exists at the specified path pointing to the target.
 * If a symlink already exists and points to the correct target, does nothing.
 * If a different file/link exists at that path, removes it first.
 *
 * @param targetPath - Absolute path to the target directory/file
 * @param linkPath - Absolute path where the symlink should be created
 */
export const ensureSymlink = (targetPath: string, linkPath: string): void => {
  try {
    const stat = lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      const resolved = resolve(dirname(linkPath), readlinkSync(linkPath));
      if (resolved === targetPath) {
        // Symlink already points to correct target
        return;
      }
      // Remove incorrect symlink
      unlinkSync(linkPath);
    } else {
      // Remove non-symlink file/directory
      unlinkSync(linkPath);
    }
  } catch (error) {
    // If ENOENT, the link doesn't exist yet - that's fine
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  // Create parent directory if needed
  mkdirSync(dirname(linkPath), { recursive: true });

  // Create the symlink
  symlinkSync(targetPath, linkPath, "junction");
};

/**
 * Sets up symlinks for node_modules dependencies.
 * Links @angular, tslib, rxjs, and the component library into the wrappers' node_modules.
 *
 * @param linkNodeModulesFrom - Root directory containing node_modules to link from
 * @param wrappersRoot - Root directory of the wrappers package
 * @param componentsRoot - Root directory of the component library
 * @param componentLibraryImport - Import name of the component library
 */
export const setupNodeModulesSymlinks = (
  linkNodeModulesFrom: string | undefined,
  wrappersRoot: string,
  componentsRoot: string,
  componentLibraryImport: string
): void => {
  if (!linkNodeModulesFrom) {
    return;
  }

  const nodeModulesRoot = resolve(linkNodeModulesFrom, "node_modules");
  if (!existsSync(nodeModulesRoot)) {
    return;
  }

  // Link @angular packages
  const angularTarget = resolve(nodeModulesRoot, "@angular");
  if (existsSync(angularTarget)) {
    ensureSymlink(
      angularTarget,
      resolve(wrappersRoot, "node_modules/@angular")
    );
  }

  // Link tslib
  const tslibTarget = resolve(nodeModulesRoot, "tslib");
  if (existsSync(tslibTarget)) {
    ensureSymlink(tslibTarget, resolve(wrappersRoot, "node_modules/tslib"));
  }

  // Link rxjs
  const rxjsTarget = resolve(nodeModulesRoot, "rxjs");
  if (existsSync(rxjsTarget)) {
    ensureSymlink(rxjsTarget, resolve(wrappersRoot, "node_modules/rxjs"));
  }

  // Link component library
  if (existsSync(componentsRoot)) {
    ensureSymlink(
      componentsRoot,
      resolve(wrappersRoot, `node_modules/${componentLibraryImport}`)
    );
  }
};

/**
 * Creates or updates package.json for the Angular wrappers.
 * Only creates the file if it doesn't already exist.
 *
 * @param wrappersRoot - Root directory of the wrappers package
 * @param angularPackageName - NPM package name
 * @param angularPeerDependency - Angular version constraint
 * @param componentLibraryImport - Component library package name
 * @param componentLibraryVersion - Component library version
 * @param tslibVersion - tslib version
 * @param description - Package description
 */
export const setupPackageJson = (
  wrappersRoot: string,
  angularPackageName: string,
  angularPeerDependency: string,
  componentLibraryImport: string,
  componentLibraryVersion: string,
  tslibVersion: string,
  description: string = "Auto-generated Angular bindings for web components."
): void => {
  const packageJsonPath = resolve(wrappersRoot, "package.json");

  if (existsSync(packageJsonPath)) {
    return;
  }

  const pkg = {
    name: angularPackageName,
    version: "0.0.1",
    private: true,
    sideEffects: false,
    description,
    peerDependencies: {
      "@angular/core": angularPeerDependency,
      [componentLibraryImport]: componentLibraryVersion,
    },
    dependencies: {
      tslib: tslibVersion,
    },
  };

  writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
};

/**
 * Creates or updates tsconfig.json for the Angular wrappers.
 * Only creates the file if it doesn't already exist.
 *
 * @param wrappersRoot - Root directory of the wrappers package
 * @param moduleType - TypeScript module type ("nodenext" or "ES2022")
 */
export const setupTsConfig = (
  wrappersRoot: string,
  moduleType: "nodenext" | "ES2022" = "nodenext"
): void => {
  const tsconfigPath = resolve(wrappersRoot, "tsconfig.json");

  if (existsSync(tsconfigPath)) {
    return;
  }

  const tsconfig = {
    compilerOptions: {
      declaration: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      strict: true,
      target: "ES2022",
      module: moduleType,
      moduleResolution: "nodenext",
      outDir: "dist",
      importHelpers: true,
      types: [],
    },
    include: ["src/**/*.ts"],
  };

  writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
};

/**
 * Sets up both package.json and tsconfig.json files.
 * Convenience function that calls setupPackageJson and setupTsConfig.
 */
export const setupProjectFiles = (
  wrappersRoot: string,
  angularPackageName: string,
  angularPeerDependency: string,
  componentLibraryImport: string,
  componentLibraryVersion: string,
  tslibVersion: string,
  description?: string,
  augmented?: boolean
): void => {
  setupPackageJson(
    wrappersRoot,
    angularPackageName,
    angularPeerDependency,
    componentLibraryImport,
    componentLibraryVersion,
    tslibVersion,
    description
  );

  // Augmented output uses different module configuration
  const moduleType = augmented ? "ES2022" : "nodenext";
  setupTsConfig(wrappersRoot, moduleType as "ES2022" | "nodenext");
};
