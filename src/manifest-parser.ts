import { readFileSync } from "node:fs";
import type { ComponentMeta, ComponentMember, ComponentEvent } from "./types";
import { toPascalCase, toIdentifier } from "./code-generation";

/**
 * Type guard to check if a manifest member represents a public field/property.
 * Filters out private, protected, and non-field members.
 *
 * @param member - Member from the manifest
 * @returns True if this is a public field that should be exposed
 */
export const isPublicFieldLikeMember = (
  member: any
): member is {
  name: string;
  kind?: string;
  type?: { text?: string };
  optional?: boolean;
  description?: string;
  privacy?: string;
  modifiers?: string[];
} => {
  if (!member || typeof member !== "object") {
    return false;
  }

  // Only include field and property kinds
  if (!["field", "property"].includes((member.kind as string) ?? "")) {
    return false;
  }

  const name = member.name as string | undefined;
  // Exclude private fields (starting with #)
  if (!name || name.startsWith("#")) {
    return false;
  }

  // Exclude explicitly private or protected members
  const privacy = member.privacy as string | undefined;
  if (privacy && privacy !== "public") {
    return false;
  }

  // Check for private/protected modifiers
  const modifiers = Array.isArray(member.modifiers)
    ? (member.modifiers as string[])
    : [];
  if (modifiers.includes("private") || modifiers.includes("protected")) {
    return false;
  }

  return true;
};

/**
 * Parses a Custom Elements Manifest and extracts component metadata.
 *
 * @param manifestPath - Path to the custom-elements.json file
 * @param wrapperSelectorPrefix - Prefix for wrapper selectors (e.g., "wc-")
 * @returns Array of parsed component metadata
 */
export const parseManifest = (
  manifestPath: string,
  wrapperSelectorPrefix: string = "wc-"
): ComponentMeta[] => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const modules = Array.isArray(manifest?.modules) ? manifest.modules : [];

  const components: ComponentMeta[] = [];

  for (const mod of modules) {
    if (!Array.isArray(mod?.declarations)) continue;

    for (const decl of mod.declarations) {
      // Only process class declarations with a tagName
      if (!decl || decl.kind !== "class" || !decl.tagName) continue;

      const tagName = decl.tagName as string;
      const selector = `${wrapperSelectorPrefix}${tagName}`;
      const className = `Wc${toPascalCase(tagName)}Component`;
      const fileName = `${selector}.component.ts`;

      // Extract public members
      const manifestMembers = Array.isArray(decl.members)
        ? (decl.members as unknown[]).filter(isPublicFieldLikeMember)
        : [];

      const members: ComponentMember[] = manifestMembers.map((member) => ({
        name: member.name,
        type: (member.type?.text as string) || "any",
        optional: (member.optional as boolean) ?? true,
        description: member.description as string | undefined,
      }));

      // Extract events
      const events: ComponentEvent[] = Array.isArray(decl.events)
        ? decl.events.map((event: any) => ({
            eventName: event.name as string,
            outputName: toIdentifier(event.name as string),
            type: (event.type?.text as string) || "CustomEvent<any>",
            description: event.description as string | undefined,
          }))
        : [];

      components.push({
        tagName,
        selector,
        className,
        fileName,
        sourceModule: mod.path as string | undefined,
        description: decl.description as string | undefined,
        members,
        events,
      });
    }
  }

  // Sort components by tag name for consistent output
  components.sort((a, b) => a.tagName.localeCompare(b.tagName));

  return components;
};
