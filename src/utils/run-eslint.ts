import fs from "node:fs";
import path from "node:path";
import { ESLint, type Linter } from "eslint";
import angularEslintPlugin from "@angular-eslint/eslint-plugin";
import tsEslint from "typescript-eslint";
import type { Diagnostic, PackageJson } from "../types.js";

// Extended rule category mapping (45+ rules)
const RULE_CATEGORY_MAP: Record<string, string> = {
  // Angular component best practices
  "@angular-eslint/component-class-suffix": "Components",
  "@angular-eslint/component-max-inline-declarations": "Performance",
  "@angular-eslint/component-selector": "Components",
  "@angular-eslint/directive-class-suffix": "Components",
  "@angular-eslint/directive-selector": "Components",
  "@angular-eslint/pipe-prefix": "Components",
  "@angular-eslint/use-pipe-transform-interface": "Components",
  "@angular-eslint/no-empty-lifecycle-method": "Components",
  "@angular-eslint/use-lifecycle-interface": "Components",
  "@angular-eslint/consistent-component-styles": "Components",
  "@angular-eslint/sort-lifecycle-methods": "Components",
  "@angular-eslint/use-component-selector": "Components",

  // Angular performance
  "@angular-eslint/prefer-on-push-component-change-detection": "Performance",
  "@angular-eslint/no-output-native": "Performance",
  "@angular-eslint/no-pipe-impure": "Performance",

  // Angular architecture / correctness
  "@angular-eslint/no-conflicting-lifecycle": "Correctness",
  "@angular-eslint/contextual-lifecycle": "Correctness",
  "@angular-eslint/contextual-decorator": "Correctness",
  "@angular-eslint/no-async-lifecycle-method": "Correctness",
  "@angular-eslint/no-duplicates-in-metadata-arrays": "Correctness",
  "@angular-eslint/no-lifecycle-call": "Correctness",
  "@angular-eslint/require-lifecycle-on-prototype": "Correctness",
  "@angular-eslint/no-attribute-decorator": "Architecture",
  "@angular-eslint/no-forward-ref": "Architecture",
  "@angular-eslint/no-input-rename": "Architecture",
  "@angular-eslint/no-output-rename": "Architecture",
  "@angular-eslint/no-inputs-metadata-property": "Architecture",
  "@angular-eslint/no-outputs-metadata-property": "Architecture",
  "@angular-eslint/no-queries-metadata-property": "Architecture",
  "@angular-eslint/prefer-standalone": "Architecture",
  "@angular-eslint/prefer-host-metadata-property": "Architecture",
  "@angular-eslint/prefer-inject": "Architecture",
  "@angular-eslint/prefer-output-emitter-ref": "Architecture",
  "@angular-eslint/prefer-output-readonly": "Architecture",
  "@angular-eslint/use-component-view-encapsulation": "Architecture",
  "@angular-eslint/use-injectable-provided-in": "Architecture",
  "@angular-eslint/no-input-prefix": "Architecture",
  "@angular-eslint/no-output-on-prefix": "Architecture",

  // Angular security
  "@angular-eslint/relative-url-prefix": "Security",

  // Angular signals (Angular 17+)
  "@angular-eslint/prefer-signals": "Signals",
  "@angular-eslint/prefer-signal-model": "Signals",
  "@angular-eslint/no-uncalled-signals": "Signals",

  // Angular templates/accessibility (when @angular-eslint/eslint-plugin-template available)
  "@angular-eslint/template/accessibility": "Accessibility",
  "@angular-eslint/template/alt-text": "Accessibility",
  "@angular-eslint/template/click-events-have-key-events": "Accessibility",
  "@angular-eslint/template/control-events-have-key-events": "Accessibility",
  "@angular-eslint/template/elements-have-content": "Accessibility",
  "@angular-eslint/template/interactive-supports-focus": "Accessibility",
  "@angular-eslint/template/mouse-events-have-key-events": "Accessibility",
  "@angular-eslint/template/no-any": "Accessibility",
  "@angular-eslint/template/table-scope": "Accessibility",
  "@angular-eslint/template/valid-aria": "Accessibility",

  // NgRx patterns (conditional on @ngrx packages)
  "@ngrx/contextual-action-creator": "NgRx",
  "@ngrx/no-cyclic-action-creators": "NgRx",
  "@ngrx/no-discrete-actions": "NgRx",
  "@ngrx/no-effect-decorator": "NgRx",
  "@ngrx/no-effect-decorator-and-creator": "NgRx",
  "@ngrx/no-multiple-actions-in-effects": "NgRx",
  "@ngrx/no-reordering-in-effect-reducers": "NgRx",
  "@ngrx/no-typed-global-store": "NgRx",
  "@ngrx/on-function-explicit-return-type": "NgRx",
  "@ngrx/prefix-selectors-with-namespace": "NgRx",
  "@ngrx/require-middleware-selector": "NgRx",
  "@ngrx/select-style": "NgRx",
  "@ngrx/use-consumer-selector": "NgRx",

  // Angular Material patterns (conditional on @angular/material)
  "@angular/material/prefix-selector": "Material",
  "@angular/material/no-conflicting-mixins": "Material",

  // TypeScript quality
  "@typescript-eslint/no-explicit-any": "TypeScript",
  "@typescript-eslint/no-unused-vars": "Dead Code",
  "@typescript-eslint/sort-keys": "TypeScript",
};

