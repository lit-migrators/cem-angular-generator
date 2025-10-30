import { BUILT_IN_TYPE_TOKENS } from "./constants";
import type { ComponentMeta, ComponentMember, ComponentEvent } from "./types";

/**
 * Converts a kebab-case string to PascalCase.
 * Example: "my-button" -> "MyButton"
 */
export const toPascalCase = (value: string): string =>
  value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");

/**
 * Converts a string to a valid JavaScript identifier.
 * Handles kebab-case, dot notation, and invalid starting characters.
 *
 * @param value - String to convert
 * @returns Valid JavaScript identifier
 */
export const toIdentifier = (value: string): string => {
  const camel = value
    .replace(/-([a-zA-Z0-9])/g, (_, char) => char.toUpperCase())
    .replace(/[^a-zA-Z0-9_]/g, "");

  if (!camel) {
    return "event";
  }

  // Ensure identifier doesn't start with a number
  if (!/^[A-Za-z_]/.test(camel)) {
    return `_${camel}`;
  }

  return camel;
};

/**
 * Collects custom type tokens from component members and events
 * that need to be imported from the component library.
 * Built-in types are filtered out.
 *
 * @param component - Component metadata
 * @returns Set of type tokens that need imports
 */
export const collectTypeTokens = (component: ComponentMeta): Set<string> => {
  const typeTokens = new Set<string>();

  const addTypeTokens = (typeText: string) => {
    // Match capitalized type names (e.g., CustomType, MyInterface)
    const matches = typeText.match(/\b[A-Z][A-Za-z0-9_]+\b/g) ?? [];
    matches.forEach((token) => {
      if (!BUILT_IN_TYPE_TOKENS.has(token)) {
        typeTokens.add(token);
      }
    });
  };

  component.members.forEach((member) => addTypeTokens(member.type));
  component.events.forEach((event) => addTypeTokens(event.type));

  return typeTokens;
};

/**
 * Generates the Angular imports needed for a component wrapper.
 *
 * @param hasInputs - Whether component has input properties
 * @param hasEvents - Whether component has output events
 * @param standalone - Whether to generate standalone component
 * @returns Set of Angular import names
 */
export const getAngularImports = (
  hasInputs: boolean,
  hasEvents: boolean,
  standalone: boolean
): Set<string> => {
  const imports = new Set<string>([
    "AfterViewInit",
    "ChangeDetectionStrategy",
    "Component",
    "CUSTOM_ELEMENTS_SCHEMA",
    "ElementRef",
    "ViewChild",
  ]);

  if (hasInputs) {
    imports.add("Input");
    imports.add("OnChanges");
    imports.add("SimpleChanges");
  }

  if (hasEvents) {
    imports.add("EventEmitter");
    imports.add("NgZone");
    imports.add("OnDestroy");
    imports.add("Output");
  }

  return imports;
};

/**
 * Gets the lifecycle interfaces a component needs to implement.
 *
 * @param hasInputs - Whether component has input properties
 * @param hasEvents - Whether component has output events
 * @returns Array of interface names
 */
export const getLifecycleInterfaces = (
  hasInputs: boolean,
  hasEvents: boolean
): string[] => {
  const interfaces = ["AfterViewInit"];
  if (hasInputs) {
    interfaces.push("OnChanges");
  }
  if (hasEvents) {
    interfaces.push("OnDestroy");
  }
  return interfaces;
};

/**
 * Generates @Input() decorator lines for component properties.
 *
 * @param members - Component members/properties
 * @returns Array of code lines for inputs
 */
export const generateInputLines = (members: ComponentMember[]): string[] => {
  return members.map((member) => {
    const decorator = `  @Input() ${member.name}${
      member.optional ? "?:" : ":"
    } ${member.type};`;

    if (member.description) {
      return `  /** ${member.description} */\n${decorator}`;
    }
    return decorator;
  });
};

/**
 * Generates @Output() decorator lines for component events.
 *
 * @param events - Component events
 * @returns Array of code lines for outputs
 */
