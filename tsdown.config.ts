import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/cli.ts"],
    format: "esm",
    dts: true,
    define: {
      "process.env.VERSION": JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
    },
  },
  {
    entry: ["src/index.ts"],
    format: "esm",
    dts: true,
  },
]);
