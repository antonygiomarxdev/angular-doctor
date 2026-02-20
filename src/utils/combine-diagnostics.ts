import { SOURCE_FILE_PATTERN } from "../constants.js";
import type { AngularDoctorConfig, Diagnostic } from "../types.js";
import { filterIgnoredDiagnostics } from "./filter-diagnostics.js";

export const computeIncludePaths = (includePaths: string[]): string[] | undefined =>
  includePaths.length > 0
    ? includePaths.filter((filePath) => SOURCE_FILE_PATTERN.test(filePath))
    : undefined;

export const combineDiagnostics = (
  lintDiagnostics: Diagnostic[],
  deadCodeDiagnostics: Diagnostic[],
  userConfig: AngularDoctorConfig | null,
): Diagnostic[] => {
  const allDiagnostics = [...lintDiagnostics, ...deadCodeDiagnostics];
  return userConfig ? filterIgnoredDiagnostics(allDiagnostics, userConfig) : allDiagnostics;
};
