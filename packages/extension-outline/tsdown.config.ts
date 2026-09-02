import { defineConfig } from "tsdown";

// Publish-only build. Local development resolves `exports` -> src/index.tsx directly.
export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  external: ["react", "react/jsx-runtime"],
});
