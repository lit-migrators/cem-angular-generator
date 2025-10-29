import { readFileSync } from 'node:fs';
import { ComponentEvent, ComponentMember, ComponentMeta } from '../types/component.js';
import { toPascalCase, toIdentifier } from '../utils/string.js';

/**
 * Parses a Custom Elements Manifest file and extracts component metadata.
 *
 * @param manifestPath - The absolute path to the custom-elements.json file
 * @param wrapperSelectorPrefix - The prefix to add to component selectors (e.g., 'wc-')
 * @returns An array of component metadata
 */
export const parseManifest = (
  manifestPath: string,
  wrapperSelectorPrefix: string,
): ComponentMeta[] => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const modules = Array.isArray(manifest?.modules) ? manifest.modules : [];

  const components: ComponentMeta[] = [];

  for (const mod of modules) {
    if (!Array.isArray(mod?.declarations)) {
      continue;
    }

    for (const decl of mod.declarations) {
      if (!decl || decl.kind !== 'class' || !decl.tagName) {
        continue;
      }

      const component = parseComponentDeclaration(decl, mod.path, wrapperSelectorPrefix);
      components.push(component);
    }
  }

  return components.sort((a, b) => a.tagName.localeCompare(b.tagName));
};

/**
 * Parses a single component declaration from the manifest.
 */
const parseComponentDeclaration = (
  decl: any,
  modulePath: string | undefined,
  wrapperSelectorPrefix: string,
): ComponentMeta => {
  const tagName = decl.tagName as string;
  const selector = `${wrapperSelectorPrefix}${tagName}`;
  const className = `Wc${toPascalCase(tagName)}Component`;
  const fileName = `${selector}.component.ts`;

  const members = parseComponentMembers(decl.members);
  const events = parseComponentEvents(decl.events);

  return {
    tagName,
    selector,
    className,
    fileName,
    sourceModule: modulePath,
    description: decl.description as string | undefined,
    members,
    events,
  };
};

/**
 * Parses component members (properties and fields) from the manifest.
 */
const parseComponentMembers = (members: any): ComponentMember[] => {
  if (!Array.isArray(members)) {
    return [];
  }

  return members
    .filter((member: any) => member && ['field', 'property'].includes(member.kind ?? ''))
    .map((member: any) => ({
      name: member.name as string,
      type: (member.type?.text as string) || 'any',
      optional: (member.optional as boolean) ?? true,
      description: member.description as string | undefined,
    }));
};

/**
 * Parses component events from the manifest.
 */
const parseComponentEvents = (events: any): ComponentEvent[] => {
  if (!Array.isArray(events)) {
    return [];
  }

  return events.map((event: any) => ({
    eventName: event.name as string,
    outputName: toIdentifier(event.name as string),
    type: (event.type?.text as string) || 'CustomEvent<any>',
    description: event.description as string | undefined,
  }));
};
