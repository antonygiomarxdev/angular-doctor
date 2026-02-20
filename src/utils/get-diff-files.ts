import { spawnSync } from "node:child_process";
import { SOURCE_FILE_PATTERN, DEFAULT_BRANCH_CANDIDATES } from "../constants.js";
import type { DiffInfo } from "../types.js";

const getCurrentBranch = (directory: string): string | null => {
  const result = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: directory,
    encoding: "utf-8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
};

const getBranchChangedFiles = (directory: string, baseBranch: string): string[] => {
  const result = spawnSync("git", ["diff", "--name-only", baseBranch], {
    cwd: directory,
    encoding: "utf-8",
  });
  if (result.status !== 0) return [];
  return result.stdout.split("\n").filter(Boolean);
};

const getUncommittedChangedFiles = (directory: string): string[] => {
  const result = spawnSync("git", ["status", "--porcelain"], {
    cwd: directory,
    encoding: "utf-8",
  });
  if (result.status !== 0) return [];
  return result.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
};

const branchExists = (directory: string, branch: string): boolean => {
  const result = spawnSync("git", ["rev-parse", "--verify", branch], {
    cwd: directory,
    encoding: "utf-8",
  });
  return result.status === 0;
};

export const filterSourceFiles = (files: string[]): string[] =>
  files.filter((filePath) => SOURCE_FILE_PATTERN.test(filePath));

export const getDiffInfo = (directory: string, explicitBaseBranch?: string): DiffInfo | null => {
  const currentBranch = getCurrentBranch(directory);
  if (!currentBranch) return null;

  if (explicitBaseBranch) {
    if (!branchExists(directory, explicitBaseBranch)) return null;
    const changedFiles = getBranchChangedFiles(directory, explicitBaseBranch);
    return { currentBranch, baseBranch: explicitBaseBranch, changedFiles };
  }

  const uncommittedFiles = getUncommittedChangedFiles(directory);
  if (uncommittedFiles.length > 0) {
    return {
      currentBranch,
      baseBranch: currentBranch,
      changedFiles: uncommittedFiles,
      isCurrentChanges: true,
    };
  }

  for (const candidate of DEFAULT_BRANCH_CANDIDATES) {
    if (branchExists(directory, candidate) && currentBranch !== candidate) {
      const changedFiles = getBranchChangedFiles(directory, candidate);
      if (changedFiles.length > 0) {
        return { currentBranch, baseBranch: candidate, changedFiles };
      }
    }
  }

  return null;
};