// Rule severity mapping
const RULE_SEVERITY_MAP: Record<string, "error" | "warning"> = {
  // Errors (serious issues)
  "@angular-eslint/no-conflicting-lifecycle": "error",
  "@angular-eslint/contextual-lifecycle": "error",
  "@angular-eslint/use-pipe-transform-interface": "error",
  "@angular-eslint/no-output-native": "error",
  "@angular-eslint/no-async-lifecycle-method": "error",
  "@angular-eslint/no-lifecycle-call": "error",
  "@angular-eslint/no-duplicates-in-metadata-arrays": "error",
  "@angular-eslint/require-lifecycle-on-prototype": "error",
  "@angular-eslint/relative-url-prefix": "error",
  "@angular-eslint/contextual-decorator": "error",
  "@angular-eslint/no-uncalled-signals": "error",

  // Warnings
  "@angular-eslint/component-class-suffix": "warning",
  "@angular-eslint/directive-class-suffix": "warning",
  "@angular-eslint/pipe-prefix": "warning",
  "@angular-eslint/no-empty-lifecycle-method": "warning",
  "@angular-eslint/use-lifecycle-interface": "warning",
  "@angular-eslint/consistent-component-styles": "warning",
  "@angular-eslint/prefer-on-push-component-change-detection": "warning",
  "@angular-eslint/no-forward-ref": "warning",
  "@angular-eslint/no-input-rename": "warning",
  "@angular-eslint/no-output-rename": "warning",
  "@angular-eslint/no-inputs-metadata-property": "warning",
  "@angular-eslint/no-outputs-metadata-property": "warning",
  "@angular-eslint/prefer-standalone": "warning",
  "@angular-eslint/component-selector": "warning",
  "@angular-eslint/directive-selector": "warning",
  "@angular-eslint/no-pipe-impure": "warning",
  "@angular-eslint/no-attribute-decorator": "warning",
  "@angular-eslint/no-queries-metadata-property": "warning",
  "@angular-eslint/prefer-host-metadata-property": "warning",
  "@angular-eslint/prefer-inject": "warning",
  "@angular-eslint/prefer-output-emitter-ref": "warning",
  "@angular-eslint/prefer-output-readonly": "warning",
  "@angular-eslint/use-component-selector": "warning",
  "@angular-eslint/use-component-view-encapsulation": "warning",
  "@angular-eslint/use-injectable-provided-in": "warning",
  "@angular-eslint/component-max-inline-declarations": "warning",
  "@angular-eslint/sort-lifecycle-methods": "warning",
  "@angular-eslint/no-input-prefix": "warning",
  "@angular-eslint/no-output-on-prefix": "warning",
  "@angular-eslint/prefer-signals": "warning",
  "@angular-eslint/prefer-signal-model": "warning",

  // TypeScript
  "@typescript-eslint/no-explicit-any": "warning",
  "@typescript-eslint/no-unused-vars": "warning",
  "@typescript-eslint/sort-keys": "warning",

  // NgRx (conditional - set to ignore if @ngrx not present)
  "@ngrx/contextual-action-creator": "warning",
  "@ngrx/no-cyclic-action-creators": "error",
  "@ngrx/no-discrete-actions": "warning",
  "@ngrx/no-effect-decorator": "warning",
  "@ngrx/no-effect-decorator-and-creator": "error",
  "@ngrx/no-multiple-actions-in-effects": "error",
  "@ngrx/no-reordering-in-effect-reducers": "error",
  "@ngrx/no-typed-global-store": "error",
  "@ngrx/on-function-explicit-return-type": "warning",
  "@ngrx/prefix-selectors-with-namespace": "warning",
  "@ngrx/require-middleware-selector": "error",
  "@ngrx/select-style": "warning",
  "@ngrx/use-consumer-selector": "warning",

  // Angular Material
  "@angular/material/prefix-selector": "warning",
  "@angular/material/no-conflicting-mixins": "error",
};

