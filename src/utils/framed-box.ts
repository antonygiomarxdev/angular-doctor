import { SUMMARY_BOX_HORIZONTAL_PADDING_CHARS, SUMMARY_BOX_OUTER_INDENT_CHARS } from "../constants.js";
import { highlighter } from "./highlighter.js";
import { logger } from "./logger.js";

export interface FramedLine {
  plainText: string;
  renderedText: string;
}

export const createFramedLine = (plainText: string, renderedText?: string): FramedLine => ({
  plainText,
  renderedText: renderedText ?? plainText,
});

const calculateMaxWidth = (lines: FramedLine[]): number =>
  Math.max(...lines.map((line) => line.plainText.length));

const buildBoxRow = (content: string, width: number): string => {
  const padding = " ".repeat(SUMMARY_BOX_HORIZONTAL_PADDING_CHARS);
  const rightPad = " ".repeat(width - content.length + SUMMARY_BOX_HORIZONTAL_PADDING_CHARS);
  return `│${padding}${content}${rightPad}│`;
};

const buildRenderedBoxRow = (plainContent: string, renderedContent: string, width: number): string => {
  const padding = " ".repeat(SUMMARY_BOX_HORIZONTAL_PADDING_CHARS);
  const rightPad = " ".repeat(width - plainContent.length + SUMMARY_BOX_HORIZONTAL_PADDING_CHARS);
  return highlighter.dim(`│`) + padding + renderedContent + rightPad + highlighter.dim(`│`);
};

export const renderFramedBoxString = (lines: FramedLine[]): string => {
  const width = calculateMaxWidth(lines);
  const indent = " ".repeat(SUMMARY_BOX_OUTER_INDENT_CHARS);
  const topBorder = `┌${"─".repeat(width + SUMMARY_BOX_HORIZONTAL_PADDING_CHARS * 2)}┐`;
  const bottomBorder = `└${"─".repeat(width + SUMMARY_BOX_HORIZONTAL_PADDING_CHARS * 2)}┘`;

  const rows = lines.map((line) => buildBoxRow(line.plainText, width));
  return [topBorder, ...rows, bottomBorder]
    .map((row) => `${indent}${row}`)
    .join("\n");
};

export const printFramedBox = (lines: FramedLine[]): void => {
  const width = calculateMaxWidth(lines);
  const indent = " ".repeat(SUMMARY_BOX_OUTER_INDENT_CHARS);
  const topBorder = highlighter.dim(`┌${"─".repeat(width + SUMMARY_BOX_HORIZONTAL_PADDING_CHARS * 2)}┐`);
  const bottomBorder = highlighter.dim(`└${"─".repeat(width + SUMMARY_BOX_HORIZONTAL_PADDING_CHARS * 2)}┘`);

  logger.log(`${indent}${topBorder}`);
  for (const line of lines) {
    logger.log(`${indent}${buildRenderedBoxRow(line.plainText, line.renderedText, width)}`);
  }
  logger.log(`${indent}${bottomBorder}`);
};
