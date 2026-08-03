import path from "node:path";
import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*" -> "./src/*" path mapping so real (non-mocked)
// "@/..." imports resolve under Vitest, the same way they already do under
// Next.js's own bundler. Without this, only vi.mock's specifier interception
// works for "@/..." paths, which pushes tests toward duplicating production
// logic inside mocks instead of exercising the real modules.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
