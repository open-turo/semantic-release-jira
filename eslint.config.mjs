import turoConfig from "@open-turo/eslint-config-typescript";
import { defineConfig } from "eslint/config";

export default defineConfig([
  turoConfig({
    allowModules: [
      "@open-turo/eslint-config-typescript",
      "eslint",
      "nock",
      "vitest",
    ],
    ignores: ["coverage", "lib", "reports"],
    testFramework: "vitest",
  }),
]);
