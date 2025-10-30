import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateAngularWrappers } from '../src/index';
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('generateAngularWrappers', () => {
  let testDir: string;
  let manifestPath: string;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    testDir = join(tmpdir(), `cem-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    manifestPath = join(testDir, 'custom-elements.json');
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Simple Component', () => {
    beforeEach(() => {
      const manifest = readFileSync(
        join(__dirname, 'fixtures', 'simple-component.json'),
        'utf-8'
      );
      writeFileSync(manifestPath, manifest);
    });

    it('should generate wrapper for simple component with properties and events', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      const result = generateAngularWrappers({
        manifestPath,
        wrappersRoot,
        componentLibraryImport: 'my-components',
      });

      expect(result.components).toHaveLength(1);
      expect(result.components[0].tagName).toBe('my-button');
      expect(result.components[0].selector).toBe('wc-my-button');
      expect(result.components[0].className).toBe('WcMyButtonComponent');
      expect(result.components[0].members).toHaveLength(2);
      expect(result.components[0].events).toHaveLength(1);
    });

    it('should create wrapper component file', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
        componentLibraryImport: 'my-components',
      });

      const componentFile = join(wrappersRoot, 'src', 'lib', 'wc-my-button.component.ts');
      expect(existsSync(componentFile)).toBe(true);

      const content = readFileSync(componentFile, 'utf-8');
      expect(content).toContain('@Component');
      expect(content).toContain("selector: 'wc-my-button'");
      expect(content).toContain('export class WcMyButtonComponent');
      expect(content).toContain('@Input() label: string;');
      expect(content).toContain('@Input() disabled?: boolean;');
      expect(content).toContain('@Output() buttonClick = new EventEmitter');
    });

    it('should generate package.json', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
        angularPackageName: '@test/angular-wrappers',
        componentLibraryImport: 'my-components',
        componentLibraryVersion: '1.0.0',
      });

      const pkgPath = join(wrappersRoot, 'package.json');
      expect(existsSync(pkgPath)).toBe(true);

      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      expect(pkg.name).toBe('@test/angular-wrappers');
      expect(pkg.peerDependencies['my-components']).toBe('1.0.0');
    });

    it('should generate tsconfig.json', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      const tsconfigPath = join(wrappersRoot, 'tsconfig.json');
      expect(existsSync(tsconfigPath)).toBe(true);

      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
      expect(tsconfig.compilerOptions.declaration).toBe(true);
      expect(tsconfig.compilerOptions.experimentalDecorators).toBe(true);
    });

    it('should generate public-api.ts', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      const publicApiPath = join(wrappersRoot, 'src', 'public-api.ts');
      expect(existsSync(publicApiPath)).toBe(true);

      const content = readFileSync(publicApiPath, 'utf-8');
      expect(content).toContain('export { WcMyButtonComponent }');
      expect(content).toContain('export { registerStencilComponents }');
      expect(content).toContain('export const STENCIL_WRAPPER_COMPONENTS');
    });

    it('should generate register file', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
        loaderImportPath: 'my-components/loader',
      });

      const registerPath = join(wrappersRoot, 'src', 'register-stencil-components.ts');
      expect(existsSync(registerPath)).toBe(true);

      const content = readFileSync(registerPath, 'utf-8');
      expect(content).toContain("import { defineCustomElements } from 'my-components/loader'");
      expect(content).toContain('export const registerStencilComponents');
    });
  });

  describe('Complex Component', () => {
    beforeEach(() => {
      const manifest = readFileSync(
        join(__dirname, 'fixtures', 'complex-component.json'),
        'utf-8'
      );
      writeFileSync(manifestPath, manifest);
    });

    it('should generate wrapper with multiple custom types', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      const result = generateAngularWrappers({
        manifestPath,
        wrappersRoot,
        componentLibraryImport: 'data-lib',
      });

      expect(result.components).toHaveLength(1);
      expect(result.components[0].tagName).toBe('data-grid');
      expect(result.components[0].members.length).toBeGreaterThan(0);
      expect(result.components[0].events).toHaveLength(4);

      const componentFile = join(wrappersRoot, 'src', 'lib', 'wc-data-grid.component.ts');
      const content = readFileSync(componentFile, 'utf-8');

      // Should import custom types
      expect(content).toContain("import type {");
      expect(content).toContain("ColumnDefinition");
      expect(content).toContain("GridData");
      expect(content).toContain("SelectionMode");
      expect(content).toContain("RowClickDetail");

      // Should have all events with kebab-case names
      expect(content).toContain("@Output('row-click')");
      expect(content).toContain("@Output('sort-change')");
      expect(content).toContain("@Output('filter-change')");
      expect(content).toContain("@Output('selection-change')");
    });

    it('should exclude private and protected members', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      const result = generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      const component = result.components[0];

      // Should not include private members
      const memberNames = component.members.map(m => m.name);
      expect(memberNames).not.toContain('#internalState');
      expect(memberNames).not.toContain('_privateHelper');

      // Should include public members
      expect(memberNames).toContain('data');
      expect(memberNames).toContain('columns');
      expect(memberNames).toContain('pageSize');
    });
  });

  describe('No Properties or Events', () => {
    beforeEach(() => {
      const manifest = readFileSync(
        join(__dirname, 'fixtures', 'no-props-or-events.json'),
        'utf-8'
      );
      writeFileSync(manifestPath, manifest);
    });

    it('should generate wrapper with no inputs or outputs', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      const result = generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      expect(result.components).toHaveLength(1);
      expect(result.components[0].members).toHaveLength(0);
      expect(result.components[0].events).toHaveLength(0);

      const componentFile = join(wrappersRoot, 'src', 'lib', 'wc-simple-container.component.ts');
      const content = readFileSync(componentFile, 'utf-8');

      // Should not have @Input or @Output
      expect(content).not.toContain('@Input()');
      expect(content).not.toContain('@Output()');

      // Should not have OnChanges or OnDestroy
      expect(content).not.toContain('implements AfterViewInit, OnChanges');
      expect(content).not.toContain('implements AfterViewInit, OnDestroy');

      // Should only implement AfterViewInit
      expect(content).toContain('implements AfterViewInit');
    });
  });

  describe('Multiple Components', () => {
    beforeEach(() => {
      const manifest = readFileSync(
        join(__dirname, 'fixtures', 'multiple-components.json'),
        'utf-8'
      );
      writeFileSync(manifestPath, manifest);
    });

    it('should generate wrappers for all components', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      const result = generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      expect(result.components).toHaveLength(3);
      expect(result.components[0].tagName).toBe('my-badge');
      expect(result.components[1].tagName).toBe('my-card');
      expect(result.components[2].tagName).toBe('my-tooltip');

      // Check all files exist
      const cardFile = join(wrappersRoot, 'src', 'lib', 'wc-my-card.component.ts');
      const badgeFile = join(wrappersRoot, 'src', 'lib', 'wc-my-badge.component.ts');
      const tooltipFile = join(wrappersRoot, 'src', 'lib', 'wc-my-tooltip.component.ts');

      expect(existsSync(cardFile)).toBe(true);
      expect(existsSync(badgeFile)).toBe(true);
      expect(existsSync(tooltipFile)).toBe(true);
    });

    it('should export all components in public-api', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      const publicApiPath = join(wrappersRoot, 'src', 'public-api.ts');
      const content = readFileSync(publicApiPath, 'utf-8');

      expect(content).toContain('WcMyCardComponent');
      expect(content).toContain('WcMyBadgeComponent');
      expect(content).toContain('WcMyTooltipComponent');
      expect(content).toContain('STENCIL_WRAPPER_COMPONENTS = [');
    });
  });

  describe('Incremental Regeneration', () => {
    it('removes wrapper files for components no longer in the manifest', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');

      const initialManifest = readFileSync(
        join(__dirname, 'fixtures', 'multiple-components.json'),
        'utf-8'
      );
      writeFileSync(manifestPath, initialManifest);

      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      const badgeFile = join(wrappersRoot, 'src', 'lib', 'wc-my-badge.component.ts');
      const cardFile = join(wrappersRoot, 'src', 'lib', 'wc-my-card.component.ts');
      const tooltipFile = join(wrappersRoot, 'src', 'lib', 'wc-my-tooltip.component.ts');

      expect(existsSync(badgeFile)).toBe(true);
      expect(existsSync(cardFile)).toBe(true);
      expect(existsSync(tooltipFile)).toBe(true);

      const updatedManifest = {
        schemaVersion: '1.0.0',
        modules: [
          {
            kind: 'javascript-module',
            path: 'src/components/my-badge.ts',
            declarations: [
              {
                kind: 'class',
                name: 'MyBadge',
                tagName: 'my-badge',
                members: [
                  {
                    kind: 'field',
                    name: 'kind',
                    type: { text: "'info' | 'success' | 'error'" },
                  },
                ],
                events: [],
              },
            ],
          },
        ],
      };
      writeFileSync(manifestPath, JSON.stringify(updatedManifest));

      const result = generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      expect(result.components).toHaveLength(1);
      expect(result.components[0].tagName).toBe('my-badge');

      expect(existsSync(badgeFile)).toBe(true);
      expect(existsSync(cardFile)).toBe(false);
      expect(existsSync(tooltipFile)).toBe(false);
    });
  });

  describe('Built-in Types', () => {
    beforeEach(() => {
      const manifest = readFileSync(
        join(__dirname, 'fixtures', 'builtin-types.json'),
        'utf-8'
      );
      writeFileSync(manifestPath, manifest);
    });

    it('should not import built-in types', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
        componentLibraryImport: 'forms-lib',
      });

      const componentFile = join(wrappersRoot, 'src', 'lib', 'wc-form-field.component.ts');
      const content = readFileSync(componentFile, 'utf-8');

      // Should not have type imports for built-in types
      const typeImportMatch = content.match(/import type \{([^}]+)\} from/);
      if (typeImportMatch) {
        const imports = typeImportMatch[1];
        expect(imports).not.toContain('Array');
        expect(imports).not.toContain('String');
        expect(imports).not.toContain('Number');
        expect(imports).not.toContain('Boolean');
        expect(imports).not.toContain('Function');
        expect(imports).not.toContain('RegExp');
        expect(imports).not.toContain('Record');
        expect(imports).not.toContain('CustomEvent');
        expect(imports).not.toContain('FocusEvent');
        expect(imports).not.toContain('KeyboardEvent');
      }
    });

    it('should handle union types and generic types', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      const result = generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      const component = result.components[0];
      const valueField = component.members.find(m => m.name === 'value');
      expect(valueField?.type).toBe('string | number | boolean');

      const optionsField = component.members.find(m => m.name === 'options');
      expect(optionsField?.type).toBe('Array<string>');
    });
  });

  describe('Protected Members Filtering', () => {
    beforeEach(() => {
      const manifest = readFileSync(
        join(__dirname, 'fixtures', 'protected-members.json'),
        'utf-8'
      );
      writeFileSync(manifestPath, manifest);
    });

    it('should only include public members', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      const result = generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      const component = result.components[0];
      expect(component.members).toHaveLength(3);

      const memberNames = component.members.map(m => m.name);
      expect(memberNames).toContain('publicProp');
      expect(memberNames).toContain('anotherPublic');
      expect(memberNames).toContain('publicProperty');

      expect(memberNames).not.toContain('privateProp');
      expect(memberNames).not.toContain('protectedProp');
      expect(memberNames).not.toContain('#privateField');
      expect(memberNames).not.toContain('privateProperty');
      expect(memberNames).not.toContain('protectedProperty');
    });
  });

  describe('Special Event Names', () => {
    beforeEach(() => {
      const manifest = readFileSync(
        join(__dirname, 'fixtures', 'special-event-names.json'),
        'utf-8'
      );
      writeFileSync(manifestPath, manifest);
    });

    it('should handle various event naming conventions', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      const result = generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      const component = result.components[0];
      expect(component.events).toHaveLength(5);

      const componentFile = join(wrappersRoot, 'src', 'lib', 'wc-event-component.component.ts');
      const content = readFileSync(componentFile, 'utf-8');

      // Kebab case should be aliased
      expect(content).toContain("@Output('item-selected')");
      expect(content).toContain("itemSelected = new EventEmitter");

      // Camel case
      expect(content).toContain("itemDeselected = new EventEmitter");

      // Snake case (underscore is kept as valid identifier character)
      expect(content).toContain("@Output() ITEM_DELETED = new EventEmitter");

      // Dot notation
      expect(content).toContain("@Output('item.updated')");
      expect(content).toContain("itemupdated = new EventEmitter");

      // Invalid identifier starting with number
      expect(content).toContain("@Output('123-invalid')");
      expect(content).toContain("_123Invalid = new EventEmitter");
    });
  });

  describe('Custom Options', () => {
    beforeEach(() => {
      const manifest = readFileSync(
        join(__dirname, 'fixtures', 'simple-component.json'),
        'utf-8'
      );
      writeFileSync(manifestPath, manifest);
    });

    it('should respect custom selector prefix', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      const result = generateAngularWrappers({
        manifestPath,
        wrappersRoot,
        wrapperSelectorPrefix: 'app-',
      });

      expect(result.components[0].selector).toBe('app-my-button');

      const componentFile = join(wrappersRoot, 'src', 'lib', 'app-my-button.component.ts');
      expect(existsSync(componentFile)).toBe(true);

      const content = readFileSync(componentFile, 'utf-8');
      expect(content).toContain("selector: 'app-my-button'");
    });

    it('should generate standalone components by default', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      const componentFile = join(wrappersRoot, 'src', 'lib', 'wc-my-button.component.ts');
      const content = readFileSync(componentFile, 'utf-8');

      expect(content).toContain('standalone: true');
      expect(content).toContain('CUSTOM_ELEMENTS_SCHEMA');
    });

    it('should generate non-standalone components when specified', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
        standalone: false,
      });

      const componentFile = join(wrappersRoot, 'src', 'lib', 'wc-my-button.component.ts');
      const content = readFileSync(componentFile, 'utf-8');

      expect(content).toContain('standalone: false');
      // Note: Current implementation includes CUSTOM_ELEMENTS_SCHEMA regardless of standalone value
      expect(content).toContain('CUSTOM_ELEMENTS_SCHEMA');
    });
  });

  describe('Node Modules Linking', () => {
    it('creates symlinks for shared dependencies and component library', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      const componentsRoot = join(testDir, 'components-root');
      const sourceRoot = join(testDir, 'source-root');
      const sourceNodeModules = join(sourceRoot, 'node_modules');

      mkdirSync(componentsRoot, { recursive: true });
      writeFileSync(join(componentsRoot, 'README.md'), 'components');

      const rxjsSource = join(sourceNodeModules, 'rxjs');
      mkdirSync(rxjsSource, { recursive: true });
      writeFileSync(join(rxjsSource, 'index.js'), 'module.exports = {};');

      mkdirSync(sourceNodeModules, { recursive: true });

      const manifest = readFileSync(
        join(__dirname, 'fixtures', 'simple-component.json'),
        'utf-8'
      );
      writeFileSync(manifestPath, manifest);

      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
        componentsRoot,
        componentLibraryImport: 'my-components',
        linkNodeModulesFrom: sourceRoot,
        augmentAngularOutput: true,
      });

      const libraryLink = join(wrappersRoot, 'node_modules', 'my-components');
      expect(existsSync(libraryLink)).toBe(true);
      expect(lstatSync(libraryLink).isSymbolicLink()).toBe(true);
      expect(readlinkSync(libraryLink)).toBe(componentsRoot);

      const rxjsLink = join(wrappersRoot, 'node_modules', 'rxjs');
      expect(existsSync(rxjsLink)).toBe(true);
      expect(lstatSync(rxjsLink).isSymbolicLink()).toBe(true);
      expect(readlinkSync(rxjsLink)).toBe(join(sourceNodeModules, 'rxjs'));
    });
  });

  describe('Error Handling', () => {
    it('should throw error if manifestPath is missing', () => {
      expect(() => {
        generateAngularWrappers({
          manifestPath: '',
        });
      }).toThrow('generateAngularWrappers requires a manifestPath');
    });

    it('should handle empty manifest', () => {
      writeFileSync(manifestPath, JSON.stringify({ modules: [] }));

      const wrappersRoot = join(testDir, 'angular-wrappers');
      const result = generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      expect(result.components).toHaveLength(0);
      expect(existsSync(join(wrappersRoot, 'package.json'))).toBe(true);
    });

    it('should handle manifest with no declarations', () => {
      const manifest = {
        modules: [
          {
            kind: 'javascript-module',
            path: 'src/test.ts',
            declarations: [],
          },
        ],
      };
      writeFileSync(manifestPath, JSON.stringify(manifest));

      const wrappersRoot = join(testDir, 'angular-wrappers');
      const result = generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      expect(result.components).toHaveLength(0);
    });
  });

  describe('Component Descriptions', () => {
    beforeEach(() => {
      const manifest = readFileSync(
        join(__dirname, 'fixtures', 'simple-component.json'),
        'utf-8'
      );
      writeFileSync(manifestPath, manifest);
    });

    it('should include component description in header comment', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      const componentFile = join(wrappersRoot, 'src', 'lib', 'wc-my-button.component.ts');
      const content = readFileSync(componentFile, 'utf-8');

      expect(content).toContain('/**');
      expect(content).toContain('A simple button component');
      expect(content).toContain('Source: src/components/my-button.ts');
      expect(content).toContain('DO NOT EDIT - generated by the Custom Elements → Angular generator');
    });

    it('should include property descriptions', () => {
      const wrappersRoot = join(testDir, 'angular-wrappers');
      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      const componentFile = join(wrappersRoot, 'src', 'lib', 'wc-my-button.component.ts');
      const content = readFileSync(componentFile, 'utf-8');

      expect(content).toContain('/** The button label */');
      expect(content).toContain('/** Whether the button is disabled */');
      expect(content).toContain('/** Fired when the button is clicked */');
    });

    it('should preserve multi-line descriptions with spacing', () => {
      const manifest = readFileSync(
        join(__dirname, 'fixtures', 'multiline-description.json'),
        'utf-8'
      );
      writeFileSync(manifestPath, manifest);

      const wrappersRoot = join(testDir, 'angular-wrappers');
      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
        componentLibraryImport: 'panel-lib',
      });

      const componentFile = join(wrappersRoot, 'src', 'lib', 'wc-my-panel.component.ts');
      const content = readFileSync(componentFile, 'utf-8');

      expect(content).toContain('Primary panel component.');
      expect(content).toContain('Displays summarized information across multiple sections.');
      expect(content).toContain('\n *\n * Displays summarized information across multiple sections.');
      expect(content).toContain("import type { PanelSection, SectionChangeDetail } from 'panel-lib';");
      expect(content).toContain('/** Panel heading displayed at the top. */');
      expect(content).toContain('/** Emitted when the active section changes. */');
    });

    it('should fall back to default header when description is missing', () => {
      const manifest = {
        schemaVersion: '1.0.0',
        modules: [
          {
            kind: 'javascript-module',
            declarations: [
              {
                kind: 'class',
                name: 'PlainCard',
                tagName: 'plain-card',
                members: [],
                events: [],
              },
            ],
          },
        ],
      };
      writeFileSync(manifestPath, JSON.stringify(manifest));

      const wrappersRoot = join(testDir, 'angular-wrappers');
      generateAngularWrappers({
        manifestPath,
        wrappersRoot,
      });

      const componentFile = join(wrappersRoot, 'src', 'lib', 'wc-plain-card.component.ts');
      const content = readFileSync(componentFile, 'utf-8');

      expect(content).toContain('Auto-generated Angular wrapper for <plain-card>.');
      expect(content).toContain('Source: n/a');
    });
  });
});
