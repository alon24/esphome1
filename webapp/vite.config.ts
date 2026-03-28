import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Set DEVICE_IP env var to proxy API calls to your device during development
// e.g.  DEVICE_IP=192.168.1.42 bun run dev
const DEVICE_IP = process.env.DEVICE_IP ?? "esp32-display.local";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {
    port: 3008,
    proxy: {
      "/api": {
        target: `http://${DEVICE_IP}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    // vite-plugin-singlefile inlines everything — required for single-file gzip deploy
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
