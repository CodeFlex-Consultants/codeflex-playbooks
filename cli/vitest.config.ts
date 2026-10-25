import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: false,
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
    },
  },
});
