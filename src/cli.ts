import path from "node:path";
import { Command } from "commander";
import { scan } from "./scan.js";
import type { AngularDoctorConfig, DiffInfo, ScanOptions } from "./types.js";
import { loadConfig } from "./utils/load-config.js";
import { filterSourceFiles, getDiffInfo } from "./utils/get-diff-files.js";
import { handleError } from "./utils/handle-error.js";
import { highlighter } from "./utils/highlighter.js";
import { logger } from "./utils/logger.js";
import { selectProjects } from "./utils/select-projects.js";

const VERSION = process.env.VERSION ?? "0.0.0";

interface CliFlags {
  lint: boolean;
  deadCode: boolean;
  verbose: boolean;
  score: boolean;
  yes: boolean;
  report?: boolean | string;
  project?: string;
  diff?: boolean | string;
}

const exitWithHint = () => {
  logger.break();
  logger.log("Cancelled.");
  logger.break();
  process.exit(0);
};

process.on("SIGINT", exitWithHint);
process.on("SIGTERM", exitWithHint);

const AUTOMATED_ENVIRONMENT_VARIABLES = [
  "CI",
  "CLAUDECODE",
  "CURSOR_AGENT",
  "CODEX_CI",
  "OPENCODE",
  "AMP_HOME",
];

const isAutomatedEnvironment = (): boolean =>
  AUTOMATED_ENVIRONMENT_VARIABLES.some((envVariable) =>
    Boolean(process.env[envVariable]),
  );

const resolveCliScanOptions = (
  flags: CliFlags,
  userConfig: AngularDoctorConfig | null,
  programInstance: Command,
): ScanOptions => {
  const isCliOverride = (optionName: string) =>
    programInstance.getOptionValueSource(optionName) === "cli";

  return {
    lint: isCliOverride("lint") ? flags.lint : (userConfig?.lint ?? flags.lint),
    deadCode: isCliOverride("deadCode")
      ? flags.deadCode
      : (userConfig?.deadCode ?? flags.deadCode),
    verbose: isCliOverride("verbose")
      ? Boolean(flags.verbose)
      : (userConfig?.verbose ?? false),
    scoreOnly: flags.score,
    report: flags.report,
  };
};

const resolveDiffMode = async (
  diffInfo: DiffInfo | null,
  effectiveDiff: boolean | string | undefined,
  shouldSkipPrompts: boolean,
  isScoreOnly: boolean,
): Promise<boolean> => {
  if (effectiveDiff !== undefined && effectiveDiff !== false) {
    if (diffInfo) return true;
    if (!isScoreOnly) {
      logger.warn(
        "No feature branch or uncommitted changes detected. Running full scan.",
      );
      logger.break();
    }
    return false;
  }

  if (effectiveDiff === false || !diffInfo) return false;

  const changedSourceFiles = filterSourceFiles(diffInfo.changedFiles);
  if (changedSourceFiles.length === 0) return false;
  if (shouldSkipPrompts) return true;
  if (isScoreOnly) return false;

  // In non-interactive mode, skip diff prompts
  return false;
};

const program = new Command()
  .name("angular-doctor")
  .description("Diagnose Angular codebase health")
  .version(VERSION, "-v, --version", "display the version number")
  .argument("[directory]", "project directory to scan", ".")
  .option("--no-lint", "skip linting")
  .option("--no-dead-code", "skip dead code detection")
  .option("--verbose", "show file details per rule")
  .option("--score", "output only the score")
  .option("--report [path]", "write a markdown report (optional output path)")
  .option("-y, --yes", "skip prompts, scan all workspace projects")
  .option(
    "--project <name>",
    "select workspace project (comma-separated for multiple)",
  )
  .option("--diff [base]", "scan only files changed vs base branch")
  .action(async (directory: string, flags: CliFlags) => {
    const isScoreOnly = flags.score;

    try {
      const resolvedDirectory = path.resolve(directory);
      const userConfig = loadConfig(resolvedDirectory);

      if (!isScoreOnly) {
        logger.log(`angular-doctor v${VERSION}`);
        logger.break();
      }

      const scanOptions = resolveCliScanOptions(flags, userConfig, program);
      const shouldSkipPrompts =
        flags.yes || isAutomatedEnvironment() || !process.stdin.isTTY;

      // Discover and (optionally) prompt to select workspace projects
      const projectDirectories = await selectProjects(
        resolvedDirectory,
        flags.project,
        shouldSkipPrompts,
      );

      const isDiffCliOverride = program.getOptionValueSource("diff") === "cli";
      const effectiveDiff = isDiffCliOverride ? flags.diff : userConfig?.diff;
      const explicitBaseBranch =
        typeof effectiveDiff === "string" ? effectiveDiff : undefined;
      const diffInfo = getDiffInfo(resolvedDirectory, explicitBaseBranch);
      const isDiffMode = await resolveDiffMode(
        diffInfo,
        effectiveDiff,
        shouldSkipPrompts,
        isScoreOnly,
      );

      if (isDiffMode && diffInfo && !isScoreOnly) {
        if (diffInfo.isCurrentChanges) {
          logger.log("Scanning uncommitted changes");
        } else {
          logger.log(
            `Scanning changes: ${highlighter.info(diffInfo.currentBranch)} → ${highlighter.info(diffInfo.baseBranch)}`,
          );
        }
        logger.break();
      }

      for (const projectDirectory of projectDirectories) {
        let includePaths: string[] | undefined;

        if (isDiffMode) {
          const projectDiffInfo = getDiffInfo(
            projectDirectory,
            explicitBaseBranch,
          );
          if (projectDiffInfo) {
            const changedSourceFiles = filterSourceFiles(
              projectDiffInfo.changedFiles,
            );
            if (changedSourceFiles.length === 0) {
              if (!isScoreOnly) {
                logger.dim(
                  `No changed source files in ${projectDirectory}, skipping.`,
                );
                logger.break();
              }
              continue;
            }
            includePaths = changedSourceFiles;
          }
        }

        if (!isScoreOnly) {
          logger.dim(`Scanning ${projectDirectory}...`);
          logger.break();
        }

        await scan(projectDirectory, { ...scanOptions, includePaths });

        if (!isScoreOnly) {
          logger.break();
        }
      }
    } catch (error) {
      handleError(error);
    }
  })
  .addHelpText(
    "after",
    `
${highlighter.dim("Learn more:")}
  ${highlighter.info("https://github.com/antonygiomarxdev/angular-doctor")}
`,
  );

const main = async () => {
  await program.parseAsync();
};

main();