// Human-readable messages and help text
const RULE_MESSAGE_MAP: Record<string, string> = {
  "@angular-eslint/component-class-suffix":
    "Component class should end with 'Component'",
  "@angular-eslint/directive-class-suffix":
    "Directive class should end with 'Directive'",
  "@angular-eslint/pipe-prefix": "Pipe name should have a consistent prefix",
  "@angular-eslint/use-pipe-transform-interface":
    "Pipe class must implement PipeTransform interface",
  "@angular-eslint/no-empty-lifecycle-method": "Remove empty lifecycle methods",
  "@angular-eslint/use-lifecycle-interface":
    "Implement the lifecycle interface for lifecycle hooks",
  "@angular-eslint/consistent-component-styles":
    "Use consistent styles type in component decorator",
  "@angular-eslint/prefer-on-push-component-change-detection":
    "Use OnPush change detection for better performance",
  "@angular-eslint/no-output-native":
    "Avoid shadowing native DOM events in output names",
  "@angular-eslint/no-conflicting-lifecycle":
    "Lifecycle hooks DoCheck and OnChanges cannot be used together",
  "@angular-eslint/contextual-lifecycle":
    "Lifecycle hook is not available in this context",
  "@angular-eslint/contextual-decorator":
    "Use contextual decorator to specify injection context",
  "@angular-eslint/no-forward-ref":
    "Avoid using forwardRef — restructure to avoid circular dependency",
  "@angular-eslint/no-input-rename":
    "Avoid renaming directive inputs — use the property name as the binding name",
  "@angular-eslint/no-output-rename":
    "Avoid renaming directive outputs — use the property name as the binding name",
  "@angular-eslint/no-inputs-metadata-property":
    "Use @Input() decorator instead of inputs metadata property",
  "@angular-eslint/no-outputs-metadata-property":
    "Use @Output() decorator instead of outputs metadata property",
  "@angular-eslint/prefer-standalone":
    "Prefer standalone components over NgModule-based components",
  "@angular-eslint/component-selector":
    "Component selector should follow naming convention",
  "@angular-eslint/directive-selector":
    "Directive selector should follow naming convention",
  "@angular-eslint/no-pipe-impure":
    "Avoid impure pipes — they run on every change detection cycle",
  "@angular-eslint/no-async-lifecycle-method":
    "Avoid async lifecycle methods — use signals instead",
  "@angular-eslint/no-duplicates-in-metadata-arrays":
    "Remove duplicate entries in decorator metadata arrays",
  "@angular-eslint/no-lifecycle-call":
    "Don't call lifecycle method directly — let Angular call them",
  "@angular-eslint/require-lifecycle-on-prototype":
    "Lifecycle methods should be declared on prototype",
  "@angular-eslint/no-attribute-decorator":
    "Avoid @Attribute() — use @Input() for property bindings",
  "@angular-eslint/no-queries-metadata-property":
    "Use decorator-based queries instead of metadata properties",
  "@angular-eslint/prefer-host-metadata-property":
    "Prefer host metadata property over @Host decorator",
  "@angular-eslint/prefer-inject":
    "Prefer inject() function over constructor dependency injection",
  "@angular-eslint/prefer-output-emitter-ref":
    "Use EventEmitter with Output instead of Subject",
  "@angular-eslint/prefer-output-readonly":
    "Mark outputs as readonly when possible",
  "@angular-eslint/use-component-selector":
    "Components must have selector for proper encapsulation",
  "@angular-eslint/use-component-view-encapsulation":
    "Specify view encapsulation strategy explicitly",
  "@angular-eslint/use-injectable-provided-in":
    "Specify providedIn scope for @Injectable()",
  "@angular-eslint/component-max-inline-declarations":
    "Too many inline declarations in component — extract to separate files",
  "@angular-eslint/sort-lifecycle-methods":
    "Lifecycle methods should be declared in correct order",
  "@angular-eslint/no-input-prefix":
    "Avoid prefix for input property names",
  "@angular-eslint/no-output-on-prefix":
    "Avoid 'on' prefix for output event names",
  "@angular-eslint/relative-url-prefix":
    "Use relative URL prefixes for better security",
  "@angular-eslint/prefer-signals":
    "Prefer Angular signals over other reactive patterns",
  "@angular-eslint/prefer-signal-model":
    "Prefer signal-based model for component state",
  "@angular-eslint/no-uncalled-signals":
    "Signal getters must be called to access value",
  "@typescript-eslint/no-explicit-any":
    "Avoid 'any' type — use specific types for better type safety",
  "@typescript-eslint/no-unused-vars": "Remove unused variable declaration",
  "@typescript-eslint/sort-keys": "Sort object keys consistently",
  // NgRx rules
  "@ngrx/contextual-action-creator":
    "Use contextual action creators for typed actions",
  "@ngrx/no-cyclic-action-creators":
    "Action creators should not reference each other cyclically",
  "@ngrx/no-discrete-actions":
    "Use discrete actions instead of broad action types",
  "@ngrx/no-effect-decorator":
    "Consider using functional effects instead of @Effect decorator",
  "@ngrx/no-effect-decorator-and-creator":
    "Don't use both @Effect decorator and createEffect function",
  "@ngrx/no-multiple-actions-in-effects":
    "Effects should dispatch a single action or none",
  "@ngrx/no-reordering-in-effect-reducers":
    "Don't reorder actions in effect reducers",
  "@ngrx/no-typed-global-store":
    "Use typed GlobalStore for better type safety",
  "@ngrx/on-function-explicit-return-type":
    "Specify explicit return type for on() reducer functions",
  "@ngrx/prefix-selectors-with-namespace":
    "Prefix selectors with feature namespace",
  "@ngrx/require-middleware-selector":
    "Middleware must have selector for proper scoping",
  "@ngrx/select-style":
    "Prefer selector functions over props in select",
  "@ngrx/use-consumer-selector":
    "Use useSelector with selector function for proper memoization",
  // Angular Material rules
  "@angular/material/prefix-selector":
    "Material components should use proper selector prefix",
  "@angular/material/no-conflicting-mixins":
    "Avoid conflicting mixins in Material components",
};

