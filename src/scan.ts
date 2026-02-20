import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import {
  MILLISECONDS_PER_SECOND,
  PERFECT_SCORE,
  SCORE_BAR_WIDTH_CHARS,
  SCORE_GOOD_THRESHOLD,
  SCORE_OK_THRESHOLD,
} from "./constants.js";
import type {
  AngularDoctorConfig,
  Diagnostic,
  ProjectInfo,
  ScanOptions,
  ScanResult,
  ScoreResult,
} from "./types.js";
import { calculateScore } from "./utils/calculate-score.js";
import { colorizeByScore } from "./utils/colorize-by-score.js";
import {
  combineDiagnostics,
  computeIncludePaths,
} from "./utils/combine-diagnostics.js";
import {
  discoverProject,
  formatFrameworkName,
} from "./utils/discover-project.js";
import {
  type FramedLine,
  createFramedLine,
  printFramedBox,
} from "./utils/framed-box.js";
import { groupBy } from "./utils/group-by.js";
import { highlighter } from "./utils/highlighter.js";
import { indentMultilineText } from "./utils/indent-multiline-text.js";
import { loadConfig } from "./utils/load-config.js";
import { logger } from "./utils/logger.js";
import { runEslint } from "./utils/run-eslint.js";
import { runKnip } from "./utils/run-knip.js";
import { spinner } from "./utils/spinner.js";

interface ScoreBarSegments {
  filledSegment: string;
  emptySegment: string;
}

const SEVERITY_ORDER: Record<Diagnostic["severity"], number> = {
  error: 0,
  warning: 1,
};

const colorizeBySeverity = (
  text: string,
  severity: Diagnostic["severity"],
): string =>
  severity === "error" ? highlighter.error(text) : highlighter.warn(text);

const sortBySeverity = (
  diagnosticGroups: [string, Diagnostic[]][],
): [string, Diagnostic[]][] =>
  diagnosticGroups.toSorted(([, diagnosticsA], [, diagnosticsB]) => {
    const severityA = SEVERITY_ORDER[diagnosticsA[0].severity];
    const severityB = SEVERITY_ORDER[diagnosticsB[0].severity];
    return severityA - severityB;
  });

const collectAffectedFiles = (diagnostics: Diagnostic[]): Set<string> =>
  new Set(diagnostics.map((diagnostic) => diagnostic.filePath));

const buildFileLineMap = (diagnostics: Diagnostic[]): Map<string, number[]> => {
  const fileLines = new Map<string, number[]>();
  for (const diagnostic of diagnostics) {
    const lines = fileLines.get(diagnostic.filePath) ?? [];
    if (diagnostic.line > 0) {
      lines.push(diagnostic.line);
    }
    fileLines.set(diagnostic.filePath, lines);
  }
  return fileLines;
};

const printDiagnostics = (
  diagnostics: Diagnostic[],
  isVerbose: boolean,
): void => {
  const ruleGroups = groupBy(
    diagnostics,
    (diagnostic) => `${diagnostic.plugin}/${diagnostic.rule}`,
  );

  const sortedRuleGroups = sortBySeverity([...ruleGroups.entries()]);

  for (const [, ruleDiagnostics] of sortedRuleGroups) {
    const firstDiagnostic = ruleDiagnostics[0];
    const severitySymbol = firstDiagnostic.severity === "error" ? "✗" : "⚠";
    const icon = colorizeBySeverity(severitySymbol, firstDiagnostic.severity);
    const count = ruleDiagnostics.length;
    const countLabel =
      count > 1
        ? colorizeBySeverity(` (${count})`, firstDiagnostic.severity)
        : "";

    logger.log(`  ${icon} ${firstDiagnostic.message}${countLabel}`);
    if (firstDiagnostic.help) {
      logger.dim(indentMultilineText(firstDiagnostic.help, "    "));
    }

    if (isVerbose) {
      const fileLines = buildFileLineMap(ruleDiagnostics);

      for (const [filePath, lines] of fileLines) {
        const lineLabel = lines.length > 0 ? `: ${lines.join(", ")}` : "";
        logger.dim(`    ${filePath}${lineLabel}`);
      }
    }

    logger.break();
  }
};

const formatElapsedTime = (elapsedMilliseconds: number): string => {
  if (elapsedMilliseconds < MILLISECONDS_PER_SECOND) {
    return `${Math.round(elapsedMilliseconds)}ms`;
  }
  return `${(elapsedMilliseconds / MILLISECONDS_PER_SECOND).toFixed(1)}s`;
};

