import { describe, it, expect } from "vitest";
import { discoverProject, formatFrameworkName, listAngularWorkspaceProjects } from "../src/utils/discover-project.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const createTempProject = (packageJson: object, hasTsconfig = true): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "angular-doctor-test-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(packageJson, null, 2));
  if (hasTsconfig) {
    fs.writeFileSync(path.join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: {} }));
  }
  return dir;
};

describe("discoverProject", () => {
  it("throws when no package.json found", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "angular-doctor-test-"));
    expect(() => discoverProject(dir)).toThrow("No package.json found");
    fs.rmSync(dir, { recursive: true });
  });

  it("detects Angular version from @angular/core dependency", () => {
    const dir = createTempProject({
      name: "my-angular-app",
      dependencies: { "@angular/core": "^17.0.0" },
    });
    const info = discoverProject(dir);
    expect(info.angularVersion).toBe("^17.0.0");
    expect(info.projectName).toBe("my-angular-app");
    fs.rmSync(dir, { recursive: true });
  });

  it("returns null angularVersion when @angular/core is missing", () => {
    const dir = createTempProject({
      name: "not-an-angular-app",
      dependencies: { react: "^18.0.0" },
    });
    const info = discoverProject(dir);
    expect(info.angularVersion).toBeNull();
    fs.rmSync(dir, { recursive: true });
  });

  it("detects TypeScript when tsconfig.json exists", () => {
    const dir = createTempProject(
      { dependencies: { "@angular/core": "^17.0.0" } },
      true,
    );
    const info = discoverProject(dir);
    expect(info.hasTypeScript).toBe(true);
    fs.rmSync(dir, { recursive: true });
  });

  it("detects no TypeScript when tsconfig.json is absent", () => {
    const dir = createTempProject(
      { dependencies: { "@angular/core": "^17.0.0" } },
      false,
    );
    const info = discoverProject(dir);
    expect(info.hasTypeScript).toBe(false);
    fs.rmSync(dir, { recursive: true });
  });

  it("detects Nx framework", () => {
    const dir = createTempProject({
      dependencies: { "@angular/core": "^17.0.0", "@nx/angular": "^17.0.0" },
    });
    const info = discoverProject(dir);
    expect(info.framework).toBe("nx");
    fs.rmSync(dir, { recursive: true });
  });

  it("detects Ionic framework", () => {
    const dir = createTempProject({
      dependencies: { "@angular/core": "^17.0.0", "@ionic/angular": "^7.0.0" },
    });
    const info = discoverProject(dir);
    expect(info.framework).toBe("ionic");
    fs.rmSync(dir, { recursive: true });
  });

  it("detects Angular CLI framework", () => {
    const dir = createTempProject({
      dependencies: { "@angular/core": "^17.0.0" },
      devDependencies: { "@angular/cli": "^17.0.0" },
    });
    const info = discoverProject(dir);
    expect(info.framework).toBe("angular-cli");
    fs.rmSync(dir, { recursive: true });
  });

  it("returns standalone support for Angular 14+", () => {
    const dir = createTempProject({
      dependencies: { "@angular/core": "^17.0.0" },
    });
    const info = discoverProject(dir);
    expect(info.hasStandaloneComponents).toBe(true);
    fs.rmSync(dir, { recursive: true });
  });

  it("returns no standalone support for Angular 13", () => {
    const dir = createTempProject({
      dependencies: { "@angular/core": "^13.0.0" },
    });
    const info = discoverProject(dir);
    expect(info.hasStandaloneComponents).toBe(false);
    fs.rmSync(dir, { recursive: true });
  });

  it("falls back to parent package.json for workspace sub-projects", () => {
    // Simulate an Angular CLI workspace: root has package.json, sub-dir does not
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "angular-doctor-test-ws-"));
    const projectDir = path.join(rootDir, "projects", "my-app");
    fs.mkdirSync(projectDir, { recursive: true });
    // Root package.json with Angular deps
    fs.writeFileSync(
      path.join(rootDir, "package.json"),
      JSON.stringify({ name: "my-workspace", dependencies: { "@angular/core": "^17.0.0" } }),
    );
    // No package.json in project subdir
    const info = discoverProject(projectDir);
    expect(info.angularVersion).toBe("^17.0.0");
    expect(info.rootDirectory).toBe(projectDir);
    fs.rmSync(rootDir, { recursive: true });
  });
});

describe("formatFrameworkName", () => {
  it("formats all known frameworks", () => {
    expect(formatFrameworkName("angular-cli")).toBe("Angular CLI");
    expect(formatFrameworkName("nx")).toBe("Nx");
    expect(formatFrameworkName("analog")).toBe("AnalogJS");
    expect(formatFrameworkName("ionic")).toBe("Ionic");
    expect(formatFrameworkName("universal")).toBe("Angular SSR");
    expect(formatFrameworkName("unknown")).toBe("Angular");
  });
});

describe("listAngularWorkspaceProjects", () => {
  it("returns empty array when angular.json does not exist", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "angular-doctor-test-"));
    expect(listAngularWorkspaceProjects(dir)).toEqual([]);
    fs.rmSync(dir, { recursive: true });
  });

  it("detects projects from angular.json", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "angular-doctor-test-ws-"));
    const appDir = path.join(rootDir, "projects", "my-app");
    const libDir = path.join(rootDir, "projects", "my-lib");
    fs.mkdirSync(appDir, { recursive: true });
    fs.mkdirSync(libDir, { recursive: true });

    fs.writeFileSync(
      path.join(rootDir, "angular.json"),
      JSON.stringify({
        version: 1,
        projects: {
          "my-app": { projectType: "application", root: "projects/my-app" },
          "my-lib": { projectType: "library", root: "projects/my-lib" },
        },
      }),
    );

    const packages = listAngularWorkspaceProjects(rootDir);
    expect(packages).toHaveLength(2);
    expect(packages.map((p) => p.name).sort()).toEqual(["my-app", "my-lib"]);
    expect(packages.map((p) => p.directory)).toContain(appDir);
    expect(packages.map((p) => p.directory)).toContain(libDir);
    fs.rmSync(rootDir, { recursive: true });
  });

  it("handles angular.json with root project (root: '')", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "angular-doctor-test-root-"));
    fs.writeFileSync(
      path.join(rootDir, "angular.json"),
      JSON.stringify({
        version: 1,
        projects: {
          "my-app": { projectType: "application", root: "" },
        },
      }),
    );

    const packages = listAngularWorkspaceProjects(rootDir);
    expect(packages).toHaveLength(1);
    expect(packages[0].name).toBe("my-app");
    expect(packages[0].directory).toBe(rootDir);
    fs.rmSync(rootDir, { recursive: true });
  });
});
