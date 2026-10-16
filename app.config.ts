import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
    ssr: true,
    appRoot: "./src/app",
    middleware: "./src/server/middleware.ts",
    server: {
        preset: "cloudflare-module",
        plugins: ["./src/server/cache.ts"],
    },
    vite: {
        define: { "import.meta.env.VITE_PUBLIC_BUILD": JSON.stringify(Date.now().toString(36)) },
    },
});