const RULE_HELP_MAP: Record<string, string> = {
  "@angular-eslint/component-class-suffix":
    "Add 'Component' suffix: `export class UserProfileComponent { }`",
  "@angular-eslint/directive-class-suffix":
    "Add 'Directive' suffix: `export class HighlightDirective { }`",
  "@angular-eslint/use-pipe-transform-interface":
    "Implement PipeTransform: `export class MyPipe implements PipeTransform { transform(value: unknown) { } }`",
  "@angular-eslint/no-empty-lifecycle-method":
    "Remove the empty lifecycle method or add logic to it",
  "@angular-eslint/use-lifecycle-interface":
    "Add the interface: `export class MyComponent implements OnInit, OnDestroy { }`",
  "@angular-eslint/prefer-on-push-component-change-detection":
    "Add to decorator: `@Component({ changeDetection: ChangeDetectionStrategy.OnPush })`",
  "@angular-eslint/no-output-native":
    "Rename the output: use a descriptive name like `(valueChange)` instead of `(click)` or `(change)`",
  "@angular-eslint/no-forward-ref":
    "Restructure your code to avoid circular dependencies, or use `inject()` with a lazy function",
  "@angular-eslint/no-input-rename":
    "Remove the alias: `@Input() myProp: string` instead of `@Input('myAlias') myProp: string`",
  "@angular-eslint/no-output-rename":
    "Remove the alias: `@Output() myEvent = new EventEmitter()` instead of aliased version",
  "@angular-eslint/no-inputs-metadata-property":
    "Use `@Input() myProp: string` decorator on the property instead of `inputs: ['myProp']` in the decorator metadata",
  "@angular-eslint/no-outputs-metadata-property":
    "Use `@Output() myEvent = new EventEmitter()` instead of `outputs: ['myEvent']` in the decorator metadata",
  "@angular-eslint/prefer-standalone":
    "Add `standalone: true` to component: `@Component({ standalone: true, ... })`",
  "@typescript-eslint/no-explicit-any":
    "Replace `any` with a specific type or `unknown` if the type is truly unknown",
  "@typescript-eslint/no-unused-vars":
    "Remove the unused variable or prefix with `_` to indicate it's intentionally unused",
  "@typescript-eslint/sort-keys":
    "Sort object keys alphabetically or by a consistent pattern",
  "@angular-eslint/prefer-inject":
    "Use `inject(MyService)` instead of constructor injection: `constructor(private myService: MyService) {}`",
  "@angular-eslint/no-pipe-impure":
    "Remove `pure: false` from pipe decorator or refactor to use a service",
  "@angular-eslint/prefer-signals":
    "Replace observables with signals for simpler reactive state: `count = signal(0)`",
  "@angular-eslint/prefer-signal-model":
    "Use signal-based input/output model: `count = model(0)` instead of `@Input() count: number`",
  "@angular-eslint/no-uncalled-signals":
    "Call the signal getter to access its value: `this.count()` not `this.count`",
  "@angular-eslint/component-max-inline-declarations":
    "Move templates/styles to separate files or use inline with caution — consider extracting when > 3 inline declarations",
  "@angular-eslint/relative-url-prefix":
    "Use relative URLs (no leading slash) or ensure absolute URLs are intentional for security",
  "@ngrx/contextual-action-creator":
    "Use `createActionGroup` or `createAction` with props for type-safe actions",
  "@ngrx/no-multiple-actions-in-effects":
    "Split effect into multiple effects or use `mergeMap` with individual actions",
};

