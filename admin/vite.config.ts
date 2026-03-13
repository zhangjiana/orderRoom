import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const adminRoot = dirname(fileURLToPath(import.meta.url));

  return {
    root: adminRoot,
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: env.VITE_DEV_PROXY_TARGET || "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: path.join(adminRoot, "dist"),
      emptyOutDir: true,
    },
  };
});
