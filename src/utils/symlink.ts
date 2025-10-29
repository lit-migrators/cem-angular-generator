import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Ensures that a symbolic link exists at the specified path, pointing to the target path.
 * If the link already exists and points to the correct target, this function does nothing.
 * If the link exists but points to a different target, it will be removed and recreated.
 *
 * @param targetPath - The absolute path that the symlink should point to
 * @param linkPath - The absolute path where the symlink should be created
 */
export const ensureSymlink = (targetPath: string, linkPath: string): void => {
  try {
    const stat = lstatSync(linkPath);

    if (stat.isSymbolicLink()) {
      const resolved = resolve(dirname(linkPath), readlinkSync(linkPath));
      if (resolved === targetPath) {
        return;
      }
      unlinkSync(linkPath);
    } else {
      unlinkSync(linkPath);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(targetPath, linkPath, 'junction');
};

/**
 * Creates symbolic links for node_modules dependencies in the wrappers directory.
 * This allows the wrappers to access dependencies from a parent project.
 *
 * @param linkNodeModulesFrom - The directory containing node_modules to link from
 * @param wrappersRoot - The root directory of the Angular wrappers
 * @param componentsRoot - The root directory of the component library
 * @param componentLibraryImport - The npm package name of the component library
 */
export const setupNodeModulesLinks = (
  linkNodeModulesFrom: string,
  wrappersRoot: string,
  componentsRoot: string,
  componentLibraryImport: string,
): void => {
  const nodeModulesRoot = resolve(linkNodeModulesFrom, 'node_modules');

  if (!existsSync(nodeModulesRoot)) {
    return;
  }

  // Link @angular packages
  const angularTarget = resolve(nodeModulesRoot, '@angular');
  if (existsSync(angularTarget)) {
    ensureSymlink(angularTarget, resolve(wrappersRoot, 'node_modules/@angular'));
  }

  // Link tslib
  const tslibTarget = resolve(nodeModulesRoot, 'tslib');
  if (existsSync(tslibTarget)) {
    ensureSymlink(tslibTarget, resolve(wrappersRoot, 'node_modules/tslib'));
  }

  // Link component library
  if (existsSync(componentsRoot)) {
    ensureSymlink(
      componentsRoot,
      resolve(wrappersRoot, `node_modules/${componentLibraryImport}`),
    );
  }
};