interface PackagePresence {
  hasNgRx: boolean;
  hasAngularMaterial: boolean;
  hasSignals: boolean;
}

const detectPackagePresence = (packageJson: PackageJson): PackagePresence => {
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
  };

  return {
    hasNgRx: Object.keys(deps).some(
      (dep) => dep.startsWith("@ngrx/") && !dep.includes("store"),
    ) || Object.keys(deps).includes("@ngrx/store"),
    hasAngularMaterial: Object.keys(deps).includes("@angular/material"),
    hasSignals: true, // Angular 17+ signals are built-in, always available
  };
};

const buildEslintConfig = (
  hasTypeScript: boolean,
  tsconfigPath: string | null,
  useTypeAware: boolean,
  packagePresence: PackagePresence,
): Linter.Config[] => {
  const languageOptions: Linter.Config["languageOptions"] = {
    parser: tsEslint.parser as Linter.Parser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      ...(hasTypeScript && tsconfigPath && useTypeAware
        ? { project: tsconfigPath }
        : {}),
    },
  };

  // Core Angular rules (always enabled)
  const angularRules: Linter.RulesRecord = {
    // Component best practices
    "@angular-eslint/component-class-suffix": "warn",
    "@angular-eslint/directive-class-suffix": "warn",
    "@angular-eslint/pipe-prefix": "warn",
    "@angular-eslint/no-empty-lifecycle-method": "warn",
    "@angular-eslint/use-lifecycle-interface": "warn",
    "@angular-eslint/consistent-component-styles": "warn",
    "@angular-eslint/sort-lifecycle-methods": "warn",
    "@angular-eslint/use-component-selector": "warn",
    "@angular-eslint/component-selector": "warn",
    "@angular-eslint/directive-selector": "warn",

    // Performance
    "@angular-eslint/prefer-on-push-component-change-detection": "warn",
    "@angular-eslint/no-output-native": "error",
    "@angular-eslint/no-pipe-impure": "warn",
    "@angular-eslint/component-max-inline-declarations": "warn",

    // Correctness
    "@angular-eslint/use-pipe-transform-interface": "error",
    "@angular-eslint/no-conflicting-lifecycle": "error",
    "@angular-eslint/contextual-lifecycle": "error",
    "@angular-eslint/contextual-decorator": "error",
    "@angular-eslint/no-async-lifecycle-method": "error",
    "@angular-eslint/no-duplicates-in-metadata-arrays": "error",
    "@angular-eslint/no-lifecycle-call": "error",
    "@angular-eslint/require-lifecycle-on-prototype": "error",

    // Architecture
    "@angular-eslint/no-forward-ref": "warn",
    "@angular-eslint/no-input-rename": "warn",
    "@angular-eslint/no-output-rename": "warn",
    "@angular-eslint/no-inputs-metadata-property": "warn",
    "@angular-eslint/no-outputs-metadata-property": "warn",
    "@angular-eslint/no-queries-metadata-property": "warn",
    "@angular-eslint/prefer-standalone": "warn",
    "@angular-eslint/prefer-host-metadata-property": "warn",
    "@angular-eslint/prefer-inject": "warn",
    "@angular-eslint/prefer-output-emitter-ref": "warn",
    "@angular-eslint/prefer-output-readonly": "warn",
    "@angular-eslint/use-component-view-encapsulation": "warn",
    "@angular-eslint/use-injectable-provided-in": "warn",
    "@angular-eslint/no-attribute-decorator": "warn",
    "@angular-eslint/no-input-prefix": "warn",
    "@angular-eslint/no-output-on-prefix": "warn",

    // Security
    "@angular-eslint/relative-url-prefix": "error",

    // Signals (Angular 17+)
    "@angular-eslint/prefer-signals": "warn",
    "@angular-eslint/prefer-signal-model": "warn",
    "@angular-eslint/no-uncalled-signals": "error",
  };

  // TypeScript rules
  const tsRules: Linter.RulesRecord = {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/sort-keys": "warn",
  };

  // NgRx rules (conditional - only if @ngrx packages present)
  const ngrxRules: Linter.RulesRecord = packagePresence.hasNgRx
    ? {
        "@ngrx/contextual-action-creator": "warn",
        "@ngrx/no-cyclic-action-creators": "error",
        "@ngrx/no-discrete-actions": "warn",
        "@ngrx/no-effect-decorator": "warn",
        "@ngrx/no-effect-decorator-and-creator": "error",
        "@ngrx/no-multiple-actions-in-effects": "error",
        "@ngrx/no-reordering-in-effect-reducers": "error",
        "@ngrx/no-typed-global-store": "error",
        "@ngrx/on-function-explicit-return-type": "warn",
        "@ngrx/prefix-selectors-with-namespace": "warn",
        "@ngrx/require-middleware-selector": "error",
        "@ngrx/select-style": "warn",
        "@ngrx/use-consumer-selector": "warn",
      }
    : {};

  // Angular Material rules (conditional - only if @angular/material present)
  const materialRules: Linter.RulesRecord = packagePresence.hasAngularMaterial
    ? {
        "@angular/material/prefix-selector": "warn",
        "@angular/material/no-conflicting-mixins": "error",
      }
    : {};

  return [
    {
      files: ["**/*.ts"],
      plugins: {
        "@angular-eslint": angularEslintPlugin as unknown as ESLint.Plugin,
        "@typescript-eslint": tsEslint.plugin as unknown as ESLint.Plugin,
      },
      languageOptions,
      rules: {
        ...angularRules,
        ...tsRules,
        ...ngrxRules,
        ...materialRules,
      },
    },
  ];
};

