import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { findAngularWorkspaceRoot } from "../src/utils/run-knip.js";

const createTempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), "angular-doctor-run-knip-test-"));

describe("findAngularWorkspaceRoot", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("returns the directory itself when angular.json is in that directory", () => {
    const dir = createTempDir();
    tempDirs.push(dir);
    fs.writeFileSync(path.join(dir, "angular.json"), "{}");

    expect(findAngularWorkspaceRoot(dir)).toBe(dir);
  });

  it("returns parent directory when angular.json is one level up", () => {
    const parentDir = createTempDir();
    tempDirs.push(parentDir);
    const childDir = path.join(parentDir, "projects", "my-app");
    fs.mkdirSync(childDir, { recursive: true });
    fs.writeFileSync(path.join(parentDir, "angular.json"), "{}");

    expect(findAngularWorkspaceRoot(childDir)).toBe(parentDir);
  });

  it("returns null when no angular.json is found in the directory tree", () => {
    const dir = createTempDir();
    tempDirs.push(dir);

    expect(findAngularWorkspaceRoot(dir)).toBeNull();
  });

  it("returns the closest angular.json directory when nested", () => {
    const rootDir = createTempDir();
    tempDirs.push(rootDir);
    const subDir = path.join(rootDir, "sub");
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(rootDir, "angular.json"), "{}");
    fs.writeFileSync(path.join(subDir, "angular.json"), "{}");

    expect(findAngularWorkspaceRoot(subDir)).toBe(subDir);
  });
});
