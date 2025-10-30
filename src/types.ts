import { SpawnSyncOptions } from "node:child_process";

/**
 * Options for running the Custom Elements Manifest (CEM) analyzer.
 */
export interface RunCemAnalyzeOptions {
  /** Working directory for the analyzer */
  cwd?: string;
  /** Output directory for the generated manifest */
  outDir?: string;
  /** Path to the CEM config file */
  configPath?: string;
  /** Name/path of the analyzer executable */
  analyzerExecutable?: string;
  /** Skip analysis if true */
  skip?: boolean;
  /** Additional spawn options for the child process */
  spawnOptions?: SpawnSyncOptions;
}

/**
 * Options for generating Angular wrapper components.
 */
export interface GenerateAngularWrappersOptions {
  /** Path to the custom-elements.json manifest */
  manifestPath: string;
  /** Root directory where wrappers will be generated */
  wrappersRoot?: string;
  /** Root directory of the component library source */
  componentsRoot?: string;
  /** NPM package name for the Angular wrappers */
  angularPackageName?: string;
  /** Import path for the component library */
  componentLibraryImport?: string;
  /** Version of the component library */
  componentLibraryVersion?: string;
  /** Import path for the loader function */
  loaderImportPath?: string;
  /** Prefix for wrapper component selectors */
  wrapperSelectorPrefix?: string;
  /** Path to link node_modules from */
  linkNodeModulesFrom?: string;
  /** Angular peer dependency version */
  angularPeerDependency?: string;
  /** TypeScript lib (tslib) version */
  tslibVersion?: string;
  /** Generate augmented Angular output structure */
  augmentAngularOutput?: boolean;
  /** Generate standalone components (default: true) */
  standalone?: boolean;
}

/**
 * Result of generating Angular wrappers.
 */
export interface GenerateAngularWrappersResult {
  /** Parsed component metadata */
  components: ComponentMeta[];
  /** Root directory where wrappers were generated */
  wrappersRoot: string;
  /** Path to the manifest that was used */
  manifestPath: string;
}

/**
 * Combined options for running CEM analysis and generating wrappers.
 */
export interface GenerateAngularWrappersFromCemOptions
  extends RunCemAnalyzeOptions,
    Omit<GenerateAngularWrappersOptions, "manifestPath"> {}

/**
 * Represents a component property or field.
 */
export interface ComponentMember {
  /** Property name */
  name: string;
  /** TypeScript type annotation */
  type: string;
  /** Whether the property is optional */
  optional: boolean;
  /** JSDoc description */
  description?: string;
}

/**
 * Represents a component custom event.
 */
export interface ComponentEvent {
  /** Original event name (e.g., "row-click") */
  eventName: string;
  /** Angular Output property name (e.g., "rowClick") */
  outputName: string;
  /** TypeScript type for the event */
  type: string;
  /** JSDoc description */
  description?: string;
}

/**
 * Metadata for a single component extracted from the manifest.
 */
export interface ComponentMeta {
  /** Custom element tag name */
  tagName: string;
  /** Angular component selector */
  selector: string;
  /** Angular component class name */
  className: string;
  /** Generated file name */
  fileName: string;
  /** Source module path from manifest */
  sourceModule?: string;
  /** Component description */
  description?: string;
  /** Component properties/fields */
  members: ComponentMember[];
  /** Component events */
  events: ComponentEvent[];
}

/**
 * Internal options for augmented Angular output generation.
 */
export interface AugmentAngularOutputOptions {
  components: ComponentMeta[];
  componentsRoot: string;
  wrappersRoot: string;
  manifestPath: string;
  componentLibraryImport: string;
  componentLibraryVersion: string;
  loaderImportPath: string;
  linkNodeModulesFrom?: string;
  angularPackageName: string;
  angularPeerDependency: string;
  tslibVersion: string;
  standalone: boolean;
}
