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
// IMPORTANT: proxy paths (e.g. /api) must be excluded — they arrive without the
// basePath prefix (code-server already stripped it) and must reach Vite's proxy
// rule unchanged.  Rewriting them breaks the proxy match entirely.
const codeServerPrefixPlugin = (basePath: string, proxyPaths: string[] = []) => ({
	name: "code-server-prefix",
	configureServer(server: any) {
		server.middlewares.use((req: any, _res: any, next: any) => {
			const isProxyPath = proxyPaths.some(p => req.url?.startsWith(p));
			if (basePath !== "/" && !req.url?.startsWith(basePath) && !isProxyPath) {
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
		...(command === "build" ? [viteSingleFile()] : [codeServerPrefixPlugin(BASE_PATH, ["/api"])]),
	],
	base: BASE_PATH,
	server: {
		port: PORT,
		host: true,
		allowedHosts: "all",
		hmr: { host: 'localhost', clientPort: PORT },
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
