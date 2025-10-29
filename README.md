
# @lit-migrators/cem-angular-generator

Generate Angular wrapper libraries from Custom Elements Manifest output.

## What this project does

This package provides small utility functions to (1) run the Custom Elements Manifest analyzer (cem) and (2) generate Angular wrapper libraries from the resulting `custom-elements.json` manifest.

The primary exported utilities are:

- `runCemAnalyze(options?)` — runs `npx cem analyze` (or falls back to `pnpm exec cem analyze`) and returns the path to the generated `custom-elements.json` manifest.
- `generateAngularWrappers(options)` — reads a Custom Elements Manifest and scaffolds an Angular wrapper package (package.json, tsconfig.json, and per-component wrapper files) that exposes web components as Angular components.

This tooling is intended to help migrate or consume web components (Stencil/Lit) inside Angular apps by creating thin Angular bindings.

## Quick install / build

This repository contains the library source under `cem-angular-generator` and uses TypeScript. To build the library (from project root or inside the package folder):

```bash
# from the package folder
cd cem-angular-generator
pnpm install   # or npm install / pnpm install in the workspace
pnpm run build
```

The `build` script runs `tsc -p tsconfig.json` and outputs to `dist` per the package.json.

## Usage (programmatic)

You can consume the library from Node or a build script. Example (TypeScript):

```ts
import { runCemAnalyze, generateAngularWrappers } from '@lit-migrators/cem-angular-generator';

// 1) run analyzer (optional if you already have custom-elements.json)
const manifestPath = runCemAnalyze({ cwd: process.cwd(), outDir: 'dist' });

// 2) generate wrappers
if (manifestPath) {
	generateAngularWrappers({
		manifestPath,
		wrappersRoot: './angular-wrappers',
		angularPackageName: '@my-scope/angular-wrappers',
		componentLibraryImport: 'my-web-components',
		componentLibraryVersion: '0.0.0',
	});
}
```

API contract (summary):

- runCemAnalyze(options?: RunCemAnalyzeOptions) => string | undefined
	- Inputs: cwd, outDir, configPath, analyzerExecutable, skip, spawnOptions
	- Output: absolute path to `custom-elements.json` or `undefined` when skipped
	- Error modes: throws if analyzer fails or manifest not generated

- generateAngularWrappers(options: GenerateAngularWrappersOptions) => GenerateAngularWrappersResult
	- Inputs: manifestPath (required), optional wrappersRoot, componentLibraryImport, versions, linkNodeModulesFrom, etc.
	- Output: object with component metadata, wrappersRoot and manifestPath
	- Error modes: throws if manifestPath is missing or manifest invalid

Edge cases to consider

- If `cem` is not installed globally, the code will attempt `pnpm exec cem analyze` as a fallback; ensure you have `cem` available (installed or in workspace).
- The generator writes files to disk. If wrappers already exist, it will create missing package.json/tsconfig.json and symlink node_modules when requested.
- Generated TypeScript types may reference non-built types from the component library — adjust imports or add type packages as needed.

## Example workflow

1. Build or generate the `custom-elements.json` for your web components (via Stencil/Lit `cem`):

	 - Either run `runCemAnalyze()` from a script
	 - Or run `npx cem analyze --outdir dist --config custom-elements-manifest.config.mjs` manually

2. Run `generateAngularWrappers({ manifestPath: 'dist/custom-elements.json', wrappersRoot: './angular-wrappers' })`.

3. Inspect the generated `angular-wrappers` package. Review, test, and publish it as appropriate for your workspace.

## Important disclaimer

This project is generated with AI.

## Contributing

See the `cem-angular-generator` package for the TypeScript sources under `cem-angular-generator/src`.

## License

MIT
