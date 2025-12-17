// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from "vitest/config";

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  define: {
    "process.env.NEW_RELIC_ENABLED": '"false"',
  },
  plugins: [],
  resolve: {
    alias: {
      "~/": new URL("src/", import.meta.url).pathname,
      "~test/": new URL("test/", import.meta.url).pathname,
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reportsDirectory: "reports/coverage",
    },
    exclude: ["**/node_modules/**", "**/test/otel-metrics-client.test.ts"],
  },
});
