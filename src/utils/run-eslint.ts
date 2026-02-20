import fs from "node:fs";
import path from "node:path";
import { ESLint, type Linter } from "eslint";
import angularEslintPlugin from "@angular-eslint/eslint-plugin";
import tsEslint from "typescript-eslint";
import type { Diagnostic } from "../types.js";

// Rule category mapping
const RULE_CATEGORY_MAP: Record<string, string> = {
  // Angular component best practices
  "@angular-eslint/component-class-suffix": "Components",
  "@angular-eslint/directive-class-suffix": "Components",
  "@angular-eslint/pipe-prefix": "Components",
  "@angular-eslint/use-pipe-transform-interface": "Components",
  "@angular-eslint/no-empty-lifecycle-method": "Components",
  "@angular-eslint/use-lifecycle-interface": "Components",
  "@angular-eslint/consistent-component-styles": "Components",

  // Angular performance
  "@angular-eslint/prefer-on-push-component-change-detection": "Performance",
  "@angular-eslint/no-output-native": "Performance",

  // Angular architecture / correctness
  "@angular-eslint/no-conflicting-lifecycle": "Correctness",
  "@angular-eslint/contextual-lifecycle": "Correctness",
  "@angular-eslint/no-forward-ref": "Architecture",
  "@angular-eslint/no-input-rename": "Architecture",
  "@angular-eslint/no-output-rename": "Architecture",
  "@angular-eslint/no-inputs-metadata-property": "Architecture",
  "@angular-eslint/no-outputs-metadata-property": "Architecture",
  "@angular-eslint/prefer-standalone": "Architecture",

  // TypeScript quality
  "@typescript-eslint/no-explicit-any": "TypeScript",
  "@typescript-eslint/no-unused-vars": "Dead Code",
};

// Rule severity mapping
const RULE_SEVERITY_MAP: Record<string, "error" | "warning"> = {
  "@angular-eslint/no-conflicting-lifecycle": "error",
  "@angular-eslint/contextual-lifecycle": "error",
  "@angular-eslint/use-pipe-transform-interface": "error",
  "@angular-eslint/no-output-native": "error",
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
  "@typescript-eslint/no-explicit-any": "warning",
  "@typescript-eslint/no-unused-vars": "warning",
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
  "@typescript-eslint/no-explicit-any":
    "Avoid 'any' type — use specific types for better type safety",
  "@typescript-eslint/no-unused-vars": "Remove unused variable declaration",
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
};

const buildEslintConfig = (
  hasTypeScript: boolean,
  tsconfigPath: string | null,
  useTypeAware: boolean,
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

  const angularRules: Linter.RulesRecord = {
    "@angular-eslint/component-class-suffix": "warn",
    "@angular-eslint/directive-class-suffix": "warn",
    "@angular-eslint/no-empty-lifecycle-method": "warn",
    "@angular-eslint/use-lifecycle-interface": "warn",
    "@angular-eslint/use-pipe-transform-interface": "error",
    "@angular-eslint/prefer-on-push-component-change-detection": "warn",
    "@angular-eslint/no-output-native": "error",
    "@angular-eslint/no-conflicting-lifecycle": "error",
    "@angular-eslint/contextual-lifecycle": "error",
    "@angular-eslint/no-forward-ref": "warn",
    "@angular-eslint/no-input-rename": "warn",
    "@angular-eslint/no-output-rename": "warn",
    "@angular-eslint/no-inputs-metadata-property": "warn",
    "@angular-eslint/no-outputs-metadata-property": "warn",
  };

  const tsRules: Linter.RulesRecord = {
    "@typescript-eslint/no-explicit-any": "warn",
  };

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
