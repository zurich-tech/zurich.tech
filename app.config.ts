import { defineConfig } from "@solidjs/start/config";
import { fileURLToPath, pathToFileURL } from "node:url";

export default defineConfig({
    ssr: true,
    appRoot: "./src/app",
    middleware: "./src/server/middleware.ts",
    server: {
        preset: "cloudflare-module",
        experimental: { wasm: true },
        rollupConfig: {
            plugins: [
                {
                    name: "worker-wasm-modules",
                    resolveId(source: string, importer: string | undefined) {
                        // let the libraries supply their own wasm imports during initialisation
                        if (importer && source.startsWith(".") && source.endsWith(".wasm")) {
                            const path = fileURLToPath(new URL(source, pathToFileURL(importer)));

                            return `${path}?module`;
                        }
                    },
                },
            ],
        },
        alias: {
            "@cf-wasm/photon": new URL(
                "./node_modules/@cf-wasm/photon/dist/workerd.js",
                import.meta.url,
            ).pathname,
            "@cf-wasm/resvg": new URL(
                "./node_modules/@cf-wasm/resvg/dist/workerd.js",
                import.meta.url,
            ).pathname,
        },
        plugins: ["./src/server/cache.ts"],
    },
    vite: {
        define: { "import.meta.env.VITE_PUBLIC_BUILD": JSON.stringify(Date.now().toString(36)) },
    },
});
