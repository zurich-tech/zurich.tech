import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
    ssr: true,
    appRoot: "./src/app",
    server: {
        preset: "cloudflare-module",
        plugins: ["./src/server/cache.ts"],
    },
    vite: {
        plugins: [tailwindcss()],
        define: { "import.meta.env.VITE_PUBLIC_BUILD": JSON.stringify(Date.now().toString(36)) },
    },
});
