# angular-doctor

Let coding agents diagnose and fix your Angular code.

One command scans your codebase for performance, correctness, architecture, and dead code issues, then outputs a **0–100 score** with actionable diagnostics.

## How it works

Angular Doctor detects your Angular version and framework (Angular CLI, Nx, Ionic, AnalogJS, Angular SSR), then runs two analysis passes **in parallel**:

1. **Lint**: Checks Angular-specific rules across components, directives, pipes, performance, architecture, and TypeScript quality.
2. **Dead code**: Detects unused files, exports, and types using [knip](https://knip.dev).

Diagnostics are scored by severity to produce a **0–100 health score** (75+ Great, 50–74 Needs work, <50 Critical).

## Install

Run this at your Angular project root:

```bash
npx -y angular-doctor@latest .
```

Use `--verbose` to see affected files and line numbers:

```bash
npx -y angular-doctor@latest . --verbose
```

## Options

```
Usage: angular-doctor [directory] [options]

Options:
  -v, --version     display the version number
  --no-lint         skip linting
  --no-dead-code    skip dead code detection
  --verbose         show file details per rule
  --score           output only the score
  -y, --yes         skip prompts
  --diff [base]     scan only files changed vs base branch
  -h, --help        display help for command
```

## Configuration

Create an `angular-doctor.config.json` in your project root to customize behavior:

```json
{
  "ignore": {
    "rules": ["@angular-eslint/prefer-standalone"],
    "files": ["src/generated/**"]
  }
}
```

You can also use the `"angularDoctor"` key in your `package.json`:

```json
{
  "angularDoctor": {
    "ignore": {
      "rules": ["@angular-eslint/prefer-standalone"]
    }
  }
}
```

### Config options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `ignore.rules` | `string[]` | `[]` | Rules to suppress using the `plugin/rule` format |
| `ignore.files` | `string[]` | `[]` | File paths to exclude, supports glob patterns |
| `lint` | `boolean` | `true` | Enable/disable lint checks |
| `deadCode` | `boolean` | `true` | Enable/disable dead code detection |
| `verbose` | `boolean` | `false` | Show file details per rule |
| `diff` | `boolean \| string` | — | Scan only changed files |

## Node.js API

```typescript
import { diagnose } from "angular-doctor/api";

const result = await diagnose("./path/to/your/angular-project");

console.log(result.score);       // { score: 82, label: "Great" }
console.log(result.diagnostics); // Array of Diagnostic objects
console.log(result.project);     // Detected framework, Angular version, etc.
```

Each diagnostic has the following shape:

```typescript
interface Diagnostic {
  filePath: string;
  plugin: string;
  rule: string;
  severity: "error" | "warning";
  message: string;
  help: string;
  line: number;
  column: number;
  category: string;
}
```

## Angular-specific rules

Angular Doctor checks the following categories of issues:

### Components
- Missing `Component` / `Directive` class suffixes
- Empty lifecycle methods
- Missing lifecycle interfaces
- Pipe not implementing `PipeTransform`

### Performance
- Missing `OnPush` change detection strategy
- Outputs shadowing native DOM events

### Architecture
- Conflicting lifecycle hooks (`DoCheck` + `OnChanges`)
- Use of `forwardRef`
- Renamed inputs/outputs
- Inline `inputs`/`outputs` metadata properties
- Non-standalone components (Angular 17+)

### TypeScript
- Explicit `any` usage

### Dead Code
- Unused files
- Unused exports and types

## Inspiration

This project is inspired by [react-doctor](https://github.com/millionco/react-doctor) — an equivalent tool for React codebases.

## License

MIT
