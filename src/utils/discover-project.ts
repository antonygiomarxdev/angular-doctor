import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { GIT_LS_FILES_MAX_BUFFER_BYTES, SOURCE_FILE_PATTERN } from "../constants.js";
import type { AngularFramework, PackageJson, ProjectInfo, WorkspacePackage } from "../types.js";

const ANGULAR_FRAMEWORK_PACKAGES: Record<string, AngularFramework> = {
  "@nrwl/angular": "nx",
  "@nx/angular": "nx",
  "@analogjs/platform": "analog",
  "@ionic/angular": "ionic",
  "@angular/ssr": "universal",
  "@nguniversal/express-engine": "universal",
};

const ANGULAR_FRAMEWORK_DISPLAY_NAMES: Record<AngularFramework, string> = {
  "angular-cli": "Angular CLI",
  nx: "Nx",
  analog: "AnalogJS",
  ionic: "Ionic",
  universal: "Angular SSR",
  unknown: "Angular",
};

export const formatFrameworkName = (framework: AngularFramework): string =>
  ANGULAR_FRAMEWORK_DISPLAY_NAMES[framework];

const readPackageJson = (filePath: string): PackageJson => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as PackageJson;
  } catch {
    return {};
  }
};

const collectAllDependencies = (packageJson: PackageJson): Record<string, string> => ({
  ...packageJson.peerDependencies,
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
});

const detectFramework = (dependencies: Record<string, string>): AngularFramework => {
  for (const [packageName, frameworkName] of Object.entries(ANGULAR_FRAMEWORK_PACKAGES)) {
    if (dependencies[packageName]) {
      return frameworkName;
    }
  }
  if (dependencies["@angular/cli"] || dependencies["@angular-devkit/build-angular"] || dependencies["@angular-devkit/core"]) {
    return "angular-cli";
  }
  return "unknown";
};

const detectAngularVersion = (dependencies: Record<string, string>): string | null =>
  dependencies["@angular/core"] ?? null;

const detectStandaloneComponents = (packageJson: PackageJson): boolean => {
  const deps = collectAllDependencies(packageJson);
  const angularVersion = deps["@angular/core"];
  if (!angularVersion) return false;
  // Angular 14+ supports standalone components (standalone: true flag)
  // Angular 17+ makes standalone the default
  const majorVersion = parseInt(angularVersion.match(/\d+/)?.[0] ?? "", 10);
  return !isNaN(majorVersion) && majorVersion >= 14;
};

const countSourceFiles = (rootDirectory: string): number => {
  const result = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: rootDirectory,
    encoding: "utf-8",
    maxBuffer: GIT_LS_FILES_MAX_BUFFER_BYTES,
  });

  if (result.error || result.status !== 0) {
    return 0;
  }

  return result.stdout
    .split("\n")
    .filter((filePath) => filePath.length > 0 && SOURCE_FILE_PATTERN.test(filePath)).length;
};

const hasAngularDependency = (packageJson: PackageJson): boolean => {
  const allDependencies = collectAllDependencies(packageJson);
  return Boolean(allDependencies["@angular/core"]);
};

/**
 * Walks up the directory tree from `directory` until it finds a `package.json`.
 * Returns the directory containing the package.json, or null if not found.
 */
