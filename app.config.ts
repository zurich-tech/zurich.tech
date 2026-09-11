import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
    ssr: true,
    appRoot: "./src/app",
    server: {
        preset: "cloudflare-module",
    },
    vite: {
        plugins: [tailwindcss()],
    },
});
