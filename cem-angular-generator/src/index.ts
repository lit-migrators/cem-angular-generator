import { spawnSync, SpawnSyncOptions } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface RunCemAnalyzeOptions {
  cwd?: string;
  outDir?: string;
  configPath?: string;
  analyzerExecutable?: string;
  skip?: boolean;
  spawnOptions?: SpawnSyncOptions;
}

export const runCemAnalyze = (options: RunCemAnalyzeOptions = {}): string | undefined => {
  const {
    cwd = process.cwd(),
    outDir = 'dist',
    configPath = 'custom-elements-manifest.config.mjs',
    analyzerExecutable = 'cem',
    skip = process.env.STENCIL_SKIP_CEM === 'true',
    spawnOptions,
  } = options;

  if (skip) {
    return undefined;
  }

  const manifestPath = resolve(cwd, outDir, 'custom-elements.json');
  const args = [analyzerExecutable, 'analyze', '--outdir', outDir, '--config', configPath];
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  const result = spawnSync(npxCommand, args, {
    cwd,
    stdio: 'inherit',
    ...spawnOptions,
  });

  const attemptFallback = () => {
    const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const fallback = spawnSync(pnpmCommand, ['exec', ...args], {
      cwd,
      stdio: 'inherit',
      ...spawnOptions,
    });

    if (fallback.error) {
      throw fallback.error;
    }

    if (fallback.status !== 0) {
      throw new Error('Failed to generate custom-elements.json via `pnpm exec cem analyze`.');
    }
  };

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
      attemptFallback();
    } else {
      throw result.error;
    }
  } else if (result.status !== 0) {
    attemptFallback();
  }

  if (!existsSync(manifestPath)) {
    throw new Error(`Expected Custom Elements Manifest at ${manifestPath}, but it does not exist.`);
  }

  return manifestPath;
};

export interface GenerateAngularWrappersOptions {
  manifestPath: string;
  wrappersRoot?: string;
  componentsRoot?: string;
  angularPackageName?: string;
  componentLibraryImport?: string;
  componentLibraryVersion?: string;
  loaderImportPath?: string;
  wrapperSelectorPrefix?: string;
  linkNodeModulesFrom?: string;
  angularPeerDependency?: string;
  tslibVersion?: string;
}

