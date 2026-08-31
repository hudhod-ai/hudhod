import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "core",
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // The WebContainer adapter needs a real browser runtime, so it is
      // verified in the app rather than here.
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/webcontainer/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
