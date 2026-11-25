import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

// Runs against whatever NEXT_PUBLIC_SUPABASE_URL points to (.env.local).
// Creates rows and deletes them afterwards.
export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["e2e/**/*.e2e.ts"],
    environment: "node",
    testTimeout: 20000,
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
