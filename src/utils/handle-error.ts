import { logger } from "./logger.js";

export interface HandleErrorOptions {
  shouldExit: boolean;
}

export const handleError = (
  error: unknown,
  options: HandleErrorOptions = { shouldExit: true },
): void => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(message);
  if (options.shouldExit) {
    process.exit(1);
  }
};
