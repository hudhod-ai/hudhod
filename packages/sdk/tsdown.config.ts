import { defineConfig } from "tsdown";

// Publish-only build. Local development resolves `exports` -> src/index.ts directly,
// so this never runs as part of `next dev`.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
});
