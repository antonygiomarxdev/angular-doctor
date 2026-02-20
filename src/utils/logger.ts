import { highlighter } from "./highlighter.js";

export const logger = {
  log: (message: string) => process.stdout.write(`${message}\n`),
  break: () => process.stdout.write("\n"),
  dim: (message: string) => process.stdout.write(`${highlighter.dim(message)}\n`),
  warn: (message: string) => process.stdout.write(`${highlighter.warn(message)}\n`),
  error: (message: string) => process.stderr.write(`${highlighter.error(message)}\n`),
  success: (message: string) => process.stdout.write(`${highlighter.success(message)}\n`),
  info: (message: string) => process.stdout.write(`${highlighter.info(message)}\n`),
};
