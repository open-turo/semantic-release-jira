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
    env: {
      NODE_ENV: "test",
    },
    exclude: ["**/node_modules/**", "**/test/otel-metrics-client.test.ts"],
    testTimeout: 10_000, // 10 second timeout for all tests (integration tests need more time)
  },
});
