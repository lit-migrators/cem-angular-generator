/**
 * CEM Angular Generator
 *
 * A library for generating Angular wrapper components from Custom Elements Manifest (CEM) files.
 * This library helps bridge web components (built with Stencil, Lit, etc.) with Angular applications
 * by creating idiomatic Angular components with proper @Input/@Output bindings.
 *
 * @packageDocumentation
 */

// Core functionality
export { runCemAnalyze } from './analyzers/cem-analyzer.js';
export {
  generateAngularWrappers,
  generateAngularWrappersFromCem,
} from './generators/angular-wrapper-generator.js';

// Public types
export type {
  RunCemAnalyzeOptions,
  GenerateAngularWrappersOptions,
  GenerateAngularWrappersFromCemOptions,
} from './types/options.js';
export type {
  ComponentMember,
  ComponentEvent,
  ComponentMeta,
  GenerateAngularWrappersResult,
} from './types/component.js';
