import { cpSync, existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const DATA_DIR = resolve(__dirname, "data");
const TYPES = {
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

// Serves ./data at /data during dev and copies it into dist/data on build,
// so the agent writes plain files and the app reads them with fetch().
function dataDir() {
  return {
    name: "zimmer-data-dir",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const base = server.config.base.replace(/\/$/, "");
        const url = decodeURIComponent((req.url || "").split("?")[0]);
        if (!url.startsWith(base + "/data/")) return next();
        const file = join(DATA_DIR, url.slice(base.length + "/data/".length));
        if (!file.startsWith(DATA_DIR) || !existsSync(file)) return next();
        res.setHeader("Content-Type", TYPES[extname(file).toLowerCase()] || "application/octet-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.end(readFileSync(file));
      });
    },
    closeBundle() {
      const out = resolve(__dirname, "dist", "data");
      if (existsSync(DATA_DIR) && existsSync(resolve(__dirname, "dist"))) cpSync(DATA_DIR, out, { recursive: true });
    },
  };
}

// BASE_PATH lets GitHub Pages serve the app from /<repo>/ (set by the deploy workflow).
// `vite build --mode single` (used by `npm run bundle`) inlines all JS and CSS into one HTML file;
// scripts/bundle.mjs then embeds the data and photos.
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH || "./",
  plugins: mode === "single" ? [react(), viteSingleFile()] : [react(), dataDir()],
  build: mode === "single" ? { outDir: "dist-single", emptyOutDir: true, chunkSizeWarningLimit: 5000 } : {},
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    include: ["src/**/*.test.{js,jsx}", "scripts/**/*.test.mjs"],
  },
}));