const findNearestPackageJsonDir = (directory: string): string | null => {
  let current = directory;
  while (true) {
    if (fs.existsSync(path.join(current, "package.json"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

export const discoverProject = (directory: string): ProjectInfo => {
  // First try the given directory, then walk up to find the nearest package.json
  const packageJsonDir = fs.existsSync(path.join(directory, "package.json"))
    ? directory
    : findNearestPackageJsonDir(directory);

  if (!packageJsonDir) {
    throw new Error(`No package.json found in ${directory} or any parent directory`);
  }

  const packageJson = readPackageJson(path.join(packageJsonDir, "package.json"));
  const allDeps = collectAllDependencies(packageJson);
  const angularVersion = detectAngularVersion(allDeps);
  const framework = detectFramework(allDeps);

  // tsconfig.json — check the project directory first, then the package.json directory
  const hasTypeScript =
    fs.existsSync(path.join(directory, "tsconfig.json")) ||
    fs.existsSync(path.join(packageJsonDir, "tsconfig.json"));

  const hasStandaloneComponents = detectStandaloneComponents(packageJson);
  const sourceFileCount = countSourceFiles(directory);

  // Use the Angular project name from angular.json if possible, otherwise from package.json
  const angularJsonPath = path.join(packageJsonDir, "angular.json");
  let projectName = packageJson.name ?? path.basename(directory);
  if (packageJsonDir !== directory && fs.existsSync(angularJsonPath)) {
    // Use the directory name as a more meaningful project name for workspace sub-projects
    projectName = path.basename(directory);
  }

  return {
    rootDirectory: directory,
    projectName,
    angularVersion,
    framework,
    hasTypeScript,
    hasStandaloneComponents,
    sourceFileCount,
  };
};

const parsePnpmWorkspacePatterns = (rootDirectory: string): string[] => {
  const workspacePath = path.join(rootDirectory, "pnpm-workspace.yaml");
  if (!fs.existsSync(workspacePath)) return [];

  const content = fs.readFileSync(workspacePath, "utf-8");
  const patterns: string[] = [];
  let isInsidePackagesBlock = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "packages:") {
      isInsidePackagesBlock = true;
      continue;
    }
    if (isInsidePackagesBlock && trimmed.startsWith("-")) {
      patterns.push(trimmed.replace(/^-\s*/, "").replace(/["']/g, ""));
    } else if (isInsidePackagesBlock && trimmed.length > 0 && !trimmed.startsWith("#")) {
      isInsidePackagesBlock = false;
    }
  }

  return patterns;
};

const getWorkspacePatterns = (rootDirectory: string, packageJson: PackageJson): string[] => {
  const pnpmPatterns = parsePnpmWorkspacePatterns(rootDirectory);
  if (pnpmPatterns.length > 0) return pnpmPatterns;

  if (Array.isArray(packageJson.workspaces)) {
    return packageJson.workspaces;
  }

  if (packageJson.workspaces?.packages) {
    return packageJson.workspaces.packages;
  }

  return [];
};

const resolveWorkspaceDirectories = (rootDirectory: string, pattern: string): string[] => {
  const cleanPattern = pattern.replace(/["']/g, "").replace(/\/\*\*$/, "/*");

  if (!cleanPattern.includes("*")) {
    const directoryPath = path.join(rootDirectory, cleanPattern);
    if (fs.existsSync(directoryPath) && fs.existsSync(path.join(directoryPath, "package.json"))) {
      return [directoryPath];
    }
    return [];
  }

  const wildcardIndex = cleanPattern.indexOf("*");
  const baseDirectory = path.join(rootDirectory, cleanPattern.slice(0, wildcardIndex));
  const suffixAfterWildcard = cleanPattern.slice(wildcardIndex + 1);

  if (!fs.existsSync(baseDirectory) || !fs.statSync(baseDirectory).isDirectory()) {
    return [];
  }

  return fs
    .readdirSync(baseDirectory)
    .map((entry) => path.join(baseDirectory, entry, suffixAfterWildcard))
    .filter(
      (entryPath) =>
        fs.existsSync(entryPath) &&
        fs.statSync(entryPath).isDirectory() &&
        fs.existsSync(path.join(entryPath, "package.json")),
    );
};

export const listWorkspacePackages = (rootDirectory: string): WorkspacePackage[] => {
  const packageJsonPath = path.join(rootDirectory, "package.json");
  if (!fs.existsSync(packageJsonPath)) return [];

  const packageJson = readPackageJson(packageJsonPath);
  const patterns = getWorkspacePatterns(rootDirectory, packageJson);
  if (patterns.length === 0) return [];

  const packages: WorkspacePackage[] = [];

  for (const pattern of patterns) {
    const directories = resolveWorkspaceDirectories(rootDirectory, pattern);
    for (const workspaceDirectory of directories) {
      const workspacePackageJson = readPackageJson(path.join(workspaceDirectory, "package.json"));

      if (!hasAngularDependency(workspacePackageJson)) continue;

      const name = workspacePackageJson.name ?? path.basename(workspaceDirectory);
      packages.push({ name, directory: workspaceDirectory });
    }
  }

  return packages;
};

interface AngularWorkspaceProject {
  projectType?: string;
  root?: string;
}

interface AngularWorkspace {
  version?: number;
  projects?: Record<string, AngularWorkspaceProject | string>;
}

/**
 * Reads `angular.json` (Angular CLI workspace config) and returns one
 * WorkspacePackage per project whose root directory contains an Angular dependency.
 */
export const listAngularWorkspaceProjects = (rootDirectory: string): WorkspacePackage[] => {
  const angularJsonPath = path.join(rootDirectory, "angular.json");
  if (!fs.existsSync(angularJsonPath)) return [];

  let workspace: AngularWorkspace;
  try {
    workspace = JSON.parse(fs.readFileSync(angularJsonPath, "utf-8")) as AngularWorkspace;
  } catch {
    return [];
  }

  if (!workspace.projects || typeof workspace.projects !== "object") return [];

  const packages: WorkspacePackage[] = [];

  for (const [name, projectConfig] of Object.entries(workspace.projects)) {
    // Older angular.json formats store the root as a plain string
    const root =
      typeof projectConfig === "string"
        ? projectConfig
        : (projectConfig.root ?? "");

    const projectDirectory = root ? path.resolve(rootDirectory, root) : rootDirectory;

    // Only include directories that actually exist
    if (!fs.existsSync(projectDirectory) || !fs.statSync(projectDirectory).isDirectory()) {
      continue;
    }

    packages.push({ name, directory: projectDirectory });
  }

  return packages;
};
