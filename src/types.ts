export type AngularFramework = "angular-cli" | "nx" | "analog" | "ionic" | "universal" | "unknown";

export interface ProjectInfo {
  rootDirectory: string;
  projectName: string;
  angularVersion: string | null;
  framework: AngularFramework;
  hasTypeScript: boolean;
  hasStandaloneComponents: boolean;
  sourceFileCount: number;
}

export interface Diagnostic {
  filePath: string;
  plugin: string;
  rule: string;
  severity: "error" | "warning";
  message: string;
  help: string;
  line: number;
  column: number;
  category: string;
  weight?: number;
}

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
}

export interface ScoreResult {
  score: number;
  label: string;
}

export interface ScanResult {
  diagnostics: Diagnostic[];
  scoreResult: ScoreResult | null;
  skippedChecks: string[];
}

export interface ScanOptions {
  lint?: boolean;
  deadCode?: boolean;
  verbose?: boolean;
  scoreOnly?: boolean;
  includePaths?: string[];
}

export interface KnipIssue {
  filePath: string;
  symbol: string;
  type: string;
}

export interface KnipIssueRecords {
  [workspace: string]: {
    [filePath: string]: KnipIssue;
  };
}

export interface KnipResults {
  issues: {
    files: Set<string>;
    dependencies: KnipIssueRecords;
    devDependencies: KnipIssueRecords;
    unlisted: KnipIssueRecords;
    exports: KnipIssueRecords;
    types: KnipIssueRecords;
    duplicates: KnipIssueRecords;
  };
  counters: Record<string, number>;
}

export interface DiffInfo {
  currentBranch: string;
  baseBranch: string;
  changedFiles: string[];
  isCurrentChanges?: boolean;
}

export interface AngularDoctorIgnoreConfig {
  rules?: string[];
  files?: string[];
}

export interface AngularDoctorConfig {
  ignore?: AngularDoctorIgnoreConfig;
  lint?: boolean;
  deadCode?: boolean;
  verbose?: boolean;
  diff?: boolean | string;
}

export interface WorkspacePackage {
  name: string;
  directory: string;
}