const mapEslintSeverity = (
  severity: number,
  ruleId: string | null,
): "error" | "warning" => {
  if (ruleId && RULE_SEVERITY_MAP[ruleId]) {
    return RULE_SEVERITY_MAP[ruleId];
  }
  return severity === 2 ? "error" : "warning";
};

const resolveDiagnosticCategory = (ruleId: string): string =>
  RULE_CATEGORY_MAP[ruleId] ?? "Other";

const resolveMessage = (ruleId: string, defaultMessage: string): string =>
  RULE_MESSAGE_MAP[ruleId] ?? defaultMessage;

const resolveHelp = (ruleId: string): string => RULE_HELP_MAP[ruleId] ?? "";

const parsePluginAndRule = (
  ruleId: string,
): { plugin: string; rule: string } => {
  // e.g. "@angular-eslint/component-class-suffix" -> plugin: "@angular-eslint", rule: "component-class-suffix"
  // e.g. "@typescript-eslint/no-explicit-any" -> plugin: "@typescript-eslint", rule: "no-explicit-any"
  const match = ruleId.match(/^(@[^/]+\/[^/]+|[^/]+)\/(.+)$/);
  if (match) {
    return { plugin: match[1], rule: match[2] };
  }
  return { plugin: "eslint", rule: ruleId };
};

