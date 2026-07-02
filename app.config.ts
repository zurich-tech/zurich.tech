import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
    ssr: true,
    server: {
        preset: "cloudflare-module",
    },
    vite: {
        plugins: [tailwindcss()],
    },
});