const formatRuleSummary = (
  ruleKey: string,
  ruleDiagnostics: Diagnostic[],
): string => {
  const firstDiagnostic = ruleDiagnostics[0];
  const fileLines = buildFileLineMap(ruleDiagnostics);

  const sections = [
    `Rule: ${ruleKey}`,
    `Severity: ${firstDiagnostic.severity}`,
    `Category: ${firstDiagnostic.category}`,
    `Count: ${ruleDiagnostics.length}`,
    "",
    firstDiagnostic.message,
  ];

  if (firstDiagnostic.help) {
    sections.push("", `Suggestion: ${firstDiagnostic.help}`);
  }

  sections.push("", "Files:");
  for (const [filePath, lines] of fileLines) {
    const lineLabel = lines.length > 0 ? `: ${lines.join(", ")}` : "";
    sections.push(`  ${filePath}${lineLabel}`);
  }

  return sections.join("\n") + "\n";
};

const buildMarkdownReport = (
  diagnostics: Diagnostic[],
  elapsedMilliseconds: number,
  scoreResult: ScoreResult | null,
  totalSourceFileCount: number,
): string => {
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning",
  ).length;
  const affectedFileCount = collectAffectedFiles(diagnostics).size;
  const elapsed = formatElapsedTime(elapsedMilliseconds);

  const lines: string[] = [
    "# Angular Doctor Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
  ];

  if (scoreResult) {
    lines.push(
      "## Score",
      "",
      `**${scoreResult.score} / ${PERFECT_SCORE}** — ${scoreResult.label}`,
      "",
    );
  }

  lines.push(
    "## Summary",
    "",
    `- Errors: **${errorCount}**`,
    `- Warnings: **${warningCount}**`,
    totalSourceFileCount > 0
      ? `- Affected files: **${affectedFileCount}/${totalSourceFileCount}**`
      : `- Affected files: **${affectedFileCount}**`,
    `- Elapsed: **${elapsed}**`,
    "",
  );

  if (diagnostics.length === 0) {
    lines.push("## Diagnostics", "", "No issues found.", "");
    return lines.join("\n");
  }

  const ruleGroups = groupBy(
    diagnostics,
    (diagnostic) => `${diagnostic.plugin}/${diagnostic.rule}`,
  );
  const sortedRuleGroups = sortBySeverity([...ruleGroups.entries()]);

  lines.push("## Diagnostics", "");

  for (const [ruleKey, ruleDiagnostics] of sortedRuleGroups) {
    const firstDiagnostic = ruleDiagnostics[0];
    const fileLines = buildFileLineMap(ruleDiagnostics);

    lines.push(`### ${ruleKey}`, "");
    lines.push(
      `- Severity: **${firstDiagnostic.severity}**`,
      `- Category: **${firstDiagnostic.category}**`,
      `- Count: **${ruleDiagnostics.length}**`,
      "",
      firstDiagnostic.message,
      "",
    );

    if (firstDiagnostic.help) {
      lines.push(`**Suggestion:** ${firstDiagnostic.help}`, "");
    }

    lines.push("**Files:**");
    for (const [filePath, linesList] of fileLines) {
      const lineLabel = linesList.length > 0 ? `: ${linesList.join(", ")}` : "";
      lines.push(`- ${filePath}${lineLabel}`);
    }
    lines.push("");
  }

  return lines.join("\n");
};

const resolveReportPath = (
  report: boolean | string | undefined,
  outputDirectory: string,
  baseDirectory: string,
): string | null => {
  if (!report) return null;

  if (typeof report === "string") {
    const absolutePath = isAbsolute(report)
      ? report
      : resolve(baseDirectory, report);
    if (extname(absolutePath)) return absolutePath;
    return join(absolutePath, "report.md");
  }

  return join(outputDirectory, "report.md");
};

