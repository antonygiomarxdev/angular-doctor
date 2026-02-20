import type { AngularDoctorConfig, Diagnostic } from "../types.js";

const matchesGlob = (filePath: string, pattern: string): boolean => {
  const escapedPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${escapedPattern}$`).test(filePath);
};

export const filterIgnoredDiagnostics = (
  diagnostics: Diagnostic[],
  config: AngularDoctorConfig,
): Diagnostic[] => {
  const ignoredRules = new Set(config.ignore?.rules ?? []);
  const ignoredFilePatterns = config.ignore?.files ?? [];

  return diagnostics.filter((diagnostic) => {
    const ruleKey = `${diagnostic.plugin}/${diagnostic.rule}`;
    if (ignoredRules.has(ruleKey)) return false;

    if (ignoredFilePatterns.some((pattern) => matchesGlob(diagnostic.filePath, pattern))) {
      return false;
    }

    return true;
  });
};
