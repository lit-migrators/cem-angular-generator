/**
 * Converts a kebab-case or space-separated string to PascalCase.
 * @example toPascalCase('my-component') // 'MyComponent'
 * @example toPascalCase('hello world') // 'HelloWorld'
 */
export const toPascalCase = (value: string): string =>
  value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join('');

/**
 * Converts a string to a valid JavaScript identifier.
 * Removes special characters and ensures the identifier starts with a letter or underscore.
 * @example toIdentifier('my-event') // 'myEvent'
 * @example toIdentifier('123-start') // '_123Start'
 */
export const toIdentifier = (value: string): string => {
  const camel = value
    .replace(/-([a-zA-Z0-9])/g, (_, char) => char.toUpperCase())
    .replace(/[^a-zA-Z0-9_]/g, '');

  if (!camel) {
    return 'event';
  }

  if (!/^[A-Za-z_]/.test(camel)) {
    return `_${camel}`;
  }

  return camel;
};
