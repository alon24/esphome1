import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Set DEVICE_IP env var to proxy API calls to your device during development
// e.g.  DEVICE_IP=192.168.1.42 bun run dev
const DEVICE_IP = process.env.DEVICE_IP ?? "esp32-display.local";

// When running behind code-server proxy, set:
//   VITE_PORT=3009      — port the server listens on
//   BASE_PATH=/proxy/3009/  — sub-path the proxy exposes (for HMR + asset paths)
// Access via http://<host>:8080/proxy/3009/
const PORT = parseInt(process.env.VITE_PORT ?? "5173");
const BASE_PATH = process.env.BASE_PATH ?? "/";

// code-server proxy strips the /proxy/PORT prefix before forwarding to Vite.
// This plugin re-prepends it so Vite can route correctly without redirects.
const codeServerPrefixPlugin = (basePath: string) => ({
	name: "code-server-prefix",
	configureServer(server: any) {
		server.middlewares.use((req: any, _res: any, next: any) => {
			if (basePath !== "/" && !req.url?.startsWith(basePath)) {
				const url: string = req.url ?? "/";
				req.url = url === "/" ? basePath : `${basePath.replace(/\/$/, "")}${url}`;
			}
			next();
		});
	},
});

export default defineConfig(({ command }) => ({
	plugins: [
		react(),
		...(command === "build" ? [viteSingleFile()] : [codeServerPrefixPlugin(BASE_PATH)]),
	],
	base: BASE_PATH,
	server: {
		port: PORT,
		host: true,
		allowedHosts: "all",
		hmr: BASE_PATH === "/"
			? { clientPort: PORT }
			: { clientPort: 8080, path: BASE_PATH },
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
}));