export const generateEventLines = (events: ComponentEvent[]): string[] => {
  return events.map((event) => {
    // Add alias if event name differs from output name (e.g., kebab-case vs camelCase)
    const alias =
      event.eventName !== event.outputName ? `('${event.eventName}') ` : "() ";
    const decorator = `  @Output${alias}${event.outputName} = new EventEmitter<${event.type}>();`;

    if (event.description) {
      return `  /** ${event.description} */\n${decorator}`;
    }
    return decorator;
  });
};

/**
 * Generates the header comment for a component file.
 * Includes description, source file, and generation notice.
 *
 * @param component - Component metadata
 * @returns JSDoc comment block
 */
export const buildComponentHeaderComment = (
  component: ComponentMeta
): string => {
  const description =
    component.description && component.description.trim().length > 0
      ? component.description
      : `Auto-generated Angular wrapper for <${component.tagName}>.`;

  // Handle multi-line descriptions
  const descriptionLines = description
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 ? ` * ${trimmed}` : " *";
    })
    .join("\n");

  const sourceLine = ` * Source: ${component.sourceModule ?? "n/a"}`;
  const footerLine =
    " * DO NOT EDIT - generated by the Custom Elements → Angular generator.";

  return `/**\n${descriptionLines}\n${sourceLine}\n${footerLine}\n */`;
};

/**
 * Generates the @Component decorator metadata.
 *
 * @param component - Component metadata
 * @param standalone - Whether to generate standalone component
 * @param hasInputs - Whether component has inputs
 * @returns Component decorator metadata string
 */
export const generateComponentDecoratorMetadata = (
  component: ComponentMeta,
  standalone: boolean,
  hasInputs: boolean
): string => {
  const metadata = [
    `  selector: '${component.selector}',`,
    `  template: \`<${component.tagName} #host><ng-content></ng-content></${component.tagName}>\`,`,
    `  changeDetection: ChangeDetectionStrategy.OnPush,`,
    `  standalone: ${standalone},`,
    `  schemas: [CUSTOM_ELEMENTS_SCHEMA],`,
    // Non-standalone components with inputs need the inputs metadata property
    hasInputs && !standalone
      ? `  // eslint-disable-next-line @angular-eslint/no-inputs-metadata-property\n  inputs: [${component.members
          .map((m) => `'${m.name}'`)
          .join(", ")}],`
      : undefined,
  ];

  return metadata.filter(Boolean).join("\n");
};

/**
 * Generates the complete Angular component wrapper file content.
 *
 * @param component - Component metadata
 * @param componentLibraryImport - Import path for types
 * @param standalone - Whether to generate standalone component
 * @returns Complete TypeScript file content
 */
