import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Ensures that a directory exists, creating it if necessary.
 * @param dirPath - The absolute path to the directory
 */
export const ensureDirectory = (dirPath: string): void => {
  mkdirSync(dirPath, { recursive: true });
};

/**
 * Writes content to a file, creating parent directories if needed.
 * @param filePath - The absolute path to the file
 * @param content - The content to write
 */
export const writeFile = (filePath: string, content: string): void => {
  writeFileSync(filePath, content, 'utf-8');
};

/**
 * Writes a JSON file with proper formatting.
 * @param filePath - The absolute path to the file
 * @param data - The data to serialize as JSON
 */
export const writeJsonFile = (filePath: string, data: unknown): void => {
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

/**
 * Removes old generated files that are no longer needed.
 * @param directory - The directory to clean
 * @param currentFiles - Set of files that should be kept
 * @param prefix - File name prefix to filter by
 * @param suffix - File name suffix to filter by
 */
export const cleanupOldFiles = (
  directory: string,
  currentFiles: Set<string>,
  prefix: string,
  suffix: string,
): void => {
  if (!existsSync(directory)) {
    return;
  }

  const existing = readdirSync(directory).filter(
    (name) => name.endsWith(suffix) && name.startsWith(prefix),
  );

  for (const file of existing) {
    if (!currentFiles.has(file)) {
      unlinkSync(join(directory, file));
    }
  }
};
