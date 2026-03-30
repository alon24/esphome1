import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Set DEVICE_IP env var to proxy API calls to your device during development
// e.g.  DEVICE_IP=192.168.1.42 bun run dev
const DEVICE_IP = process.env.DEVICE_IP ?? "esp32-display.local";

// When running behind code-server proxy, set:
//   VITE_PORT=3008 (or whatever port code-server exposes)
// Access via http://<host>:8080/proxy/3008/
const PORT = parseInt(process.env.VITE_PORT ?? "5173");

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: "./",
  server: {
    port: PORT,
    host: true,
    allowedHosts: "all",
    hmr: {
      clientPort: PORT,
    },
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
