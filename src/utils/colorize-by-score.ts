import pc from "picocolors";
import { SCORE_GOOD_THRESHOLD, SCORE_OK_THRESHOLD } from "../constants.js";

export const colorizeByScore = (text: string, score: number): string => {
  if (score >= SCORE_GOOD_THRESHOLD) return pc.green(text);
  if (score >= SCORE_OK_THRESHOLD) return pc.yellow(text);
  return pc.red(text);
};
