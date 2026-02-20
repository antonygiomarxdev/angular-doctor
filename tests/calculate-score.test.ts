import { describe, it, expect } from "vitest";
import { calculateScore, getScoreLabel } from "../src/utils/calculate-score.js";
import type { Diagnostic } from "../src/types.js";

const makeDiagnostic = (
  severity: "error" | "warning",
  rule: string,
  plugin = "test",
): Diagnostic => ({
  filePath: "src/app.component.ts",
  plugin,
  rule,
  severity,
  message: "Test message",
  help: "",
  line: 1,
  column: 1,
  category: "Test",
});

describe("calculateScore", () => {
  it("returns 100 for no diagnostics", () => {
    const result = calculateScore([]);
    expect(result.score).toBe(100);
    expect(result.label).toBe("Great");
  });

  it("penalizes errors more heavily than warnings", () => {
    const errorResult = calculateScore([
      makeDiagnostic("error", "rule-a"),
      makeDiagnostic("error", "rule-b"),
    ]);
    const warningResult = calculateScore([
      makeDiagnostic("warning", "rule-c"),
      makeDiagnostic("warning", "rule-d"),
    ]);
    expect(errorResult.score).toBeLessThan(warningResult.score);
  });

  it("counts unique rules, not total occurrences", () => {
    const singleRuleMany = calculateScore([
      makeDiagnostic("warning", "rule-x"),
      makeDiagnostic("warning", "rule-x"),
      makeDiagnostic("warning", "rule-x"),
    ]);
    const singleRuleOnce = calculateScore([makeDiagnostic("warning", "rule-x")]);
    expect(singleRuleMany.score).toBe(singleRuleOnce.score);
  });

  it("score never goes below 0", () => {
    const manyErrors: Diagnostic[] = Array.from({ length: 200 }, (_, i) =>
      makeDiagnostic("error", `rule-${i}`),
    );
    const result = calculateScore(manyErrors);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("returns Critical label for low scores", () => {
    const manyErrors: Diagnostic[] = Array.from({ length: 50 }, (_, i) =>
      makeDiagnostic("error", `rule-${i}`),
    );
    const result = calculateScore(manyErrors);
    expect(result.label).toBe("Critical");
  });
});

describe("getScoreLabel", () => {
  it("returns Great for score >= 75", () => {
    expect(getScoreLabel(100)).toBe("Great");
    expect(getScoreLabel(75)).toBe("Great");
  });

  it("returns Needs work for score 50-74", () => {
    expect(getScoreLabel(74)).toBe("Needs work");
    expect(getScoreLabel(50)).toBe("Needs work");
  });

  it("returns Critical for score < 50", () => {
    expect(getScoreLabel(49)).toBe("Critical");
    expect(getScoreLabel(0)).toBe("Critical");
  });
});
