import fs from "node:fs";
import path from "node:path";
import { main } from "knip";
import { createOptions } from "knip/session";
import { MAX_KNIP_RETRIES } from "../constants.js";
import type { Diagnostic, KnipIssueRecords, KnipResults } from "../types.js";

const KNIP_CATEGORY_MAP: Record<string, string> = {
  files: "Dead Code",
  exports: "Dead Code",
  types: "Dead Code",
  duplicates: "Dead Code",
};

const KNIP_MESSAGE_MAP: Record<string, string> = {
  files: "Unused file",
  exports: "Unused export",
  types: "Unused type",
  duplicates: "Duplicate export",
};

const KNIP_SEVERITY_MAP: Record<string, "error" | "warning"> = {
  files: "warning",
  exports: "warning",
  types: "warning",
  duplicates: "warning",
};

const collectIssueRecords = (
  records: KnipIssueRecords,
  issueType: string,
  rootDirectory: string,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  for (const issues of Object.values(records)) {
    for (const issue of Object.values(issues)) {
      const filePath = path.relative(rootDirectory, issue.filePath);
      // Skip issues for files outside the rootDirectory scope
      if (filePath.startsWith("..")) continue;
      diagnostics.push({
        filePath,
        plugin: "knip",
        rule: issueType,
        severity: KNIP_SEVERITY_MAP[issueType] ?? "warning",
        message: `${KNIP_MESSAGE_MAP[issueType]}: ${issue.symbol}`,
        help: "",
        line: 0,
        column: 0,
        category: KNIP_CATEGORY_MAP[issueType] ?? "Dead Code",
        weight: 1,
      });
    }
  }

  return diagnostics;
};

// HACK: knip triggers dotenv which logs to stdout/stderr via console methods
const silenced = async <T>(fn: () => Promise<T>): Promise<T> => {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  }
};

const CONFIG_LOADING_ERROR_PATTERN = /Error loading .*\/([a-z-]+)\.config\./;

const extractFailedPluginName = (error: unknown): string | null => {
  const match = String(error).match(CONFIG_LOADING_ERROR_PATTERN);
  return match?.[1] ?? null;
};

const ANGULAR_ENTRY_PATTERNS = ["**/*.module.ts", "**/*.routes.ts"];

const runKnipWithOptions = async (
  knipCwd: string,
  workspaceName?: string,
): Promise<KnipResults> => {
  const options = await silenced(() =>
    createOptions({
      cwd: knipCwd,
      isShowProgress: false,
      ...(workspaceName ? { workspace: workspaceName } : {}),
    }),
  );

  const parsedConfig = options.parsedConfig as Record<string, unknown>;

  // For Angular projects without user-defined entry patterns, add Angular module
  // and routes files as entry points. This prevents false positives from
  // lazy-loaded modules whose import chains cannot be statically traced.
  if (
    fs.existsSync(path.join(knipCwd, "angular.json")) &&
    parsedConfig["entry"] === undefined
  ) {
    parsedConfig["entry"] = ANGULAR_ENTRY_PATTERNS;
  }

  for (let attempt = 0; attempt <= MAX_KNIP_RETRIES; attempt++) {
    try {
      return (await silenced(() => main(options))) as KnipResults;
    } catch (error) {
      const failedPlugin = extractFailedPluginName(error);
      if (!failedPlugin || attempt === MAX_KNIP_RETRIES) {
        throw error;
      }
      parsedConfig[failedPlugin] = false;
    }
  }

  throw new Error("Unreachable");
};

const hasNodeModules = (directory: string): boolean => {
  const nodeModulesPath = path.join(directory, "node_modules");
  return fs.existsSync(nodeModulesPath) && fs.statSync(nodeModulesPath).isDirectory();
};

/**
 * Searches upward from `directory` for an `angular.json` file and returns
 * the directory that contains it, or `null` if none is found.
 */
export const findAngularWorkspaceRoot = (directory: string): string | null => {
  let current = directory;
  while (true) {
    if (fs.existsSync(path.join(current, "angular.json"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
};

export const runKnip = async (rootDirectory: string): Promise<Diagnostic[]> => {
  if (!hasNodeModules(rootDirectory)) {
    return [];
  }

  // Use the Angular workspace root (where angular.json lives) as the knip cwd
  // so that the Angular plugin can find its configuration and correctly identify
  // entry points for the whole workspace.
  const angularWorkspaceRoot = findAngularWorkspaceRoot(rootDirectory);
  const knipCwd = angularWorkspaceRoot ?? rootDirectory;

  const knipResult = await runKnipWithOptions(knipCwd);

  const { issues } = knipResult;
  const diagnostics: Diagnostic[] = [];

  for (const unusedFile of issues.files) {
    const filePath = path.relative(rootDirectory, unusedFile);
    // Skip files outside the rootDirectory scope (e.g., from other workspace projects)
    if (filePath.startsWith("..")) continue;
    diagnostics.push({
      filePath,
      plugin: "knip",
      rule: "files",
      severity: KNIP_SEVERITY_MAP["files"],
      message: KNIP_MESSAGE_MAP["files"],
      help: "This file is not imported by any other file in the project.",
      line: 0,
      column: 0,
      category: KNIP_CATEGORY_MAP["files"],
      weight: 1,
    });
  }

  const recordTypes = ["exports", "types", "duplicates"] as const;

  for (const issueType of recordTypes) {
    diagnostics.push(...collectIssueRecords(issues[issueType], issueType, rootDirectory));
  }

  return diagnostics;
};