export const generateComponentFileContent = (
  component: ComponentMeta,
  componentLibraryImport: string,
  standalone: boolean
): string => {
  const hasInputs = component.members.length > 0;
  const hasEvents = component.events.length > 0;

  // Generate imports and metadata
  const angularImports = getAngularImports(hasInputs, hasEvents, standalone);
  const lifecycleInterfaces = getLifecycleInterfaces(hasInputs, hasEvents);
  const inputLines = generateInputLines(component.members);
  const eventLines = generateEventLines(component.events);

  // Generate property assignment lines for syncInputs method
  const assignmentLines = component.members.map(
    (member) => `    (element as any).${member.name} = this.${member.name};`
  );

  // Generate event listener setup lines
  const eventBindingLines = component.events.map(
    (event) =>
      `    this.addEventListener('${event.eventName}', (event) => this.${event.outputName}.emit(event as ${event.type}));`
  );

  // Collect custom types that need to be imported
  const typeTokens = collectTypeTokens(component);
  const typeImportLine =
    typeTokens.size > 0
      ? `import type { ${Array.from(typeTokens)
          .sort()
          .join(", ")} } from '${componentLibraryImport}';\n`
      : "";

  const componentDecoratorMetadata = generateComponentDecoratorMetadata(
    component,
    standalone,
    hasInputs
  );

  const headerComment = buildComponentHeaderComment(component);

  // Build the complete file content
  return `${headerComment}
import { ${Array.from(angularImports).sort().join(", ")} } from '@angular/core';
${typeImportLine ? `\n${typeImportLine}` : ""}

@Component({
${componentDecoratorMetadata}
})
export class ${component.className} implements ${lifecycleInterfaces.join(
    ", "
  )} {
  @ViewChild('host', { static: true }) private readonly host!: ElementRef<HTMLElement>;
${inputLines.length ? "\n" + inputLines.join("\n") : ""}
${eventLines.length ? "\n" + eventLines.join("\n") : ""}
  private element?: HTMLElement;
${hasEvents ? "  private teardownFns: Array<() => void> = [];\n" : ""}${
    hasEvents ? "  constructor(private readonly ngZone: NgZone) {}\n" : ""
  }
  ngAfterViewInit(): void {
    this.element = this.host.nativeElement;
${hasEvents ? "    this.setupEventListeners();\n" : ""}${
    hasInputs ? "    this.syncInputs();\n" : ""
  }
  }
${
  hasInputs
    ? `
  ngOnChanges(): void {
    if (!this.element) {
      return;
    }
    this.syncInputs();
  }
`
    : ""
}${
    hasEvents
      ? `
  ngOnDestroy(): void {
    this.teardownFns.forEach((remove) => remove());
    this.teardownFns = [];
  }
`
      : ""
  }${
    hasInputs
      ? `
  private syncInputs(): void {
    if (!this.element) {
      return;
    }
    const element = this.element;
${assignmentLines.join("\n")}
  }
`
      : ""
  }${
    hasEvents
      ? `
  private setupEventListeners(): void {
    if (!this.element) {
      return;
    }
${eventBindingLines.join("\n")}
  }

  private addEventListener(eventName: string, listener: (event: Event) => void): void {
    if (!this.element) {
      return;
    }
    const element = this.element;
    const handler = (event: Event) => {
      this.ngZone.run(() => listener(event));
    };
    element.addEventListener(eventName, handler as EventListener);
    this.teardownFns.push(() => element.removeEventListener(eventName, handler as EventListener));
  }
`
      : ""
  }
}
`;
};

/**
 * Generates the register web components file content.
 */
export const generateRegisterWebComponentsContent = (
  loaderImportPath: string
): string => {
  return `import { defineCustomElements } from '${loaderImportPath}';

let componentsDefined = false;

export const registerWebComponents = (): void => {
  if (componentsDefined || typeof window === 'undefined') {
    return;
  }

  defineCustomElements(window);
  componentsDefined = true;
};
`;
};

/**
 * Generates the web components module file content (for NgModule-based apps).
 */
export const generateWebComponentsModuleContent = (): string => {
  return `import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';

import { DIRECTIVES } from './directives';
import { registerWebComponents } from './register-web-components';

@NgModule({
  declarations: [...DIRECTIVES],
  exports: [...DIRECTIVES],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class WebComponentsModule {
  constructor() {
    // Automatically register web components when the module is instantiated
    registerWebComponents();
  }
}
`;
};

/**
 * Generates the directives aggregation file content.
 */
export const generateDirectivesContent = (): string => {
  return `import { DIRECTIVES as STENCIL_ONLY_DIRECTIVES } from './index';
import { LIT_DIRECTIVES } from './lit';

export const DIRECTIVES = [
  ...STENCIL_ONLY_DIRECTIVES,
  ...LIT_DIRECTIVES,
] as const;

export { STENCIL_ONLY_DIRECTIVES, LIT_DIRECTIVES };
`;
};

/**
 * Generates the lit index file content with component exports.
 */
export const generateLitIndexContent = (components: ComponentMeta[]): string => {
  if (components.length === 0) {
    return `export const LIT_DIRECTIVES: readonly any[] = [];\n`;
  }

  const importLines = components
    .map(
      (component) =>
        `import { ${component.className} } from './${component.fileName.replace(
          ".ts",
          ""
        )}';`
    )
    .join("\n");

  const reExports = components
    .map(
      (component) =>
        `export { ${component.className} } from './${component.fileName.replace(
          ".ts",
          ""
        )}';`
    )
    .join("\n");

  const arrayEntries = components
    .map((component) => `  ${component.className},`)
    .join("\n");

  return `${importLines}

${reExports}

export const LIT_DIRECTIVES = [
${arrayEntries}
] as const;
`;
};

/**
 * Generates the public API file content for augmented output.
 */
export const generatePublicApiContent = (): string => {
  return `
    export * from './lib/lit';
`;
};