export const runEslint = async (
  rootDirectory: string,
  hasTypeScript: boolean,
  includePaths?: string[],
  options?: { useTypeAware?: boolean },
): Promise<Diagnostic[]> => {
  if (includePaths !== undefined && includePaths.length === 0) {
    return [];
  }

  const tsconfigPath = hasTypeScript
    ? path.join(rootDirectory, "tsconfig.json")
    : null;

  // Load package.json to detect package presence for conditional rules
  let packagePresence: PackagePresence = {
    hasNgRx: false,
    hasAngularMaterial: false,
    hasSignals: true,
  };

  try {
    const packageJsonPath = path.join(rootDirectory, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJsonContent = fs.readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent) as PackageJson;
      packagePresence = detectPackagePresence(packageJson);
    }
  } catch {
    // If we can't read package.json, default to no conditional rules
  }

  const cacheRoot = path.join(
    rootDirectory,
    "node_modules",
    ".cache",
    "angular-doctor",
  );
  fs.mkdirSync(cacheRoot, { recursive: true });
  const eslint = new ESLint({
    cwd: rootDirectory,
    overrideConfigFile: null,
    overrideConfig: buildEslintConfig(
      hasTypeScript,
      tsconfigPath && fs.existsSync(tsconfigPath) ? tsconfigPath : null,
      options?.useTypeAware ?? true,
      packagePresence,
    ),
    ignore: true,
    cache: true,
    cacheLocation: path.join(cacheRoot, ".eslintcache"),
  });

  const patterns = includePaths ?? ["**/*.ts"];

  let results: ESLint.LintResult[];
  try {
    results = await eslint.lintFiles(patterns);
  } catch {
    return [];
  }

  const diagnostics: Diagnostic[] = [];

  for (const result of results) {
    for (const message of result.messages) {
      if (!message.ruleId) continue;
      const { plugin, rule } = parsePluginAndRule(message.ruleId);
      const ruleKey = message.ruleId;

      diagnostics.push({
        filePath: path.relative(rootDirectory, result.filePath),
        plugin,
        rule,
        severity: mapEslintSeverity(message.severity, ruleKey),
        message: resolveMessage(ruleKey, message.message),
        help: resolveHelp(ruleKey),
        line: message.line ?? 0,
        column: message.column ?? 0,
        category: resolveDiagnosticCategory(ruleKey),
      });
    }
  }

  return diagnostics;
};
