import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig の paths（@/*）は Vite が自前で解決できるのでプラグインは使わない
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
