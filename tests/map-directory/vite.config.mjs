import { fileURLToPath } from "node:url";
import solid from "vite-plugin-solid";

const repository = fileURLToPath(new URL("../../", import.meta.url));

export default {
    root: fileURLToPath(new URL("./", import.meta.url)),
    plugins: [solid()],
    resolve: {
        alias: [
            {
                find: "solid-js/web",
                replacement: `${repository}node_modules/solid-js/web/dist/web.js`,
            },
            {
                find: "solid-js/store",
                replacement: `${repository}node_modules/solid-js/store/dist/store.js`,
            },
            { find: "solid-js", replacement: `${repository}node_modules/solid-js/dist/solid.js` },
        ],
    },
    server: { host: "127.0.0.1", port: 5189, strictPort: true, fs: { allow: [repository] } },
};
