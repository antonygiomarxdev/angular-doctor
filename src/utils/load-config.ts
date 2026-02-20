import fs from "node:fs";
import path from "node:path";
import type { AngularDoctorConfig } from "../types.js";

const CONFIG_FILENAME = "angular-doctor.config.json";
const PACKAGE_JSON_CONFIG_KEY = "angularDoctor";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const loadConfig = (rootDirectory: string): AngularDoctorConfig | null => {
  const configFilePath = path.join(rootDirectory, CONFIG_FILENAME);

  if (fs.existsSync(configFilePath)) {
    try {
      const fileContent = fs.readFileSync(configFilePath, "utf-8");
      const parsed: unknown = JSON.parse(fileContent);
      if (!isPlainObject(parsed)) {
        console.warn(`Warning: ${CONFIG_FILENAME} must be a JSON object, ignoring.`);
        return null;
      }
      return parsed as AngularDoctorConfig;
    } catch (error) {
      console.warn(
        `Warning: Failed to parse ${CONFIG_FILENAME}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  const packageJsonPath = path.join(rootDirectory, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const fileContent = fs.readFileSync(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(fileContent) as Record<string, unknown>;
      const embeddedConfig = packageJson[PACKAGE_JSON_CONFIG_KEY];
      if (isPlainObject(embeddedConfig)) {
        return embeddedConfig as AngularDoctorConfig;
      }
    } catch {
      return null;
    }
  }

  return null;
};
