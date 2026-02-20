import path from "node:path";
import basePrompts from "prompts";
import type { WorkspacePackage } from "../types.js";
import { listAngularWorkspaceProjects, listWorkspacePackages } from "./discover-project.js";
import { highlighter } from "./highlighter.js";
import { logger } from "./logger.js";

const onCancel = () => {
  logger.break();
  logger.log("Cancelled.");
  logger.break();
  process.exit(0);
};

const promptProjectSelection = async (
  workspacePackages: WorkspacePackage[],
  rootDirectory: string,
): Promise<string[]> => {
  const response = await basePrompts(
    {
      type: "multiselect",
      name: "selectedDirectories",
      message: "Select projects to scan",
      choices: workspacePackages.map((workspacePackage) => ({
        title: workspacePackage.name,
        description: path.relative(rootDirectory, workspacePackage.directory) || ".",
        value: workspacePackage.directory,
        selected: true,
      })),
      min: 1,
    },
    { onCancel },
  );
  return (response.selectedDirectories as string[]) ?? [];
};

const resolveProjectFlag = (
  projectFlag: string,
  workspacePackages: WorkspacePackage[],
): string[] => {
  const requestedNames = projectFlag.split(",").map((name) => name.trim());
  const resolvedDirectories: string[] = [];

  for (const requestedName of requestedNames) {
    const matched = workspacePackages.find(
      (workspacePackage) =>
        workspacePackage.name === requestedName ||
        path.basename(workspacePackage.directory) === requestedName,
    );

    if (!matched) {
      const availableNames = workspacePackages
        .map((workspacePackage) => workspacePackage.name)
        .join(", ");
      throw new Error(`Project "${requestedName}" not found. Available: ${availableNames}`);
    }

    resolvedDirectories.push(matched.directory);
  }

  return resolvedDirectories;
};

const printDiscoveredProjects = (packages: WorkspacePackage[]): void => {
  logger.log(
    `${highlighter.success("✔")} Select projects to scan ${highlighter.dim("›")} ${packages.map((p) => p.name).join(", ")}`,
  );
};

/**
 * Resolves the list of project directories to scan.
 *
 * Priority order:
 * 1. Angular CLI workspace (`angular.json`) — covers single-repo multi-project Angular workspaces
 * 2. npm/pnpm workspaces (package.json `workspaces` field or pnpm-workspace.yaml)
 * 3. Fall back to `rootDirectory` itself
 */
export const selectProjects = async (
  rootDirectory: string,
  projectFlag: string | undefined,
  skipPrompts: boolean,
): Promise<string[]> => {
  // Prefer angular.json workspace projects (Angular CLI / Nx workspaces)
  let packages = listAngularWorkspaceProjects(rootDirectory);

  // Fall back to npm/pnpm workspace packages
  if (packages.length === 0) {
    packages = listWorkspacePackages(rootDirectory);
  }

  // No workspace found — scan the directory itself
  if (packages.length === 0) return [rootDirectory];

  // Single project — no need to prompt
  if (packages.length === 1) {
    logger.log(
      `${highlighter.success("✔")} Select projects to scan ${highlighter.dim("›")} ${packages[0].name}`,
    );
    logger.break();
    return [packages[0].directory];
  }

  // Explicit --project flag
  if (projectFlag) return resolveProjectFlag(projectFlag, packages);

  // Non-interactive mode: scan all
  if (skipPrompts) {
    printDiscoveredProjects(packages);
    logger.break();
    return packages.map((workspacePackage) => workspacePackage.directory);
  }

  // Interactive multi-select prompt
  return promptProjectSelection(packages, rootDirectory);
};
