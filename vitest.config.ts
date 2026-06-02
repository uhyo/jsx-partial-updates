import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// During development the package's own `exports` map points at `dist/`, which
// may not be built yet. Alias the self-reference to the TS sources so tests run
// against source.
const srcRuntime = fileURLToPath(
  new URL("./src/jsx-runtime.ts", import.meta.url),
);
const srcIndex = fileURLToPath(new URL("./src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "jsx-partial-updates/jsx-runtime": srcRuntime,
      "jsx-partial-updates/jsx-dev-runtime": srcRuntime,
      "jsx-partial-updates": srcIndex,
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "jsx-partial-updates",
  },
});
