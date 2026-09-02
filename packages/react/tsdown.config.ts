import { defineConfig } from "tsdown";

// Publish-only build. Local development resolves `exports` -> src/index.tsx directly,
// so this never runs as part of `next dev`.
export default defineConfig({
  entry: ["src/index.tsx", "src/styles.css"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  external: ["react", "react-dom", "react/jsx-runtime", "react-dom/client"],
});