interface ComponentMember {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

interface ComponentEvent {
  eventName: string;
  outputName: string;
  type: string;
  description?: string;
}

interface ComponentMeta {
  tagName: string;
  selector: string;
  className: string;
  fileName: string;
  sourceModule?: string;
  description?: string;
  members: ComponentMember[];
  events: ComponentEvent[];
}

const BUILT_IN_TYPE_TOKENS = new Set([
  'Array',
  'Boolean',
  'CustomEvent',
  'Date',
  'Event',
  'HTMLElement',
  'KeyboardEvent',
  'Map',
  'MouseEvent',
  'Node',
  'Number',
  'Object',
  'Promise',
  'ReadonlyArray',
  'Record',
  'Set',
  'String',
  'TouchEvent',
  'WheelEvent',
  'Window',
]);

export interface GenerateAngularWrappersResult {
  components: ComponentMeta[];
  wrappersRoot: string;
  manifestPath: string;
}

const toPascalCase = (value: string) =>
  value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join('');

const toIdentifier = (value: string) => {
  const camel = value.replace(/-([a-zA-Z0-9])/g, (_, char) => char.toUpperCase()).replace(/[^a-zA-Z0-9_]/g, '');
  if (!camel) {
    return 'event';
  }
  if (!/^[A-Za-z_]/.test(camel)) {
    return `_${camel}`;
  }
  return camel;
};

const ensureSymlink = (targetPath: string, linkPath: string) => {
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

export const generateAngularWrappers = (
  options: GenerateAngularWrappersOptions,
): GenerateAngularWrappersResult => {
  const {
    manifestPath,
    angularPackageName = '@experiment/angular-wrappers',
    componentLibraryImport = 'web-components',
    componentLibraryVersion = 'workspace:*',
    loaderImportPath = 'web-components/loader',
    wrapperSelectorPrefix = 'wc-',
    linkNodeModulesFrom,
    angularPeerDependency = '^20.0.0',
    tslibVersion = '^2.3.0',
  } = options;

  if (!manifestPath) {
    throw new Error('generateAngularWrappers requires a manifestPath.');
  }

  const componentsRoot =
    options.componentsRoot ?? resolve(dirname(manifestPath), '..');
  const wrappersRoot =
    options.wrappersRoot ?? resolve(componentsRoot, '../angular-wrappers');

  const wrappersSrcRoot = join(wrappersRoot, 'src');
  const wrappersLibDir = join(wrappersSrcRoot, 'lib');
  mkdirSync(wrappersLibDir, { recursive: true });

  const packageJsonPath = join(wrappersRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    const pkg = {
      name: angularPackageName,
      version: '0.0.1',
      private: true,
      sideEffects: false,
      description:
        'Auto-generated Angular bindings for the Stencil + Lit web components.',
      peerDependencies: {
        '@angular/core': angularPeerDependency,
        [componentLibraryImport]: componentLibraryVersion,
      },
      dependencies: {
        tslib: tslibVersion,
      },
    };
    writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
  }

  const tsconfigPath = join(wrappersRoot, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
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
    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  }

  if (linkNodeModulesFrom) {
    const nodeModulesRoot = resolve(linkNodeModulesFrom, 'node_modules');
    if (existsSync(nodeModulesRoot)) {
      const angularTarget = resolve(nodeModulesRoot, '@angular');
      if (existsSync(angularTarget)) {
        ensureSymlink(angularTarget, resolve(wrappersRoot, 'node_modules/@angular'));
      }
      const tslibTarget = resolve(nodeModulesRoot, 'tslib');
      if (existsSync(tslibTarget)) {
        ensureSymlink(tslibTarget, resolve(wrappersRoot, 'node_modules/tslib'));
      }
    }
    if (existsSync(componentsRoot)) {
      ensureSymlink(componentsRoot, resolve(wrappersRoot, `node_modules/${componentLibraryImport}`));
    }
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const modules = Array.isArray(manifest?.modules) ? manifest.modules : [];

  const components: ComponentMeta[] = [];

  for (const mod of modules) {
    if (!Array.isArray(mod?.declarations)) continue;
    for (const decl of mod.declarations) {
      if (!decl || decl.kind !== 'class' || !decl.tagName) continue;
      const tagName = decl.tagName as string;
      const selector = `${wrapperSelectorPrefix}${tagName}`;
      const className = `Wc${toPascalCase(tagName)}Component`;
      const fileName = `${selector}.component.ts`;
      const members: ComponentMember[] = Array.isArray(decl.members)
        ? decl.members
            .filter((member: any) => member && ['field', 'property'].includes(member.kind ?? ''))
            .map((member: any) => ({
              name: member.name as string,
              type: (member.type?.text as string) || 'any',
              optional: (member.optional as boolean) ?? true,
              description: member.description as string | undefined,
            }))
        : [];

      const events: ComponentEvent[] = Array.isArray(decl.events)
        ? decl.events.map((event: any) => ({
            eventName: event.name as string,
            outputName: toIdentifier(event.name as string),
            type: (event.type?.text as string) || 'CustomEvent<any>',
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

  components.sort((a, b) => a.tagName.localeCompare(b.tagName));

  const generatedFiles = new Set<string>();

  for (const component of components) {
    const filePath = join(wrappersLibDir, component.fileName);
    generatedFiles.add(component.fileName);

    const hasInputs = component.members.length > 0;
    const hasEvents = component.events.length > 0;

    const angularImports = new Set<string>([
      'AfterViewInit',
      'ChangeDetectionStrategy',
      'Component',
      'CUSTOM_ELEMENTS_SCHEMA',
      'ElementRef',
      'ViewChild',
    ]);

    if (hasInputs) {
      angularImports.add('Input');
      angularImports.add('OnChanges');
      angularImports.add('SimpleChanges');
    }

    if (hasEvents) {
      angularImports.add('EventEmitter');
      angularImports.add('NgZone');
      angularImports.add('OnDestroy');
      angularImports.add('Output');
    }

    const lifecycleInterfaces = ['AfterViewInit'];
    if (hasInputs) {
      lifecycleInterfaces.push('OnChanges');
    }
    if (hasEvents) {
      lifecycleInterfaces.push('OnDestroy');
    }

    const inputLines = component.members.map((member) => {
      const decorator = `  @Input() ${member.name}${member.optional ? '?:' : ':'} ${member.type};`;
      if (member.description) {
        return `  /** ${member.description} */\n${decorator}`;
      }
      return decorator;
    });

    const eventLines = component.events.map((event) => {
      const alias = event.eventName !== event.outputName ? `('${event.eventName}') ` : '() ';
      const decorator = `  @Output${alias}${event.outputName} = new EventEmitter<${event.type}>();`;
      if (event.description) {
        return `  /** ${event.description} */\n${decorator}`;
      }
      return decorator;
    });

    const assignmentLines = component.members.map(
      (member) => `    (element as any).${member.name} = this.${member.name};`,
    );

    const eventBindingLines = component.events.map(
      (event) =>
        `    this.addEventListener('${event.eventName}', (event) => this.${event.outputName}.emit(event as ${event.type}));`,
    );

    const typeTokens = new Set<string>();
    const collectTypeTokens = (typeText: string) => {
      const matches = typeText.match(/\b[A-Z][A-Za-z0-9_]+\b/g) ?? [];
      matches.forEach((token) => {
        if (!BUILT_IN_TYPE_TOKENS.has(token)) {
          typeTokens.add(token);
        }
      });
    };

    component.members.forEach((member) => collectTypeTokens(member.type));
    component.events.forEach((event) => collectTypeTokens(event.type));

    const typeImportLine =
      typeTokens.size > 0
        ? `import type { ${Array.from(typeTokens).sort().join(', ')} } from '${componentLibraryImport}';\n`
        : '';

    const content = `/**
 * Auto-generated Angular wrapper for <${component.tagName}>.
 * Source: ${component.sourceModule ?? 'n/a'}
 * DO NOT EDIT - generated by the Custom Elements → Angular generator.
 */
import { ${Array.from(angularImports).sort().join(', ')} } from '@angular/core';
${typeImportLine ? `\n${typeImportLine}` : ''}

@Component({
  selector: '${component.selector}',
  standalone: true,
  template: \`<${component.tagName} #host><ng-content></ng-content></${component.tagName}>\`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ${component.className} implements ${lifecycleInterfaces.join(', ')} {
  @ViewChild('host', { static: true }) private readonly host!: ElementRef<HTMLElement>;
${inputLines.length ? '\n' + inputLines.join('\n') : ''}
${eventLines.length ? '\n' + eventLines.join('\n') : ''}
  private element?: HTMLElement;
${hasEvents ? '  private teardownFns: Array<() => void> = [];\n' : ''}${
      hasEvents ? '  constructor(private readonly ngZone: NgZone) {}\n' : ''
    }
  ngAfterViewInit(): void {
    this.element = this.host.nativeElement;
${hasEvents ? '    this.setupEventListeners();\n' : ''}${hasInputs ? '    this.syncInputs();\n' : ''}
  }
${hasInputs ? `
  ngOnChanges(): void {
    if (!this.element) {
      return;
    }
    this.syncInputs();
  }
` : ''}${hasEvents ? `
  ngOnDestroy(): void {
    this.teardownFns.forEach((remove) => remove());
    this.teardownFns = [];
  }
` : ''}${hasInputs ? `
  private syncInputs(): void {
    if (!this.element) {
      return;
    }
    const element = this.element;
${assignmentLines.join('\n')}
  }
` : ''}${hasEvents ? `
  private setupEventListeners(): void {
    if (!this.element) {
      return;
    }
${eventBindingLines.join('\n')}
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
` : ''}
}
`;

    writeFileSync(filePath, content);
  }

  const existing = readdirSync(wrappersLibDir)
    .filter((name) => name.endsWith('.component.ts') && name.startsWith(wrapperSelectorPrefix));
  for (const file of existing) {
    if (!generatedFiles.has(file)) {
      unlinkSync(join(wrappersLibDir, file));
    }
  }

  const registerFile = join(wrappersSrcRoot, 'register-stencil-components.ts');
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

  const importLines = components
    .map((component) => `import { ${component.className} } from './lib/${component.fileName.replace('.ts', '')}';`)
    .join('\n');
  const exportLines = components
    .map((component) => `export { ${component.className} } from './lib/${component.fileName.replace('.ts', '')}';`)
    .join('\n');
  const exportList = components.map((component) => `  ${component.className},`).join('\n');

  const publicApiContent = `${importLines}
${exportLines}
export { registerStencilComponents } from './register-stencil-components';

export const STENCIL_WRAPPER_COMPONENTS = [
${exportList}
] as const;
`;
  writeFileSync(join(wrappersSrcRoot, 'public-api.ts'), publicApiContent);

  return {
    components,
    wrappersRoot,
    manifestPath,
  };
};

export interface GenerateAngularWrappersFromCemOptions
  extends RunCemAnalyzeOptions,
    Omit<GenerateAngularWrappersOptions, 'manifestPath'> {}

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
