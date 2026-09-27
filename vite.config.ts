/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// @tauri-apps/cli sets this; used to tune the dev server for Tauri.
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      // Only the logic layers are unit-tested; screens/UI need the Tauri
      // runtime and are exercised manually via `npm run tauri:dev`.
      include: ["src/lib/**", "src/stores/**", "src/services/**", "src/hooks/**", "src/i18n/**"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "src/i18n/locales/**",
        // Thin wrappers over Tauri plugins with no logic of their own.
        "src/services/system.ts",
        "src/services/updater.ts",
        "src/services/excel.ts",
        "src/services/vault.ts",
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },

  // Prevent Vite from obscuring Rust errors and tune for Tauri dev.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Don't watch the Rust backend.
      ignored: ["**/src-tauri/**"],
    },
  },
}));
