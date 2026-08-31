import { defineConfig } from "tsdown";

// Publish-only build. Local development resolves `exports` -> src/*.ts directly,
// so this never runs as part of `next dev`.
export default defineConfig({
  entry: ["src/index.ts", "src/webcontainer/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  external: ["@webcontainer/api"],
});