const writeDiagnosticsDirectory = (
  diagnostics: Diagnostic[],
  elapsedMilliseconds: number,
  scoreResult: ScoreResult | null,
  totalSourceFileCount: number,
  report: boolean | string | undefined,
  baseDirectory: string,
): { outputDirectory: string; markdownPath: string | null } => {
  const outputDirectory = join(tmpdir(), `angular-doctor-${randomUUID()}`);
  mkdirSync(outputDirectory);

  const ruleGroups = groupBy(
    diagnostics,
    (diagnostic) => `${diagnostic.plugin}/${diagnostic.rule}`,
  );
  const sortedRuleGroups = sortBySeverity([...ruleGroups.entries()]);

  for (const [ruleKey, ruleDiagnostics] of sortedRuleGroups) {
    const fileName = ruleKey.replace(/\//g, "--") + ".txt";
    writeFileSync(
      join(outputDirectory, fileName),
      formatRuleSummary(ruleKey, ruleDiagnostics),
    );
  }

  writeFileSync(
    join(outputDirectory, "diagnostics.json"),
    JSON.stringify(diagnostics, null, 2),
  );

  const markdownPath = resolveReportPath(
    report,
    outputDirectory,
    baseDirectory,
  );
  if (markdownPath) {
    mkdirSync(dirname(markdownPath), { recursive: true });
    writeFileSync(
      markdownPath,
      buildMarkdownReport(
        diagnostics,
        elapsedMilliseconds,
        scoreResult,
        totalSourceFileCount,
      ),
    );
  }

  return { outputDirectory, markdownPath };
};

const buildScoreBarSegments = (score: number): ScoreBarSegments => {
  const filledCount = Math.round(
    (score / PERFECT_SCORE) * SCORE_BAR_WIDTH_CHARS,
  );
  const emptyCount = SCORE_BAR_WIDTH_CHARS - filledCount;

  return {
    filledSegment: "█".repeat(filledCount),
    emptySegment: "░".repeat(emptyCount),
  };
};

const buildPlainScoreBar = (score: number): string => {
  const { filledSegment, emptySegment } = buildScoreBarSegments(score);
  return `${filledSegment}${emptySegment}`;
};

const buildScoreBar = (score: number): string => {
  const { filledSegment, emptySegment } = buildScoreBarSegments(score);
  return colorizeByScore(filledSegment, score) + highlighter.dim(emptySegment);
};

const printScoreGauge = (score: number, label: string): void => {
  const scoreDisplay = colorizeByScore(`${score}`, score);
  const labelDisplay = colorizeByScore(label, score);
  logger.log(`  ${scoreDisplay} / ${PERFECT_SCORE}  ${labelDisplay}`);
  logger.break();
  logger.log(`  ${buildScoreBar(score)}`);
  logger.break();
};

const getDoctorFace = (score: number): string[] => {
  if (score >= SCORE_GOOD_THRESHOLD) return ["◠ ◠", " ▽ "];
  if (score >= SCORE_OK_THRESHOLD) return ["• •", " ─ "];
  return ["x x", " ▽ "];
};

const printBranding = (score?: number): void => {
  if (score !== undefined) {
    const [eyes, mouth] = getDoctorFace(score);
    const colorize = (text: string) => colorizeByScore(text, score);
    logger.log(colorize("  ┌─────┐"));
    logger.log(colorize(`  │ ${eyes} │`));
    logger.log(colorize(`  │ ${mouth} │`));
    logger.log(colorize("  └─────┘"));
  }
  logger.log(`  Angular Doctor`);
  logger.break();
};

const buildBrandingLines = (scoreResult: ScoreResult | null): FramedLine[] => {
  const lines: FramedLine[] = [];

  if (scoreResult) {
    const [eyes, mouth] = getDoctorFace(scoreResult.score);
    const scoreColorizer = (text: string): string =>
      colorizeByScore(text, scoreResult.score);

    lines.push(createFramedLine("┌─────┐", scoreColorizer("┌─────┐")));
    lines.push(createFramedLine(`│ ${eyes} │`, scoreColorizer(`│ ${eyes} │`)));
    lines.push(
      createFramedLine(`│ ${mouth} │`, scoreColorizer(`│ ${mouth} │`)),
    );
    lines.push(createFramedLine("└─────┘", scoreColorizer("└─────┘")));
    lines.push(createFramedLine("Angular Doctor"));
    lines.push(createFramedLine(""));

    const scoreLinePlainText = `${scoreResult.score} / ${PERFECT_SCORE}  ${scoreResult.label}`;
    const scoreLineRenderedText = `${colorizeByScore(String(scoreResult.score), scoreResult.score)} / ${PERFECT_SCORE}  ${colorizeByScore(scoreResult.label, scoreResult.score)}`;
    lines.push(createFramedLine(scoreLinePlainText, scoreLineRenderedText));
    lines.push(createFramedLine(""));
    lines.push(
      createFramedLine(
        buildPlainScoreBar(scoreResult.score),
        buildScoreBar(scoreResult.score),
      ),
    );
    lines.push(createFramedLine(""));
  } else {
    lines.push(createFramedLine("Angular Doctor"));
    lines.push(createFramedLine(""));
    lines.push(
      createFramedLine(
        "Score unavailable",
        highlighter.dim("Score unavailable"),
      ),
    );
    lines.push(createFramedLine(""));
  }

  return lines;
};

const buildCountsSummaryLine = (
  diagnostics: Diagnostic[],
  totalSourceFileCount: number,
  elapsedMilliseconds: number,
): FramedLine => {
  const errorCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  const warningCount = diagnostics.filter(
    (diagnostic) => diagnostic.severity === "warning",
  ).length;
  const affectedFileCount = collectAffectedFiles(diagnostics).size;
  const elapsed = formatElapsedTime(elapsedMilliseconds);

  const plainParts: string[] = [];
  const renderedParts: string[] = [];

  if (errorCount > 0) {
    const errorText = `✗ ${errorCount} error${errorCount === 1 ? "" : "s"}`;
    plainParts.push(errorText);
    renderedParts.push(highlighter.error(errorText));
  }
  if (warningCount > 0) {
    const warningText = `⚠ ${warningCount} warning${warningCount === 1 ? "" : "s"}`;
    plainParts.push(warningText);
    renderedParts.push(highlighter.warn(warningText));
  }

  const fileCountText =
    totalSourceFileCount > 0
      ? `across ${affectedFileCount}/${totalSourceFileCount} files`
      : `across ${affectedFileCount} file${affectedFileCount === 1 ? "" : "s"}`;
  const elapsedTimeText = `in ${elapsed}`;

  plainParts.push(fileCountText, elapsedTimeText);
  renderedParts.push(
    highlighter.dim(fileCountText),
    highlighter.dim(elapsedTimeText),
  );

  return createFramedLine(plainParts.join("  "), renderedParts.join("  "));
};

const printSummary = (
  diagnostics: Diagnostic[],
  elapsedMilliseconds: number,
  scoreResult: ScoreResult | null,
  totalSourceFileCount: number,
  report: boolean | string | undefined,
  baseDirectory: string,
): void => {
  const summaryFramedLines = [
    ...buildBrandingLines(scoreResult),
    buildCountsSummaryLine(
      diagnostics,
      totalSourceFileCount,
      elapsedMilliseconds,
    ),
  ];
  printFramedBox(summaryFramedLines);

  try {
    const { outputDirectory, markdownPath } = writeDiagnosticsDirectory(
      diagnostics,
      elapsedMilliseconds,
      scoreResult,
      totalSourceFileCount,
      report,
      baseDirectory,
    );
    logger.break();
    logger.dim(`  Full diagnostics written to ${outputDirectory}`);
    if (markdownPath) {
      logger.dim(`  Markdown report written to ${markdownPath}`);
    }
  } catch {
    logger.break();
  }
};

interface ResolvedScanOptions {
  lint: boolean;
  deadCode: boolean;
  verbose: boolean;
  scoreOnly: boolean;
  report: boolean | string | undefined;
  useTypeAwareLint: boolean;
  includePaths: string[];
}

const mergeScanOptions = (
  inputOptions: ScanOptions,
  userConfig: AngularDoctorConfig | null,
): ResolvedScanOptions => {
  const fastMode = inputOptions.fast ?? userConfig?.fast ?? false;

  return {
    lint: inputOptions.lint ?? userConfig?.lint ?? true,
    deadCode: fastMode
      ? false
      : (inputOptions.deadCode ?? userConfig?.deadCode ?? true),
    verbose: inputOptions.verbose ?? userConfig?.verbose ?? false,
    scoreOnly: inputOptions.scoreOnly ?? false,
    report: inputOptions.report ?? false,
    useTypeAwareLint: !fastMode,
    includePaths: inputOptions.includePaths ?? [],
  };
};

const printProjectDetection = (
  projectInfo: ProjectInfo,
  userConfig: AngularDoctorConfig | null,
  isDiffMode: boolean,
  includePaths: string[],
): void => {
  const frameworkLabel = formatFrameworkName(projectInfo.framework);
  const languageLabel = "TypeScript";

  const completeStep = (message: string) => {
    spinner(message).start().succeed(message);
  };

  completeStep(
    `Detecting framework. Found ${highlighter.info(frameworkLabel)}.`,
  );
  completeStep(
    `Detecting Angular version. Found ${highlighter.info(`Angular ${projectInfo.angularVersion}`)}.`,
  );
  completeStep(`Detecting language. Found ${highlighter.info(languageLabel)}.`);
  completeStep(
    `Detecting standalone components. ${projectInfo.hasStandaloneComponents ? highlighter.info("Supported.") : "Not available (Angular 14+ required)."}`,
  );

  if (isDiffMode) {
    completeStep(
      `Scanning ${highlighter.info(`${includePaths.length}`)} changed source files.`,
    );
  } else {
    completeStep(
      `Found ${highlighter.info(`${projectInfo.sourceFileCount}`)} source files.`,
    );
  }

  if (userConfig) {
    completeStep(`Loaded ${highlighter.info("angular-doctor config")}.`);
  }

  logger.break();
};

export const scan = async (
  directory: string,
  inputOptions: ScanOptions = {},
): Promise<ScanResult> => {
  const startTime = performance.now();
  const projectInfo = discoverProject(directory);
  const userConfig = loadConfig(directory);
  const options = mergeScanOptions(inputOptions, userConfig);
  const { includePaths } = options;
  const isDiffMode = includePaths.length > 0;

  if (!projectInfo.angularVersion) {
    throw new Error("No Angular dependency found in package.json");
  }

  if (!options.scoreOnly) {
    printProjectDetection(projectInfo, userConfig, isDiffMode, includePaths);
  }

  const computedIncludePaths = computeIncludePaths(includePaths);

  let didLintFail = false;
  let didDeadCodeFail = false;

  const runLint = async (): Promise<Diagnostic[]> => {
    if (!options.lint) return [];
    const lintSpinner = options.scoreOnly
      ? null
      : spinner("Running lint checks...").start();
    try {
      const lintDiagnostics = await runEslint(
        directory,
        projectInfo.hasTypeScript,
        computedIncludePaths,
        { useTypeAware: options.useTypeAwareLint },
      );
      lintSpinner?.succeed("Running lint checks.");
      return lintDiagnostics;
    } catch (error) {
      didLintFail = true;
      lintSpinner?.fail("Lint checks failed (non-fatal, skipping).");
      logger.error(String(error));
      return [];
    }
  };

  const runDeadCode = async (): Promise<Diagnostic[]> => {
    if (!options.deadCode || isDiffMode) return [];
    const deadCodeSpinner = options.scoreOnly
      ? null
      : spinner("Detecting dead code...").start();
    try {
      const knipDiagnostics = await runKnip(directory);
      deadCodeSpinner?.succeed("Detecting dead code.");
      return knipDiagnostics;
    } catch (error) {
      didDeadCodeFail = true;
      deadCodeSpinner?.fail(
        "Dead code detection failed (non-fatal, skipping).",
      );
      logger.error(String(error));
      return [];
    }
  };

  const [lintDiagnostics, deadCodeDiagnostics] = options.scoreOnly
    ? await Promise.all([runLint(), runDeadCode()])
    : [await runLint(), await runDeadCode()];
  const diagnostics = combineDiagnostics(
    lintDiagnostics,
    deadCodeDiagnostics,
    userConfig,
  );

  const elapsedMilliseconds = performance.now() - startTime;

  const skippedChecks: string[] = [];
  if (didLintFail) skippedChecks.push("lint");
  if (didDeadCodeFail) skippedChecks.push("dead code");
  const hasSkippedChecks = skippedChecks.length > 0;

  const scoreResult = calculateScore(diagnostics);

  if (options.scoreOnly) {
    logger.log(`${scoreResult.score}`);
    return { diagnostics, scoreResult, skippedChecks };
  }

  if (diagnostics.length === 0) {
    if (hasSkippedChecks) {
      const skippedLabel = skippedChecks.join(" and ");
      logger.warn(
        `No issues detected, but ${skippedLabel} checks failed — results are incomplete.`,
      );
    } else {
      logger.success("No issues found!");
    }
    logger.break();
    if (hasSkippedChecks) {
      printBranding();
      logger.dim("  Score not shown — some checks could not complete.");
    } else {
      printBranding(scoreResult.score);
      printScoreGauge(scoreResult.score, scoreResult.label);
    }
    return { diagnostics, scoreResult, skippedChecks };
  }

  printDiagnostics(diagnostics, options.verbose);

  const displayedSourceFileCount = isDiffMode
    ? includePaths.length
    : projectInfo.sourceFileCount;

  printSummary(
    diagnostics,
    elapsedMilliseconds,
    scoreResult,
    displayedSourceFileCount,
    options.report,
    directory,
  );

  if (hasSkippedChecks) {
    const skippedLabel = skippedChecks.join(" and ");
    logger.break();
    logger.warn(
      `  Note: ${skippedLabel} checks failed — score may be incomplete.`,
    );
  }

  return { diagnostics, scoreResult, skippedChecks };
};
